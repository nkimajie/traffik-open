import type { Vendor, VendorSummary } from "@/lib/types/api";

export type VendorCategoryRef = { _id: string; name: string };

/** Populated category refs from API, or legacy businessCategory string. */
export function getVendorCategoryLabels(
  vendor: Vendor | VendorSummary,
): string[] {
  const populated = vendor.businessCategories;
  if (Array.isArray(populated) && populated.length > 0) {
    return populated.map((entry) =>
      typeof entry === "string" ? entry : entry.name,
    );
  }
  return vendor.businessCategory ? [vendor.businessCategory] : [];
}

export function getVendorPrimaryCategoryLabel(
  vendor: Vendor | VendorSummary,
): string | undefined {
  return getVendorCategoryLabels(vendor)[0];
}

export function vendorMatchesCategoryFilter(
  vendor: Vendor | VendorSummary,
  categoryName: string,
): boolean {
  return getVendorCategoryLabels(vendor).includes(categoryName);
}
