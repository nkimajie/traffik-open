"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchVendorOrders,
  fetchVendorTransactions,
} from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { formatOrderDate } from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types/api";

const PAGE_SIZE = 10;

export default function TransactionsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);

  const transactionsQuery = useQuery({
    queryKey: [QueryKeys.VENDOR_TRANSACTIONS, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchVendorTransactions({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: [QueryKeys.VENDOR_ORDERS, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchVendorOrders({ page, limit: PAGE_SIZE }),
    enabled:
      isAuthenticated &&
      (transactionsQuery.isError ||
        !(transactionsQuery.data as { items?: unknown[] } | undefined)?.items
          ?.length),
  });

  const isLoading = transactionsQuery.isLoading || ordersQuery.isLoading;
  const useOrders =
    transactionsQuery.isError ||
    !(transactionsQuery.data as { items?: unknown[] } | undefined)?.items?.length;

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={5} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const orders = (useOrders ? ordersQuery.data?.items : []) as Order[] | undefined;
  const meta = useOrders ? ordersQuery.data?.meta : undefined;
  const totalPages = meta?.totalPages ?? 1;
  const txItems = (transactionsQuery.data as { items?: unknown[] } | undefined)
    ?.items;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-[#030803] sm:text-3xl">
        Transactions
      </h1>

      {useOrders ? (
        ordersQuery.error && !orders?.length ? (
          <ErrorState
            title="Could not load transactions"
            onRetry={() => ordersQuery.refetch()}
          />
        ) : !orders?.length ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Orders and payouts from your store will show up here."
          />
        ) : (
          <>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {orders.map((order) => (
                <li key={order._id}>
                  <Link
                    href={`/dashboard/orders/${order._id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#030803]">
                        {order.orderRef ?? order._id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-[#484848]">
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="font-bold text-[#030803]">
                        {formatNaira(order.total)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm text-[#484848]">
            {txItems?.length ?? 0} transaction records
          </p>
          <pre className="overflow-auto rounded-xl bg-gray-50 p-4 text-xs text-[#484848]">
            {JSON.stringify(transactionsQuery.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
