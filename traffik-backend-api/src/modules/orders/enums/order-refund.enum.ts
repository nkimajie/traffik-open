/** Where a refund owed to the shopper stands. */
export enum OrderRefundStatus {
  /** Money was captured that must go back to the shopper; not yet returned. */
  REQUIRED = "REQUIRED",
  /** The money has been returned (confirmed by Kashia or by an admin). */
  REFUNDED = "REFUNDED",
}

/** Why the platform owes the shopper a refund. */
export enum OrderRefundReason {
  /** A paid order was cancelled (by the shopper or an admin). */
  ORDER_CANCELLED = "ORDER_CANCELLED",
  /** The store declined a paid order. */
  ORDER_REJECTED = "ORDER_REJECTED",
  /** Payment was captured after the order had already been cancelled. */
  PAID_AFTER_CANCELLATION = "PAID_AFTER_CANCELLATION",
  /** A second, separate payment was captured for an order that was already paid. */
  DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT",
}

/** Who confirmed that a refund was completed. */
export enum OrderRefundResolution {
  /** Kashia reported the escrow as refunded (`escrow.refunded` webhook). */
  KASHIA = "KASHIA",
  /** An admin confirmed the refund was made, e.g. from the Kashia dashboard. */
  ADMIN = "ADMIN",
}

/** How an admin returned the money when completing a refund by hand. */
export enum OrderRefundPayoutMethod {
  /** Refunded from the Kashia dashboard; Kashia should also confirm it. */
  KASHIA = "KASHIA",
  BANK_TRANSFER = "BANK_TRANSFER",
  OTHER = "OTHER",
}

/** Entries in a refund's append-only history. */
export enum OrderRefundEventType {
  OPENED = "OPENED",
  COMPLETED = "COMPLETED",
  /** Put back in the queue: an admin corrected a completion, or the shopper reported the money never arrived. */
  REOPENED = "REOPENED",
  /** Kashia reported the escrow refunded after an admin had already completed the refund by hand. */
  PROVIDER_REFUNDED = "PROVIDER_REFUNDED",
}

export enum OrderRefundActor {
  SYSTEM = "SYSTEM",
  KASHIA = "KASHIA",
  ADMIN = "ADMIN",
  SHOPPER = "SHOPPER",
}
