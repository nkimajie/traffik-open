"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchVendorOrders } from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { formatOrderDate } from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import type { Order, OrderStatus } from "@/lib/types/api";

const PAGE_SIZE = 10;

export default function VendorOrdersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.VENDOR_ORDERS, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchVendorOrders({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="p-8">
        <OrderListSkeleton count={5} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const orders = data?.items ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1 mb-8">
          Orders containing products from your store.
        </p>

        {isLoading ? (
          <OrderListSkeleton count={5} />
        ) : error ? (
          <ErrorState
            title="Could not load orders"
            onRetry={() => refetch()}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No orders yet"
            description="When customers buy your products, orders will appear here."
          />
        ) : (
          <>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {orders.map((order) => (
                <VendorOrderRow key={order._id} order={order} />
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
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
        )}
      </div>
    </div>
  );
}

function VendorOrderRow({ order }: { order: Order }) {
  const item = order.items[0];
  const extraCount = order.items.length - 1;
  const imageSrc =
    item?.images?.[0] ??
    "https://picsum.photos/seed/product/64/64";

  return (
    <li>
      <Link
        href={`/dashboard/orders/${order._id}`}
        className="flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:p-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {item?.name ?? "Order item"}
              {extraCount > 0 && (
                <span className="font-normal text-gray-600">
                  {" "}
                  +{extraCount} more
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
              {order.createdAt ? formatOrderDate(order.createdAt) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <OrderStatusBadge status={order.status as OrderStatus} />
          <p className="font-bold text-gray-900">{formatNaira(order.total)}</p>
        </div>
      </Link>
    </li>
  );
}
