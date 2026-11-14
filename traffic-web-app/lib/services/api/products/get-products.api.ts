import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import type { PaginatedData, Product } from "@/lib/types/api";
import type { ProductListParams } from "../catalog/products.api";
import { fetchProducts } from "../catalog/products.api";

const useGetProductsQuery = (
  page: number = 1,
  limit: number = 20,
  extra?: Omit<ProductListParams, "page" | "limit">,
) => {
  return useQuery({
    queryKey: [QueryKeys.PRODUCTS, { page, limit, ...extra }] as const,
    queryFn: () => fetchProducts({ page, limit, ...extra }),
  });
};

export default useGetProductsQuery;

export function useGetVendorProductsQuery(
  page: number = 1,
  limit: number = 20,
) {
  return useQuery({
    queryKey: [QueryKeys.VENDOR_PRODUCTS, { page, limit }] as const,
    queryFn: async (): Promise<PaginatedData<Product>> => {
      const res = await axiosInstance.get(QueryKeys.VENDOR_PRODUCTS, {
        params: { page, limit },
      });
      return unwrapAxios<PaginatedData<Product>>(res);
    },
  });
}
