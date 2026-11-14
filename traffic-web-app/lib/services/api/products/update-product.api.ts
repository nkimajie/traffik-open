import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { queryClient } from "@/lib/services/config/query-client";
import { QueryKeys } from "../../config/query-keys";
import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import type { Product, ProductDiscount } from "@/lib/types/api";

export interface UpdateProductPayload {
  name?: string;
  amount?: number;
  categoryId?: string;
  subcategoryId?: string;
  images?: string[];
  description?: string;
  /** Only when the vendor changed the stock; send with `expectedQuantity`. */
  quantity?: number;
  /** The stock shown when the form was opened. */
  expectedQuantity?: number;
  discount?: ProductDiscount | null;
}

/** A stock change refused because orders moved the stock while editing. */
export interface ProductStockConflict {
  variationId?: string;
  name?: string;
  expectedQuantity: number;
  currentQuantity: number;
}

/** Carries the server's reason (e.g. STOCK_CHANGED) along with its message. */
export class ProductUpdateError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly conflicts: ProductStockConflict[] = [],
  ) {
    super(message);
    this.name = "ProductUpdateError";
  }
}

const updateProduct = async ({
  id,
  data,
}: {
  id: string;
  data: UpdateProductPayload;
}): Promise<Product> => {
  try {
    const res = await axiosInstance.post(`/products/vendor/edit/${id}`, data);
    return unwrapAxios<Product>(res);
  } catch (error) {
    if (isAxiosError(error) && error.response?.data) {
      const body = error.response.data as {
        message?: string | string[];
        code?: string;
        conflicts?: ProductStockConflict[];
      };
      const message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message;
      throw new ProductUpdateError(
        message || "Failed to update product.",
        body.code,
        body.conflicts,
      );
    }
    throw error;
  }
};

const useUpdateProductMutation = () => {
  return useMutation({
    mutationFn: updateProduct,
    onSuccess(_, variables) {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PRODUCTS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.VENDOR_PRODUCTS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.PRODUCT, variables.id],
      });
    },
  });
};

export default useUpdateProductMutation;
