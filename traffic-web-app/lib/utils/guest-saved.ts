export type GuestSavedProduct = {
  productId: string;
  savedAt: number;
};

export const SAVED_STORAGE_KEY = "traffik-saved";

export function readGuestSavedProducts(): GuestSavedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SAVED_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as GuestSavedProduct[]) : [];
  } catch {
    return [];
  }
}

export function writeGuestSavedProducts(items: GuestSavedProduct[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(items));
}

export function isGuestProductSaved(productId: string): boolean {
  return readGuestSavedProducts().some((item) => item.productId === productId);
}

export function toggleGuestSavedProduct(productId: string): boolean {
  const current = readGuestSavedProducts();
  const exists = current.some((item) => item.productId === productId);

  if (exists) {
    writeGuestSavedProducts(
      current.filter((item) => item.productId !== productId),
    );
    return false;
  }

  writeGuestSavedProducts([
    { productId, savedAt: Date.now() },
    ...current,
  ]);
  return true;
}

export function clearGuestSavedStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAVED_STORAGE_KEY);
}
