import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundStatus,
} from "../enums/order-refund.enum";
import {
  IOrderRefund,
  NewOrderRefund,
} from "../interfaces/order-refund.interface";

/** A refund as first stored: owed, with its opening recorded in its history. */
export function newRefundRecord(
  refund: NewOrderRefund,
  at: Date = new Date(),
): Omit<IOrderRefund, "_id"> {
  return {
    ...refund,
    status: OrderRefundStatus.REQUIRED,
    requestedAt: at,
    history: [
      {
        type: OrderRefundEventType.OPENED,
        actor: OrderRefundActor.SYSTEM,
        at,
        reason: refund.reason,
      },
    ],
  };
}

/**
 * Canonical form of a payout reference, so "trf 123/ab" and "TRF123/AB" are
 * recognised as the same payout.
 */
export function normalizePayoutReference(reference: string): string {
  return reference.replace(/\s+/g, "").toUpperCase();
}
