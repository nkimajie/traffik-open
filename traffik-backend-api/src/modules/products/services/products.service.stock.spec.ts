import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ProductsService } from "./products.service";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { PRODUCT_EDIT_MAX_ATTEMPTS } from "../constants/product-stock.constant";

/**
 * A vendor editing a product while orders reserve and return its stock.
 *
 * The products collection is in memory but follows MongoDB's single-document
 * rules: a conditional update checks and writes in one step, and every call
 * yields first, so the vendor's edit and orders interleave at each await.
 * Orders change stock the way OrdersService does: a conditional `$inc`.
 */

type Doc = Record<string, any>;

const tick = () => new Promise((resolve) => setImmediate(resolve));
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value instanceof Types.ObjectId) return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
    ) as T;
  }
  return value;
};
const same = (a: unknown, b: unknown) => String(a) === String(b);

class FakeProductsRepository {
  doc: Doc;
  writes = 0;

  private owns(productId: unknown, vendorId: unknown) {
    return same(this.doc._id, productId) && same(this.doc.vendorId, vendorId);
  }

  /** ProductsService.findById / findVendorProduct read through this. */
  async aggregate() {
    await tick();
    return { items: [clone(this.doc)] };
  }

  async findVendorStockSnapshot(productId: unknown, vendorId: unknown) {
    await tick();
    if (!this.owns(productId, vendorId)) return null;
    const { hasVariations, defaultVariation, variations } = clone(this.doc);
    return { hasVariations, defaultVariation, variations };
  }

  private matches(guard: Doc): boolean {
    return Object.entries(guard).every(([key, value]) => {
      if (key === "$and") {
        return (value as Doc[]).every((clause) => this.matches(clause));
      }
      if (key === "defaultVariation.quantity") {
        return this.doc.defaultVariation?.quantity === value;
      }
      if (key === "defaultVariation") {
        return value === null ? this.doc.defaultVariation == null : false;
      }
      if (key === "hasVariations") {
        return value && typeof value === "object"
          ? this.doc.hasVariations !== value.$ne
          : this.doc.hasVariations === value;
      }
      if (key === "variations") {
        if ("$size" in value) return this.doc.variations.length === value.$size;
        const wanted = value.$elemMatch;
        return this.doc.variations.some(
          (v: Doc) => same(v._id, wanted._id) && v.quantity === wanted.quantity,
        );
      }
      throw new Error(`Fake does not support guard ${key}`);
    });
  }

  async applyVendorEdit(
    productId: unknown,
    vendorId: unknown,
    guard: Doc,
    update: { set: Doc; unset: string[] },
  ) {
    await tick();
    if (!this.owns(productId, vendorId) || !this.matches(guard)) return null;
    this.writes++;
    for (const [path, value] of Object.entries(update.set)) {
      if (path === "variations") {
        // Mongoose gives a new option its own id and keeps a given one.
        this.doc.variations = (value as Doc[]).map((v) => ({
          ...clone(v),
          _id: v._id ?? new Types.ObjectId(),
        }));
      } else if (path.startsWith("defaultVariation.")) {
        this.doc.defaultVariation[path.split(".")[1]] = clone(value);
      } else {
        this.doc[path] = clone(value);
      }
    }
    for (const path of update.unset) delete this.doc[path];
    return clone(this.doc);
  }

  /** Orders' conditional stock changes (OrdersService.adjustLineStock). */
  readonly model = {
    updateOne: async (filter: Doc, update: Doc) => {
      await tick();
      const [path, delta] = Object.entries(update.$inc)[0] as [string, number];
      if (path === "variations.$.quantity") {
        const wanted = filter.variations.$elemMatch;
        const v = this.doc.variations.find((x: Doc) => same(x._id, wanted._id));
        if (!v || (wanted.quantity && v.quantity < wanted.quantity.$gte)) {
          return { modifiedCount: 0 };
        }
        v.quantity += delta;
        return { modifiedCount: 1 };
      }
      const guard = filter["defaultVariation.quantity"];
      if (guard && this.doc.defaultVariation.quantity < guard.$gte) {
        return { modifiedCount: 0 };
      }
      this.doc.defaultVariation.quantity += delta;
      return { modifiedCount: 1 };
    },
  };
}

describe("ProductsService.update and live stock", () => {
  const vendorId = String(new Types.ObjectId());
  const red = new Types.ObjectId();
  const blue = new Types.ObjectId();

  let repo: FakeProductsRepository;
  let service: ProductsService;

  const id = () => String(repo.doc._id);
  const stock = () => repo.doc.defaultVariation.quantity;
  const optionStock = (optionId: unknown) =>
    repo.doc.variations.find((v: Doc) => same(v._id, optionId))?.quantity;
  const ticks = async (n: number) => {
    for (let i = 0; i < n; i++) await tick();
  };

  /** An order reserving (n > 0) or returning (n < 0) stock. */
  const order = (n: number, optionId?: unknown) =>
    repo.model.updateOne(
      optionId
        ? {
            _id: repo.doc._id,
            variations: {
              $elemMatch: {
                _id: optionId,
                ...(n > 0 && { quantity: { $gte: n } }),
              },
            },
          }
        : {
            _id: repo.doc._id,
            ...(n > 0 && { "defaultVariation.quantity": { $gte: n } }),
          },
      {
        $inc: {
          [optionId ? "variations.$.quantity" : "defaultVariation.quantity"]:
            -n,
        },
      },
    );

  const edit = (body: Doc) => service.update(id(), vendorId, body as any);
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (error) => ({ status: error.getStatus?.(), body: error.getResponse?.() }),
    );

  /** Runs `during` once, right after the edit has read the product's stock. */
  const afterStockRead = (during: () => Promise<unknown>) => {
    const read = repo.findVendorStockSnapshot.bind(repo);
    let pending = true;
    jest
      .spyOn(repo, "findVendorStockSnapshot")
      .mockImplementation(async (...args: [unknown, unknown]) => {
        const snapshot = await read(...args);
        if (pending) {
          pending = false;
          await during();
        }
        return snapshot;
      });
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    repo = new FakeProductsRepository();
    repo.doc = {
      _id: new Types.ObjectId(),
      vendorId: new Types.ObjectId(vendorId),
      name: "Tote",
      amount: 1000,
      images: [],
      hasVariations: false,
      variations: [],
      defaultVariation: {
        name: "Tote",
        attributes: {},
        price: 1000,
        quantity: 10,
      },
    };
    service = new ProductsService(
      repo as any,
      {} as any,
      new UtilsService(),
      {} as any,
      {} as any,
      {} as any,
      { getLatestReviewMapForProductIds: async () => new Map() } as any,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe("a product without options", () => {
    it("keeps stock orders moved when the vendor saves other changes", async () => {
      await order(3); // form opened at 10, then 3 sold

      await edit({ name: "Tote bag", quantity: 10, expectedQuantity: 10 });

      expect(repo.doc.name).toBe("Tote bag");
      expect(stock()).toBe(7);
    });

    it("keeps a sale that lands while the edit is being written", async () => {
      afterStockRead(() => order(3));

      await edit({ attributes: { color: "Navy" } });

      expect(repo.doc.defaultVariation.attributes).toEqual({ color: "navy" });
      expect(stock()).toBe(7);
    });

    it("sets the stock the vendor changed while it is still what they saw", async () => {
      await edit({ quantity: 15, expectedQuantity: 10 });

      expect(stock()).toBe(15);
    });

    it("refuses a stock change orders have overtaken, writes nothing, and says what the stock is now", async () => {
      await order(3);

      const error = await failure(
        edit({ name: "Renamed", quantity: 15, expectedQuantity: 10 }),
      );

      expect(error).toMatchObject({
        status: 409,
        body: {
          code: "STOCK_CHANGED",
          conflicts: [{ expectedQuantity: 10, currentQuantity: 7 }],
          message: expect.stringMatching(/10 when you opened it, 7 now/),
        },
      });
      expect(stock()).toBe(7);
      expect(repo.doc.name).toBe("Tote");
    });

    it("refuses a changed figure sent without the figure the form showed, instead of overwriting", async () => {
      await order(3);

      // An older client re-sending the stock it loaded.
      const error = await failure(edit({ name: "Renamed", quantity: 10 }));

      expect(error).toMatchObject({
        status: 400,
        body: { code: "EXPECTED_QUANTITY_REQUIRED" },
      });
      expect(stock()).toBe(7);
      expect(repo.doc.name).toBe("Tote");
    });

    it("accepts a figure sent without the expected one when it matches the stock", async () => {
      await edit({ name: "Renamed", quantity: 10 });

      expect(repo.doc.name).toBe("Renamed");
      expect(stock()).toBe(10);
    });

    it("keeps the default option's price in step with the product price, for cart pricing", async () => {
      await edit({ amount: 1500 });

      expect(repo.doc.defaultVariation).toMatchObject({
        price: 1500,
        quantity: 10,
      });
    });

    it.each([-6, -4, -2, -1, 0, 1, 2, 4, 6])(
      "never loses a sale racing a stock change (offset %i)",
      async (offset) => {
        const [result] = await Promise.all([
          ticks(Math.max(offset, 0)).then(() =>
            failure(edit({ quantity: 15, expectedQuantity: 10 })),
          ),
          ticks(Math.max(-offset, 0)).then(() => order(3)),
        ]);

        if (result) {
          // The sale came first: the vendor is asked to review.
          expect(result.status).toBe(409);
          expect(stock()).toBe(7);
        } else {
          // The vendor's figure came first; the sale is taken from it.
          expect(stock()).toBe(12);
        }
      },
    );

    it("lets only one of two tabs change the same stock", async () => {
      const results = await Promise.all([
        failure(edit({ quantity: 15, expectedQuantity: 10 })),
        failure(edit({ quantity: 4, expectedQuantity: 10 })),
      ]);

      expect(results.filter((r) => r === undefined)).toHaveLength(1);
      expect(results.find((r) => r)?.status).toBe(409);
      expect([15, 4]).toContain(stock());
    });
  });

  describe("a product with options", () => {
    beforeEach(() => {
      Object.assign(repo.doc, {
        hasVariations: true,
        defaultVariation: undefined,
        variations: [
          { _id: red, name: "Red", attributes: { size: "M" }, quantity: 5 },
          { _id: blue, name: "Blue", attributes: { size: "L" }, quantity: 2 },
        ],
      });
    });
    const red5 = (fields: Doc = {}) => ({
      _id: String(red),
      name: "Red",
      attributes: { size: "M" },
      quantity: 5,
      expectedQuantity: 5,
      ...fields,
    });
    const blue2 = (fields: Doc = {}) => ({
      _id: String(blue),
      name: "Blue",
      attributes: { size: "L" },
      quantity: 2,
      expectedQuantity: 2,
      ...fields,
    });

    it("keeps option ids, so stock an open order holds goes back to the same option", async () => {
      await order(2, red); // an unpaid order holds 2 of Red

      await edit({ variations: [red5({ name: "Crimson" }), blue2()] });
      const returned = await order(-2, red); // the order is cancelled

      expect(repo.doc.variations.map((v: Doc) => String(v._id))).toEqual([
        String(red),
        String(blue),
      ]);
      expect(repo.doc.variations[0].name).toBe("Crimson");
      expect(returned.modifiedCount).toBe(1);
      expect(optionStock(red)).toBe(5);
    });

    it("plans again when an order moves stock between reading and writing, keeping the sale", async () => {
      afterStockRead(() => order(1, blue));
      const write = jest.spyOn(repo, "applyVendorEdit");

      await edit({ variations: [red5({ name: "Crimson" }), blue2()] });

      expect(write).toHaveBeenCalledTimes(2); // first write refused by its guard
      expect(repo.doc.variations[0].name).toBe("Crimson");
      expect(optionStock(blue)).toBe(1);
    });

    it("gives up with a clear message if orders keep moving stock", async () => {
      const read = repo.findVendorStockSnapshot.bind(repo);
      jest
        .spyOn(repo, "findVendorStockSnapshot")
        .mockImplementation(async (...args: [unknown, unknown]) => {
          const snapshot = await read(...args);
          await order(-1, blue); // stock moves after every read
          return snapshot;
        });

      const error = await failure(
        edit({ variations: [red5({ name: "Crimson" }), blue2()] }),
      );

      expect(error).toMatchObject({
        status: 409,
        body: { code: "STOCK_BUSY" },
      });
      expect(repo.findVendorStockSnapshot).toHaveBeenCalledTimes(
        PRODUCT_EDIT_MAX_ATTEMPTS,
      );
      expect(repo.doc.variations[0].name).toBe("Red");
    });

    it("refuses an option stock change orders have overtaken, naming the option", async () => {
      await order(2, red);

      const error = await failure(
        edit({ variations: [red5({ quantity: 9 }), blue2()] }),
      );

      expect(error).toMatchObject({
        status: 409,
        body: {
          code: "STOCK_CHANGED",
          conflicts: [
            {
              variationId: String(red),
              name: "Red",
              expectedQuantity: 5,
              currentQuantity: 3,
            },
          ],
        },
      });
      expect(optionStock(red)).toBe(3);
    });

    it("adds, changes and removes options in one edit", async () => {
      await edit({
        variations: [
          red5({ quantity: 8 }),
          { name: "Green", attributes: { size: "S" }, quantity: 4 },
        ],
      });

      expect(repo.doc.variations).toEqual([
        expect.objectContaining({ _id: red, quantity: 8 }),
        expect.objectContaining({
          _id: expect.any(Types.ObjectId),
          name: "Green",
          quantity: 4,
        }),
      ]);
    });

    it("refuses an id that is not one of the product's options", async () => {
      const error = await failure(
        edit({ variations: [red5({ _id: String(new Types.ObjectId()) })] }),
      );

      expect(error).toMatchObject({ status: 400 });
      expect(repo.doc.variations).toHaveLength(2);
    });

    it("switches back to no options with the stock sent", async () => {
      await edit({ variations: [], quantity: 6 });

      expect(repo.doc).toMatchObject({
        hasVariations: false,
        variations: [],
        defaultVariation: { name: "Tote", price: 1000, quantity: 6 },
      });
    });
  });

  it("does not let a vendor edit another vendor's product", async () => {
    await expect(
      service.update(id(), String(new Types.ObjectId()), { name: "x" } as any),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.doc.name).toBe("Tote");
  });
});
