import { FilterQuery } from "mongoose";
import { ICartItem } from "../../carts/interfaces/cart.interface";
import { OrderDocument } from "../schemas/order.schema";

/**
 * Result of reserving a checkout's stock and saving its order: the order, or
 * the line that was short, or that the checkout lost its lock.
 */
export interface OrderCreation {
  order?: OrderDocument;
  failedItem?: ICartItem;
  lockLost?: boolean;
}

/** Result of trying to hold stock for every line of a checkout. */
export interface StockReservationResult {
  /** The first line that could not be reserved; nothing is held when set. */
  failedItem?: ICartItem;
}

/**
 * Where an unpaid order stands once checked with Kashia:
 * - `paid`: payment captured (the order has been confirmed)
 * - `cancelled`: the payment link failed or expired (the order has been cancelled)
 * - `pending`: still awaiting payment, or there is no link to check
 * - `unknown`: Kashia could not be reached
 */
export type PendingPaymentSettlement =
  | "paid"
  | "cancelled"
  | "pending"
  | "unknown";

export interface OrderTransitionOptions {
  /** Extra fields to set in the same atomic update as the status change. */
  set?: Record<string, unknown>;
  /** Extra conditions the order must still meet for the change to apply. */
  filter?: FilterQuery<OrderDocument>;
}

/** What one sweep of abandoned checkouts did. */
export interface AbandonedCheckoutSweepResult {
  /** Stale holds checked. */
  examined: number;
  /** Orders cancelled and their stock put back on sale. */
  released: number;
  /** False when the time budget ran out with holds left to check. */
  complete: boolean;
}
