/** Kashia marks a payment link completed once the buyer has paid successfully. */
export function isKashiaPaymentLinkPaid(status?: string): boolean {
  return status?.toLowerCase() === "completed";
}

export function isKashiaPaymentLinkFailed(status?: string): boolean {
  const normalized = status?.toLowerCase();
  return normalized === "expired" || normalized === "cancelled";
}
