import { OrderRefundPayoutMethod } from "../enums/order-refund.enum";

/**
 * How long after a refund is marked sent by hand the shopper can report that
 * the money never arrived. Bank transfers can take a few days to show.
 */
export const REFUND_NOT_RECEIVED_WINDOW_DAYS = 30;
export const REFUND_NOT_RECEIVED_WINDOW_MS =
  REFUND_NOT_RECEIVED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** How each manual payout method is described to the shopper. */
export const REFUND_PAYOUT_METHOD_LABELS: Record<
  OrderRefundPayoutMethod,
  string
> = {
  [OrderRefundPayoutMethod.KASHIA]: "Refunded through Kashia",
  [OrderRefundPayoutMethod.BANK_TRANSFER]: "Bank transfer",
  [OrderRefundPayoutMethod.OTHER]: "Other",
};
