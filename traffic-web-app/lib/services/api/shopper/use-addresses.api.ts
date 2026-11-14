import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import type { Address } from "@/lib/types/api";
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from "./shopper.api";

export const shopperAddressKeys = {
  all: [QueryKeys.ADDRESSES] as const,
  list: () => [...shopperAddressKeys.all, "list"] as const,
};

export function useAddressesQuery(enabled = true) {
  return useQuery({
    queryKey: shopperAddressKeys.list(),
    queryFn: fetchAddresses,
    enabled,
  });
}

export function useCreateAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Address, "_id" | "userId">) => createAddress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperAddressKeys.all });
    },
  });
}

export function useUpdateAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Address>;
    }) => updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperAddressKeys.all });
    },
  });
}

export function useDeleteAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperAddressKeys.all });
    },
  });
}

export function useSetDefaultAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperAddressKeys.all });
    },
  });
}
