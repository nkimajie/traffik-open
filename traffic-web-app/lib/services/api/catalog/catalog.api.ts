import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { QueryKeys } from "../../config/query-keys";
import type { Category, PaginatedData, Vendor } from "@/lib/types/api";

export async function fetchCategories(): Promise<Category[]> {
  const res = await axiosInstance.get(QueryKeys.CATEGORIES);
  return unwrapAxios<Category[]>(res);
}

export async function fetchPublicVendors(params?: {
  page?: number;
  limit?: number;
  q?: string;
}): Promise<PaginatedData<Vendor>> {
  const res = await axiosInstance.get(QueryKeys.VENDORS_PUBLIC, { params });
  return unwrapAxios<PaginatedData<Vendor>>(res);
}

export async function fetchTrendingVendors(): Promise<{ items: Vendor[] }> {
  const res = await axiosInstance.get(QueryKeys.VENDORS_PUBLIC_TRENDING);
  return unwrapAxios<{ items: Vendor[] }>(res);
}

export async function fetchPublicVendor(
  vendorId: string,
  params?: { page?: number; limit?: number; categoryId?: string },
): Promise<Vendor> {
  const res = await axiosInstance.get(
    `${QueryKeys.VENDOR_PUBLIC}/${vendorId}`,
    { params },
  );
  return unwrapAxios<Vendor>(res);
}

export async function searchCatalog(params: {
  q: string;
  type?: "products" | "vendors" | "all";
  page?: number;
  limit?: number;
}): Promise<{
  products?: PaginatedData<import("@/lib/types/api").Product>;
  vendors?: PaginatedData<Vendor>;
}> {
  const res = await axiosInstance.get(QueryKeys.SEARCH, { params });
  return unwrapAxios(res);
}
