export type OrderPaymentVerificationStatus =
  | "confirmed"
  | "already_confirmed"
  | "pending"
  | "failed";

export interface OrderPaymentVerificationResult {
  paymentStatus: OrderPaymentVerificationStatus;
  kashiaPaymentLinkStatus?: string;
}

/** Minimal payload for the public Kashia return page (no auth required). */
export interface PaymentReturnSummary {
  orderId: string;
  orderRef?: string;
  paymentStatus: OrderPaymentVerificationStatus;
  kashiaPaymentLinkStatus?: string;
}
