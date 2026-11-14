import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../../config/query-keys";
import type { OrderStatus } from "@/lib/types/api";
import {
  cancelOrder,
  confirmOrderDelivery,
  createOrder,
  fetchOrderById,
  fetchOrders,
  previewOrder,
  updateVendorOrderStatus,
  verifyOrderPayment,
  createOrderPaymentLink,
  reportRefundNotReceived,
} from "./shopper.api";

export const shopperOrderKeys = {
  all: [QueryKeys.ORDERS] as const,
  list: (params?: { page?: number; limit?: number; status?: OrderStatus }) =>
    [...shopperOrderKeys.all, "list", params] as const,
  detail: (id: string) => [...shopperOrderKeys.all, "detail", id] as const,
};

export function useOrdersQuery(params?: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}) {
  return useQuery({
    queryKey: shopperOrderKeys.list(params),
    queryFn: () => fetchOrders(params),
  });
}

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: shopperOrderKeys.detail(id),
    queryFn: () => fetchOrderById(id),
    enabled: !!id,
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.detail(id) });
    },
  });
}

export function usePreviewOrderMutation() {
  return useMutation({
    mutationFn: previewOrder,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.CART] });
    },
  });
}

export function useCreateOrderPaymentLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrderPaymentLink,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
    },
  });
}

export function useVerifyOrderPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: verifyOrderPayment,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.CART] });
    },
  });
}

export function useReportRefundNotReceivedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportRefundNotReceived,
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
    },
  });
}

export function useConfirmOrderDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmOrderDelivery,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: shopperOrderKeys.detail(id) });
    },
  });
}

export function useUpdateVendorOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      status,
      description,
    }: {
      orderId: string;
      status: OrderStatus;
      description: string;
    }) => updateVendorOrderStatus(orderId, { status, description }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.VENDOR_ORDERS] });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.VENDOR_ORDERS, variables.orderId],
      });
    },
  });
}
