import type { Product, SavedProductsByStore } from "@/lib/types/api";

export function groupProductsByStore(products: Product[]): SavedProductsByStore[] {
  const groups = new Map<string, SavedProductsByStore>();

  for (const product of products) {
    const vendorId = product.vendorId ?? product.vendor?._id;
    if (!vendorId) continue;

    const existing = groups.get(vendorId);
    if (existing) {
      existing.products.push(product);
      existing.productCount = existing.products.length;
      continue;
    }

    groups.set(vendorId, {
      vendor: {
        _id: vendorId,
        businessName: product.vendor?.businessName ?? "Store",
        storeLogo: product.vendor?.storeLogo,
        storeCoverPhoto: product.vendor?.storeCoverPhoto,
        isVerified: product.vendor?.isApproved,
      },
      productCount: 1,
      products: [product],
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    (a.vendor.businessName ?? "").localeCompare(b.vendor.businessName ?? ""),
  );
}
