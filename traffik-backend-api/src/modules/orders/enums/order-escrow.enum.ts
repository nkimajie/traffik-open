/** Kashia escrow lifecycle events that change where an order's money stands. */
export enum EscrowLifecycleEvent {
  AWAITING_CONFIRMATION = "awaiting_confirmation",
  COMPLETED = "completed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
}

/**
 * Escrow statuses an escrow does not leave. A later event reporting anything
 * else for the same escrow arrived out of order and must not overwrite them.
 */
export const TERMINAL_ESCROW_STATUSES: readonly string[] = [
  "completed",
  "refunded",
  "cancelled",
];

/** Situations where the money and the order disagree and a person must act. */
export enum OrderPaymentAlertType {
  /** The buyer disputed the payment on Kashia. */
  ESCROW_DISPUTED = "ESCROW_DISPUTED",
  /** The order's payment was returned after the store shipped it. */
  ESCROW_REVERSED_AFTER_SHIPPING = "ESCROW_REVERSED_AFTER_SHIPPING",
  /** Kashia cancelled a funded escrow; whether the shopper got the money back is unknown. */
  ESCROW_CANCELLED_AFTER_PAYMENT = "ESCROW_CANCELLED_AFTER_PAYMENT",
  /** Money was released to the store for an order that was cancelled or declined. */
  ESCROW_RELEASED_FOR_CANCELLED_ORDER = "ESCROW_RELEASED_FOR_CANCELLED_ORDER",
  /** Money was released to the store before the order was shipped. */
  ESCROW_RELEASED_BEFORE_SHIPPING = "ESCROW_RELEASED_BEFORE_SHIPPING",
  /** A payment the order does not use (e.g. a duplicate) was released to the store. */
  OTHER_ESCROW_RELEASED = "OTHER_ESCROW_RELEASED",
}
