"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
} from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { formatOrderDate, getOrderStatusLabel } from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
import { Button } from "@/components/ui/button";
import AdminOrderRefunds from "@/components/admin/admin-order-refunds";
import AdminOrderPaymentAlerts from "@/components/admin/admin-order-payment-alerts";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import type { OrderRefundStatus, OrderStatus } from "@/lib/types/api";

const PAGE_SIZE = 10;

const ADMIN_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const REFUND_FILTERS: { value: OrderRefundStatus; label: string }[] = [
  { value: "REQUIRED", label: "Refund to make" },
  { value: "REFUNDED", label: "Refunded" },
];

export default function AdminOrdersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [refundFilter, setRefundFilter] = useState<OrderRefundStatus | "">("");
  const [openAlertsOnly, setOpenAlertsOnly] = useState(false);
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      QueryKeys.ADMIN_ORDERS,
      {
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        refundStatus: refundFilter || undefined,
        alerts: openAlertsOnly ? "OPEN" : undefined,
      },
    ] as const,
    queryFn: () =>
      fetchAdminOrders({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        refundStatus: refundFilter || undefined,
        alerts: openAlertsOnly ? "OPEN" : undefined,
      }),
    enabled: isAuthenticated,
  });

  const mutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: OrderStatus;
    }) =>
      updateAdminOrderStatus(orderId, {
        status,
        description: `Status updated to ${getOrderStatusLabel(status)} by admin`,
      }),
    onSuccess: () => {
      handleSuccessToast({ description: "Order status updated." });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.ADMIN_ORDERS] });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={5} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const orders = data?.items ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-[#484848]">
            Fulfilment control across all stores on Traffik.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#030803]"
          >
            <option value="">All statuses</option>
            {ADMIN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
          <select
            value={refundFilter}
            onChange={(e) => {
              setRefundFilter(e.target.value as OrderRefundStatus | "");
              setPage(1);
            }}
            aria-label="Filter by refund"
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#030803]"
          >
            <option value="">All refunds</option>
            {REFUND_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#030803]">
            <input
              type="checkbox"
              checked={openAlertsOnly}
              onChange={(e) => {
                setOpenAlertsOnly(e.target.checked);
                setPage(1);
              }}
            />
            Payment alerts to resolve
          </label>
        </div>
      </div>

      {error ? (
        <ErrorState title="Could not load orders" onRetry={() => refetch()} />
      ) : !orders.length ? (
        <EmptyState
          icon={Receipt}
          title="No orders found"
          description="Platform orders will appear here as shoppers check out."
        />
      ) : (
        <>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {orders.map((order) => (
              <li key={order._id} className="px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#030803]">
                        {order.orderRef ?? order._id.slice(-8).toUpperCase()}
                      </p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#484848]">
                      {formatOrderDate(order.createdAt)} · {order.items.length}{" "}
                      item{order.items.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#030803]">
                      {formatNaira(order.total)}
                    </p>
                    <AdminOrderPaymentAlerts order={order} />
                    <AdminOrderRefunds order={order} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {ADMIN_STATUSES.filter((s) => s !== order.status).map(
                      (nextStatus) => (
                        <Button
                          key={nextStatus}
                          variant="outline"
                          size="sm"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              orderId: order._id,
                              status: nextStatus,
                            })
                          }
                        >
                          Mark {getOrderStatusLabel(nextStatus)}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-[#484848]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
