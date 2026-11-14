"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "@/lib/context/providers/cart-provider";
import { useOrdersQuery } from "@/lib/services/api/shopper/use-orders.api";
import { useAddressesQuery } from "@/lib/services/api/shopper/use-addresses.api";
import { useSavedProductsQuery } from "@/lib/services/api/shopper/use-saved.api";
import { useProfileQuery } from "@/lib/services/api/shopper/use-profile.api";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNaira } from "@/lib/utils/format-price";
import {
  formatOrderDate,
  formatOrderNumber,
  getOrderItemImage,
  getOrderItemName,
  isOpenOrderStatus,
} from "@/lib/utils/order";
import type { Order } from "@/lib/types/api";

const summaryTiles = [
  {
    label: "Orders in progress",
    href: "/account/orders",
    icon: Package,
    color: "text-traffik-pink",
    bg: "bg-traffik-pink/10",
  },
  {
    label: "Items in cart",
    href: "/cart",
    icon: ShoppingBag,
    color: "text-traffik-amber",
    bg: "bg-traffik-amber/15",
  },
  {
    label: "Saved items",
    href: "/account/saved",
    icon: Heart,
    color: "text-traffik-pink",
    bg: "bg-traffik-pink/10",
  },
  {
    label: "Saved addresses",
    href: "/account/addresses",
    icon: MapPin,
    color: "text-traffik-green",
    bg: "bg-traffik-green/10",
  },
];

export default function AccountOverviewPage() {
  const { itemCount, hydrated } = useCart();
  const { data: profile } = useProfileQuery();
  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useOrdersQuery({ page: 1, limit: 50 });
  const { data: savedProductsData } = useSavedProductsQuery({ page: 1, limit: 1 });
  const { data: addresses } = useAddressesQuery();

  const orders = ordersData?.items ?? [];
  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    )
    .slice(0, 3);

  const counts = [
    orders.filter((order) => isOpenOrderStatus(order.status)).length,
    hydrated ? itemCount : 0,
    savedProductsData?.meta.total ?? 0,
    addresses?.length ?? 0,
  ];

  return (
    <div>
      <p className="text-lg text-[#484848]">
        Hi{" "}
        <span className="font-semibold text-[#030803]">
          {profile?.firstName ?? "there"}
        </span>
        , welcome back.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryTiles.map((tile, index) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ring-1 ring-gray-200/80"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tile.bg}`}
              >
                <Icon className={`h-5 w-5 ${tile.color}`} aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-bold text-[#030803]">
                {counts[index]}
              </p>
              <p className="mt-0.5 text-sm text-[#484848]">{tile.label}</p>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="recent-orders-heading" className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="recent-orders-heading"
            className="text-lg font-bold text-[#030803]"
          >
            Recent orders
          </h2>
          <Link
            href="/account/orders"
            className="text-sm font-medium text-traffik-pink hover:underline"
          >
            View all
          </Link>
        </div>

        {ordersLoading ? (
          <div className="mt-4">
            <OrderListSkeleton count={3} />
          </div>
        ) : ordersError ? (
          <div className="mt-4">
            <ErrorState onRetry={() => refetchOrders()} />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="When you place an order, it will show up here."
              actionLabel="Browse stores"
              actionHref="/stores"
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {recentOrders.map((order) => (
              <RecentOrderRow key={order._id} order={order} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  const item = order.items[0];
  if (!item) return null;

  return (
    <li>
      <Link
        href={`/account/orders/${order._id}`}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50 sm:p-5"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          <Image
            src={getOrderItemImage(item, item.productId)}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#030803]">
            {getOrderItemName(item)}
          </p>
          <p className="mt-0.5 text-xs text-[#484848]">
            Order #{formatOrderNumber(order)} ·{" "}
            {formatOrderDate(order.createdAt)}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <OrderStatusBadge status={order.status} />
          <p className="mt-1 text-sm font-bold text-[#030803]">
            {formatNaira(order.total)}
          </p>
        </div>
      </Link>
    </li>
  );
}
