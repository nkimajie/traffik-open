import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { QueryKeys } from "../../config/query-keys";
import type { PaginatedData, Product } from "@/lib/types/api";

export interface ProductListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  subcategoryId?: string;
  vendorId?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price-asc" | "price-desc" | "rating";
}

export async function fetchProducts(
  params: ProductListParams = {},
): Promise<PaginatedData<Product>> {
  const res = await axiosInstance.get(QueryKeys.PRODUCTS, { params });
  return unwrapAxios<PaginatedData<Product>>(res);
}

export async function fetchProductById(id: string): Promise<Product> {
  const res = await axiosInstance.get(`${QueryKeys.PRODUCT}/${id}`);
  return unwrapAxios<Product>(res);
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const res = await axiosInstance.get(QueryKeys.PRODUCTS_FEATURED);
  return unwrapAxios<Product[]>(res);
}

export async function fetchDealsProducts(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<Product>> {
  const res = await axiosInstance.get(QueryKeys.PRODUCTS_DEALS, { params });
  return unwrapAxios<PaginatedData<Product>>(res);
}

export async function fetchVendorProducts(
  vendorId: string,
  params?: { page?: number; limit?: number; categoryId?: string },
): Promise<PaginatedData<Product>> {
  const res = await axiosInstance.get(
    `/products/vendor/${vendorId}/products`,
    { params },
  );
  return unwrapAxios<PaginatedData<Product>>(res);
}
