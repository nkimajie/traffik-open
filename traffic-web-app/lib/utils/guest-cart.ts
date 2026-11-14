export type GuestCartItem = {
  productId: string;
  variationId?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  vendorId: string;
  vendorName: string;
};

export const CART_STORAGE_KEY = "traffik-cart";

export function readGuestCartItems(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

export function clearGuestCartStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_STORAGE_KEY);
}
