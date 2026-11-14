export type ProductSortOption =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export interface ProductListFilters {
  categoryId?: string;
  subcategoryId?: string;
  vendorId?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSortOption;
}
