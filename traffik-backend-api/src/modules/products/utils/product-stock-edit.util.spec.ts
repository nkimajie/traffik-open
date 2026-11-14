import { Types } from "mongoose";
import {
  decideStockFigure,
  planProductStockEdit,
} from "./product-stock-edit.util";
import {
  ProductStockEdit,
  ProductStockSnapshot,
} from "../interfaces/product-stock-edit.interface";

describe("decideStockFigure", () => {
  it.each([
    ["no figure sent", 7, {}, { kind: "keep" }],
    [
      "the figure sent back unchanged",
      7,
      { quantity: 10, expectedQuantity: 10 },
      { kind: "keep" },
    ],
    [
      "a change, stock as the form showed",
      10,
      { quantity: 15, expectedQuantity: 10 },
      { kind: "set", quantity: 15 },
    ],
    [
      "a change, stock moved since",
      7,
      { quantity: 15, expectedQuantity: 10 },
      { kind: "conflict", expected: 10 },
    ],
    [
      "no expected figure, matching stock",
      7,
      { quantity: 7 },
      { kind: "keep" },
    ],
    [
      "no expected figure, different stock",
      7,
      { quantity: 10 },
      { kind: "invalid" },
    ],
  ])("%s", (_label, current, edit, decision) => {
    expect(decideStockFigure(current, edit)).toEqual(decision);
  });

  it("never overwrites stock moved by orders when the vendor left it alone", () => {
    // Form opened at 10; orders took it to 3; vendor saves other changes.
    expect(
      decideStockFigure(3, { quantity: 10, expectedQuantity: 10 }),
    ).toEqual({ kind: "keep" });
  });
});

describe("planProductStockEdit", () => {
  const base = { name: "Tote", price: 1000, attributes: {} };
  const edit = (changes: Partial<ProductStockEdit> = {}): ProductStockEdit => ({
    defaultVariationChanges: {},
    defaultVariationBase: base,
    ...changes,
  });
  const simple = (quantity = 7): ProductStockSnapshot => ({
    hasVariations: false,
    defaultVariation: { quantity },
    variations: [],
  });
  const red = new Types.ObjectId();
  const blue = new Types.ObjectId();
  const withOptions = (redQty = 5, blueQty = 2): ProductStockSnapshot => ({
    hasVariations: true,
    variations: [
      { _id: red, name: "Red", quantity: redQty },
      { _id: blue, name: "Blue", quantity: blueQty },
    ],
  });
  const option = (
    id: Types.ObjectId | undefined,
    fields: Record<string, unknown>,
  ) => ({
    ...(id && { _id: String(id) }),
    name: "Opt",
    attributes: { size: "M" },
    quantity: 0,
    ...fields,
  });

  describe("a product without options", () => {
    it("leaves stock alone when only other fields change, and sets them one by one", () => {
      expect(
        planProductStockEdit(
          simple(),
          edit({
            quantity: 10,
            expectedQuantity: 10,
            defaultVariationChanges: { name: "Tote bag", price: 1200 },
          }),
        ),
      ).toEqual({
        kind: "apply",
        set: {
          "defaultVariation.name": "Tote bag",
          "defaultVariation.price": 1200,
        },
        unset: [],
        guard: {},
      });
    });

    it("sets a changed stock figure only while stock is still what was read", () => {
      expect(
        planProductStockEdit(
          simple(10),
          edit({ quantity: 15, expectedQuantity: 10 }),
        ),
      ).toEqual({
        kind: "apply",
        set: { "defaultVariation.quantity": 15 },
        unset: [],
        guard: { "defaultVariation.quantity": 10 },
      });
    });

    it("refuses a change to stock orders have moved, with the current figure", () => {
      expect(
        planProductStockEdit(
          simple(7),
          edit({ quantity: 15, expectedQuantity: 10 }),
        ),
      ).toEqual({
        kind: "conflict",
        conflicts: [{ expectedQuantity: 10, currentQuantity: 7 }],
      });
    });

    it("asks for the expected figure to change stock without it", () => {
      expect(
        planProductStockEdit(simple(7), edit({ quantity: 10 })),
      ).toMatchObject({
        kind: "invalid",
        message: expect.stringMatching(/expectedQuantity/),
      });
    });

    it("creates a missing default option whole", () => {
      expect(
        planProductStockEdit(
          { hasVariations: false, defaultVariation: null, variations: [] },
          edit({ quantity: 4, defaultVariationChanges: { price: 900 } }),
        ),
      ).toEqual({
        kind: "apply",
        set: { defaultVariation: { ...base, quantity: 4 } },
        unset: [],
        guard: { defaultVariation: null },
      });
    });

    it("ignores a stock figure for a product with options", () => {
      expect(
        planProductStockEdit(
          withOptions(),
          edit({ quantity: 99, expectedQuantity: 1 }),
        ),
      ).toEqual({ kind: "apply", set: {}, unset: [], guard: {} });
    });
  });

  describe("options", () => {
    it("keeps option ids, keeps stock the vendor left alone, sets what they changed, and guards every stock figure", () => {
      const plan = planProductStockEdit(
        withOptions(3, 2),
        edit({
          variations: [
            option(red, { name: "Red", quantity: 5, expectedQuantity: 5 }), // untouched (orders took 2)
            option(blue, { name: "Navy", quantity: 9, expectedQuantity: 2 }), // changed
            option(undefined, { name: "Green", quantity: 4 }), // new
          ],
        }),
      );

      expect(plan).toEqual({
        kind: "apply",
        set: {
          hasVariations: true,
          variations: [
            { _id: red, name: "Red", attributes: { size: "M" }, quantity: 3 },
            { _id: blue, name: "Navy", attributes: { size: "M" }, quantity: 9 },
            { name: "Green", attributes: { size: "M" }, quantity: 4 },
          ],
        },
        unset: [],
        guard: {
          hasVariations: true,
          variations: { $size: 2 },
          $and: [
            { variations: { $elemMatch: { _id: red, quantity: 3 } } },
            { variations: { $elemMatch: { _id: blue, quantity: 2 } } },
          ],
        },
      });
    });

    it("reports every option whose changed stock orders have moved", () => {
      expect(
        planProductStockEdit(
          withOptions(3, 0),
          edit({
            variations: [
              option(red, { name: "Red", quantity: 10, expectedQuantity: 5 }),
              option(blue, { name: "Blue", quantity: 6, expectedQuantity: 2 }),
            ],
          }),
        ),
      ).toEqual({
        kind: "conflict",
        conflicts: [
          {
            variationId: String(red),
            name: "Red",
            expectedQuantity: 5,
            currentQuantity: 3,
          },
          {
            variationId: String(blue),
            name: "Blue",
            expectedQuantity: 2,
            currentQuantity: 0,
          },
        ],
      });
    });

    it("removes options left out of the list", () => {
      const plan = planProductStockEdit(
        withOptions(),
        edit({
          variations: [option(red, { quantity: 5, expectedQuantity: 5 })],
        }),
      );

      expect(plan.kind === "apply" && plan.set.variations).toEqual([
        expect.objectContaining({ _id: red }),
      ]);
    });

    it.each([
      [
        "an id that is not one of the product's options",
        [option(new Types.ObjectId(), {})],
      ],
      [
        "the same option twice",
        [option(red, { quantity: 5 }), option(red, { quantity: 5 })],
      ],
      [
        "a changed option stock without the expected figure",
        [option(red, { quantity: 8 })],
      ],
    ])("refuses %s", (_label, variations) => {
      expect(
        planProductStockEdit(withOptions(5, 2), edit({ variations })),
      ).toMatchObject({ kind: "invalid" });
    });

    it("switches a product without options to options, dropping the default option", () => {
      expect(
        planProductStockEdit(
          simple(7),
          edit({
            variations: [option(undefined, { name: "Red", quantity: 3 })],
          }),
        ),
      ).toEqual({
        kind: "apply",
        set: {
          hasVariations: true,
          variations: [{ name: "Red", attributes: { size: "M" }, quantity: 3 }],
        },
        unset: ["defaultVariation"],
        guard: { hasVariations: { $ne: true }, variations: { $size: 0 } },
      });
    });

    it("does not accept ids when switching to options (there are none yet)", () => {
      expect(
        planProductStockEdit(
          simple(),
          edit({ variations: [option(red, { quantity: 1 })] }),
        ),
      ).toMatchObject({ kind: "invalid" });
    });

    it("switches back to no options with the stock sent for the new default option", () => {
      expect(
        planProductStockEdit(
          withOptions(),
          edit({ variations: [], quantity: 6 }),
        ),
      ).toEqual({
        kind: "apply",
        set: {
          variations: [],
          hasVariations: false,
          defaultVariation: { ...base, quantity: 6 },
        },
        unset: [],
        guard: { hasVariations: true },
      });
    });
  });
});
