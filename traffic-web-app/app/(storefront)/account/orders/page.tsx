"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { useOrdersQuery } from "@/lib/services/api/shopper/use-orders.api";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNaira } from "@/lib/utils/format-price";
import {
  formatOrderDate,
  formatOrderNumber,
  getOrderItemImage,
  getOrderItemName,
  getOrderItemVendorName,
  partitionOrders,
} from "@/lib/utils/order";
import type { Order } from "@/lib/types/api";

export default function AccountOrdersPage() {
  const [tab, setTab] = useState("open");
  const { data, isLoading, error, refetch } = useOrdersQuery({
    page: 1,
    limit: 100,
  });

  const { open, closed } = useMemo(
    () => partitionOrders(data?.items ?? []),
    [data?.items],
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-[#030803] sm:text-xl">My orders</h2>
      <p className="mt-1 text-sm text-[#484848]">
        Track open orders and view your order history.
      </p>

      {isLoading ? (
        <div className="mt-6">
          <OrderListSkeleton count={4} />
        </div>
      ) : error ? (
        <div className="mt-6">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            <OrderList orders={open} emptyMessage="No open orders right now." />
          </TabsContent>
          <TabsContent value="closed">
            <OrderList
              orders={closed}
              emptyMessage="No closed orders yet."
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function OrderList({
  orders,
  emptyMessage,
}: {
  orders: Order[];
  emptyMessage: string;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={emptyMessage}
        actionLabel="Browse stores"
        actionHref="/stores"
        className="mt-4"
      />
    );
  }

  return (
    <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
      {orders.map((order) => {
        const item = order.items[0];
        if (!item) return null;
        const extraCount = order.items.length - 1;

        return (
          <li key={order._id}>
            <Link
              href={`/account/orders/${order._id}`}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  <Image
                    src={getOrderItemImage(item, item.productId)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#030803]">
                    {getOrderItemName(item)}
                    {extraCount > 0 && (
                      <span className="font-normal text-[#484848]">
                        {" "}
                        +{extraCount} more
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-[#484848]">
                    {getOrderItemVendorName(item)}
                  </p>
                  <p className="mt-1 text-xs text-[#484848]">
                    Order #{formatOrderNumber(order)} · Qty {item.quantity} ·{" "}
                    {formatOrderDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <OrderStatusBadge status={order.status} />
                <p className="font-bold text-[#030803]">
                  {formatNaira(order.total)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
