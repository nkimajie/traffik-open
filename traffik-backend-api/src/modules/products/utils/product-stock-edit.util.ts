import { FilterQuery, Types } from "mongoose";
import { ProductDocument } from "../schemas/product.schema";
import {
  ProductStockEdit,
  ProductStockEditPlan,
  ProductStockSnapshot,
  StockConflict,
  StockFigureEdit,
  VariationEdit,
} from "../interfaces/product-stock-edit.interface";

type StockDecision =
  | { kind: "keep" }
  | { kind: "set"; quantity: number }
  | { kind: "conflict"; expected: number }
  | { kind: "invalid" };

/**
 * How a stock figure from a vendor's form applies to the stock stored now.
 *
 * Stock moves under the form (orders reserve and release it), so a figure
 * is only written when the vendor changed it, and only if the stock is still
 * what the form showed. Sending the figure back unchanged never overwrites
 * what orders did in the meantime.
 */
export function decideStockFigure(
  current: number,
  edit: StockFigureEdit,
): StockDecision {
  if (edit.quantity === undefined) {
    return { kind: "keep" };
  }
  if (edit.expectedQuantity === undefined) {
    // Without the figure the form showed, a change cannot be told apart
    // from a stale form; only a figure matching the stock is accepted.
    return edit.quantity === current ? { kind: "keep" } : { kind: "invalid" };
  }
  if (edit.quantity === edit.expectedQuantity) {
    return { kind: "keep" };
  }
  return current === edit.expectedQuantity
    ? { kind: "set", quantity: edit.quantity }
    : { kind: "conflict", expected: edit.expectedQuantity };
}

const EXPECTED_QUANTITY_REQUIRED =
  "To change stock, send expectedQuantity: the stock shown when you opened the product. Stock changes as orders come in, so it may no longer match.";

/**
 * Works out what a vendor's product edit writes for stock and options, and
 * the conditions under which that write is still correct. Pure: the caller
 * reads the product, plans, and writes with `guard`; if the guard no longer
 * matches (an order moved stock in between), it reads and plans again.
 */
export function planProductStockEdit(
  current: ProductStockSnapshot,
  edit: ProductStockEdit,
): ProductStockEditPlan {
  if (edit.variations && edit.variations.length > 0) {
    return planVariations(current, edit.variations);
  }
  if (edit.variations && current.hasVariations) {
    return planSwitchToDefault(edit);
  }
  if (current.hasVariations) {
    // Stock of a product with options is set per option.
    return { kind: "apply", set: {}, unset: [], guard: {} };
  }
  return planDefaultVariation(current, edit);
}

function planDefaultVariation(
  current: ProductStockSnapshot,
  edit: ProductStockEdit,
): ProductStockEditPlan {
  const set: Record<string, unknown> = {};
  const guard: FilterQuery<ProductDocument> = {};
  const { name, price, attributes } = edit.defaultVariationChanges;

  if (!current.defaultVariation) {
    // A legacy product without a default option: create it whole.
    const touches =
      edit.quantity !== undefined ||
      name !== undefined ||
      price !== undefined ||
      attributes !== undefined;
    if (touches) {
      set.defaultVariation = {
        ...edit.defaultVariationBase,
        quantity: edit.quantity ?? 0,
      };
      guard.defaultVariation = null;
    }
    return { kind: "apply", set, unset: [], guard };
  }

  const stored = current.defaultVariation.quantity ?? 0;
  const decision = decideStockFigure(stored, edit);
  if (decision.kind === "invalid") {
    return { kind: "invalid", message: EXPECTED_QUANTITY_REQUIRED };
  }
  if (decision.kind === "conflict") {
    return {
      kind: "conflict",
      conflicts: [
        { expectedQuantity: decision.expected, currentQuantity: stored },
      ],
    };
  }
  if (decision.kind === "set") {
    set["defaultVariation.quantity"] = decision.quantity;
    guard["defaultVariation.quantity"] = stored;
  }

  // Each field on its own: rewriting the whole default option would also
  // write back the stock as it was read.
  if (name !== undefined) set["defaultVariation.name"] = name;
  if (price !== undefined) set["defaultVariation.price"] = price;
  if (attributes !== undefined) set["defaultVariation.attributes"] = attributes;

  return { kind: "apply", set, unset: [], guard };
}

function planSwitchToDefault(edit: ProductStockEdit): ProductStockEditPlan {
  // The options go away, so their stock does not matter; the new default
  // option starts with the stock sent (nothing to compare it with).
  return {
    kind: "apply",
    set: {
      variations: [],
      hasVariations: false,
      defaultVariation: {
        ...edit.defaultVariationBase,
        quantity: edit.quantity ?? 0,
      },
    },
    unset: [],
    guard: { hasVariations: true },
  };
}

function planVariations(
  current: ProductStockSnapshot,
  edits: VariationEdit[],
): ProductStockEditPlan {
  const existing = new Map(
    (current.hasVariations ? current.variations : []).map((variation) => [
      String(variation._id),
      variation,
    ]),
  );

  const conflicts: StockConflict[] = [];
  const seen = new Set<string>();
  const next: Record<string, unknown>[] = [];

  for (const edit of edits) {
    const { _id } = edit;
    // What is stored for an option (expectedQuantity is only for checking).
    const fields = Object.fromEntries(
      Object.entries({
        name: edit.name,
        attributes: edit.attributes,
        price: edit.price,
        quantity: edit.quantity,
        discount: edit.discount,
      }).filter(([, value]) => value !== undefined),
    );

    if (!_id) {
      // A new option: its stock is whatever the vendor entered.
      next.push(fields);
      continue;
    }

    const stored = existing.get(_id);
    if (!stored) {
      return {
        kind: "invalid",
        message: `Option ${_id} is not one of this product's options. Send options you are adding without an _id.`,
      };
    }
    if (seen.has(_id)) {
      return { kind: "invalid", message: `Option ${_id} is listed twice.` };
    }
    seen.add(_id);

    const decision = decideStockFigure(stored.quantity, edit);
    if (decision.kind === "invalid") {
      return {
        kind: "invalid",
        message: `${EXPECTED_QUANTITY_REQUIRED} (option "${edit.name}")`,
      };
    }
    if (decision.kind === "conflict") {
      conflicts.push({
        variationId: _id,
        name: edit.name,
        expectedQuantity: decision.expected,
        currentQuantity: stored.quantity,
      });
      continue;
    }

    next.push({
      ...fields,
      // Keeping the id keeps carts and orders pointing at this option.
      _id: new Types.ObjectId(_id),
      quantity: decision.kind === "set" ? decision.quantity : stored.quantity,
    });
  }

  if (conflicts.length > 0) {
    return { kind: "conflict", conflicts };
  }

  // The whole list is written, including the stock of options whose stock
  // the vendor did not change, so it must still be what was read.
  const stillAsRead = [...existing.values()].map((variation) => ({
    variations: {
      $elemMatch: { _id: variation._id, quantity: variation.quantity },
    },
  }));

  return {
    kind: "apply",
    set: { variations: next, hasVariations: true },
    unset: current.defaultVariation ? ["defaultVariation"] : [],
    guard: {
      hasVariations: current.hasVariations ? true : { $ne: true },
      variations: { $size: current.variations.length },
      ...(stillAsRead.length > 0 && { $and: stillAsRead }),
    },
  };
}
