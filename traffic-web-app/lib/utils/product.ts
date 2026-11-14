import type { Product } from "@/lib/types/api";
import { discountPercent } from "@/lib/utils/format-price";

export function getProductImage(product: Product): string | null {
  return product.images?.[0] ?? null;
}

export function getProductPrice(product: Product): number {
  if (product.discount?.finalPrice != null) {
    return product.discount.finalPrice;
  }
  return product.amount;
}

export function getProductStock(product: Product): number {
  if (product.hasVariations && product.variations?.length) {
    return product.variations.reduce((sum, v) => sum + (v.quantity ?? 0), 0);
  }
  return product.defaultVariation?.quantity ?? 0;
}

export function getProductCategoryName(product: Product): string {
  return product.category?.name ?? "Uncategorized";
}

export function getProductDiscountPercent(product: Product): number {
  const finalPrice = getProductPrice(product);
  return discountPercent(product.amount, finalPrice);
}

export function productToCartShape(product: Product) {
  return {
    _id: product._id,
    name: product.name,
    amount: product.amount,
    discount: product.discount,
    images: product.images,
    vendorId: product.vendorId,
    vendor: product.vendor,
    defaultVariation: product.defaultVariation,
    hasVariations: product.hasVariations,
    variations: product.variations,
  };
}
