/** Paging and category filter for a store's public storefront products. */
export interface PublicVendorStorefrontQuery {
  page?: number;
  limit?: number;
  categoryId?: string;
}
