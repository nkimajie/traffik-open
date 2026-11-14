import type { CartVendorSummary } from "@/lib/types/api";

export const CART_VENDOR_CONFLICT = "CART_VENDOR_CONFLICT";

export interface CartVendorConflict {
  code: typeof CART_VENDOR_CONFLICT;
  currentVendor: CartVendorSummary;
  incomingVendor: CartVendorSummary;
  incomingProductId: string;
  incomingVariationId?: string;
  incomingQuantity: number;
}

export class CartVendorConflictError extends Error {
  readonly conflict: CartVendorConflict;

  constructor(conflict: CartVendorConflict, message?: string) {
    super(message ?? "Cart belongs to a different store");
    this.name = "CartVendorConflictError";
    this.conflict = conflict;
  }
}

export function isCartVendorConflictError(
  error: unknown,
): error is CartVendorConflictError {
  return error instanceof CartVendorConflictError;
}

export function parseCartVendorConflict(error: unknown): CartVendorConflict | null {
  if (isCartVendorConflictError(error)) {
    return error.conflict;
  }

  const response = (error as { response?: { data?: unknown } })?.response?.data;
  if (!response || typeof response !== "object") return null;

  const data = (response as { data?: unknown }).data;
  if (
    data &&
    typeof data === "object" &&
    (data as CartVendorConflict).code === CART_VENDOR_CONFLICT
  ) {
    return data as CartVendorConflict;
  }

  return null;
}
