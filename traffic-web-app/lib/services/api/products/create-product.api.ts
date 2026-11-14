import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/services/config/query-client";
import { QueryKeys } from "../../config/query-keys";
import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import type { Product, ProductDiscount } from "@/lib/types/api";

export interface CreateProductPayload {
  name: string;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  images: string[];
  description?: string;
  quantity?: number;
  discount?: ProductDiscount;
}

const createProduct = async (data: CreateProductPayload): Promise<Product> => {
  const res = await axiosInstance.post(QueryKeys.PRODUCTS, data);
  return unwrapAxios<Product>(res);
};

const useCreateProductMutation = () => {
  return useMutation({
    mutationFn: createProduct,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PRODUCTS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.VENDOR_PRODUCTS] });
    },
  });
};

export default useCreateProductMutation;
