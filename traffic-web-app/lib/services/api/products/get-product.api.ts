import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import type { Product } from "@/lib/types/api";
import { fetchProductById } from "../catalog/products.api";

const useGetProductQuery = (id: string) => {
  return useQuery({
    queryKey: [QueryKeys.PRODUCT, id] as const,
    queryFn: () => fetchProductById(id),
    enabled: !!id,
  });
};

export default useGetProductQuery;
export type { Product };
