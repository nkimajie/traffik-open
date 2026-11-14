import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import {
  fetchSavedProducts,
  fetchSavedProductsGrouped,
  fetchSavedStores,
  saveProduct,
  unsaveProduct,
} from "./shopper.api";

export const shopperSavedKeys = {
  products: (params?: { page?: number; limit?: number }) =>
    [QueryKeys.SAVED_PRODUCTS, params] as const,
  grouped: () => [QueryKeys.SAVED_PRODUCTS_GROUPED] as const,
  stores: (params?: { page?: number; limit?: number }) =>
    [QueryKeys.SAVED_STORES, params] as const,
};

export function useSavedProductsQuery(
  params?: { page?: number; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: shopperSavedKeys.products(params),
    queryFn: () => fetchSavedProducts(params),
    enabled,
  });
}

export function useSavedProductsGroupedQuery(enabled = true) {
  return useQuery({
    queryKey: shopperSavedKeys.grouped(),
    queryFn: fetchSavedProductsGrouped,
    enabled,
  });
}

export function useSavedStoresQuery(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: shopperSavedKeys.stores(params),
    queryFn: () => fetchSavedStores(params),
  });
}

export function useSaveProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SAVED_PRODUCTS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PRODUCTS] });
    },
  });
}

export function useUnsaveProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsaveProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SAVED_PRODUCTS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PRODUCTS] });
    },
  });
}
