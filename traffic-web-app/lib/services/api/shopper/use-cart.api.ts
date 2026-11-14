import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import {
  addCartItem,
  replaceCart,
  saveCartItemForLater,
  fetchCart,
  removeCartItem,
  updateCartItem,
  clearCart,
} from "./shopper.api";

export const shopperCartKeys = {
  all: [QueryKeys.CART] as const,
  detail: () => [...shopperCartKeys.all, "detail"] as const,
};

export function useCartQuery(enabled = true) {
  return useQuery({
    queryKey: shopperCartKeys.detail(),
    queryFn: fetchCart,
    enabled,
  });
}

export function useAddCartItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
    },
  });
}

export function useSaveCartItemForLaterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => saveCartItemForLater(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SAVED_PRODUCTS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
    },
  });
}

export function useReplaceCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replaceCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SAVED_PRODUCTS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
    },
  });
}

export function useUpdateCartItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: string;
      quantity: number;
    }) => updateCartItem(productId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
    },
  });
}

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => removeCartItem(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
    },
  });
}

export function useClearCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperCartKeys.all });
    },
  });
}
