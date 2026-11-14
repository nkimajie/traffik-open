import mongoose, { Model, Query, Types } from "mongoose";
import { ProductsRepository } from "./products.repository";
import { ProductDocument, ProductSchema } from "../schemas/product.schema";

/**
 * Vendor edits against the real Product schema, cast by Mongoose but not sent
 * to a database: a path the schema does not know would be dropped from the
 * update without an error.
 */
describe("ProductsRepository.applyVendorEdit (cast against the Product schema)", () => {
  const ProductModel = mongoose.model(
    "ProductVendorEditCastSpec",
    ProductSchema,
  ) as unknown as Model<ProductDocument>;
  const repository = new ProductsRepository(ProductModel);
  const productId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();

  let captured: { filter: any; update: any; options: any };

  beforeEach(() => {
    jest.spyOn(Query.prototype, "exec").mockImplementation(function (
      this: any,
    ) {
      this._castConditions();
      expect(this.error()).toBeFalsy();
      captured = {
        filter: this.getFilter(),
        update: this._castUpdate(this._update),
        options: this.getOptions(),
      };
      return Promise.resolve(null);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("writes only the changed default-option fields, on the vendor's product, while its stock is as read", async () => {
    await repository.applyVendorEdit(
      productId,
      vendorId,
      { "defaultVariation.quantity": 10 },
      {
        set: {
          name: "Tote bag",
          "defaultVariation.name": "Tote bag",
          "defaultVariation.price": 1200,
          "defaultVariation.quantity": 15,
        },
        unset: [],
      },
    );

    expect(captured.filter).toEqual({
      "defaultVariation.quantity": 10,
      _id: productId,
      vendorId,
    });
    expect(captured.update.$set).toMatchObject({
      name: "Tote bag",
      "defaultVariation.name": "Tote bag",
      "defaultVariation.price": 1200,
      "defaultVariation.quantity": 15,
    });
    expect(captured.options.new).toBe(true);
  });

  it("keeps the id of an option that stays and gives a new option its own", async () => {
    const red = new Types.ObjectId();

    await repository.applyVendorEdit(
      productId,
      vendorId,
      {
        hasVariations: true,
        variations: { $size: 1 },
        $and: [{ variations: { $elemMatch: { _id: red, quantity: 3 } } }],
      },
      {
        set: {
          hasVariations: true,
          variations: [
            { _id: red, name: "Red", attributes: { size: "M" }, quantity: 3 },
            { name: "Green", attributes: { size: "L" }, quantity: 4 },
          ],
        },
        unset: ["defaultVariation"],
      },
    );

    const [kept, added] = captured.update.$set.variations;
    expect(kept._id).toEqual(red);
    expect(kept.quantity).toBe(3);
    expect(added._id).toBeInstanceOf(Types.ObjectId);
    expect(added._id).not.toEqual(red);
    expect(captured.update.$unset).toEqual({ defaultVariation: "" });
    expect(captured.filter).toEqual({
      hasVariations: true,
      variations: { $size: 1 },
      $and: [{ variations: { $elemMatch: { _id: red, quantity: 3 } } }],
      _id: productId,
      vendorId,
    });
  });

  it("reads the stock snapshot for the vendor's product only", async () => {
    await repository.findVendorStockSnapshot(productId, vendorId);

    expect(captured.filter).toEqual({ _id: productId, vendorId });
  });
});
