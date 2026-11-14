import { FilterQuery, Types } from "mongoose";
import { ProductDocument } from "../schemas/product.schema";
import { IProductDiscount } from "./product.interface";

/** The stock a product held when an edit was read from the database. */
export interface ProductStockSnapshot {
  hasVariations: boolean;
  defaultVariation?: { quantity?: number } | null;
  variations: Array<{ _id?: Types.ObjectId; name?: string; quantity: number }>;
}

/**
 * A stock figure from a vendor's form. `expectedQuantity` is the stock the
 * form showed when it was opened: it says whether the vendor changed the
 * stock (`quantity !== expectedQuantity`) and lets the change be refused if
 * orders moved the stock in the meantime.
 */
export interface StockFigureEdit {
  quantity?: number;
  expectedQuantity?: number;
}

/** One option in a vendor's variations list. Without `_id` it is a new option. */
export interface VariationEdit extends StockFigureEdit {
  _id?: string;
  name: string;
  attributes: Record<string, string>;
  price?: number;
  quantity: number;
  discount?: IProductDiscount;
}

export interface ProductStockEdit extends StockFigureEdit {
  /** Omitted: options unchanged. Empty: stop using options. */
  variations?: VariationEdit[];
  /** Default-option fields the edit changes (products without options). */
  defaultVariationChanges: {
    name?: string;
    price?: number;
    attributes?: Record<string, string>;
  };
  /** The default option's values after the edit, for when one has to be created. */
  defaultVariationBase: {
    name: string;
    price: number;
    attributes: Record<string, string>;
  };
}

/** A stock change refused because orders moved the stock after the form was opened. */
export interface StockConflict {
  /** Set for an option; absent for a product without options. */
  variationId?: string;
  name?: string;
  expectedQuantity: number;
  currentQuantity: number;
}

/**
 * What to write for an edit:
 * - `apply`: `set`/`unset`, only while `guard` still matches (the stock it
 *   was computed from is unchanged);
 * - `conflict`: the vendor changed stock that orders have since moved;
 * - `invalid`: the edit cannot be applied as sent.
 */
export type ProductStockEditPlan =
  | {
      kind: "apply";
      set: Record<string, unknown>;
      unset: string[];
      guard: FilterQuery<ProductDocument>;
    }
  | { kind: "conflict"; conflicts: StockConflict[] }
  | { kind: "invalid"; message: string };
