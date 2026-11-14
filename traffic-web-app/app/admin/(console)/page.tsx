"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ShieldAlert,
  Store,
  Receipt,
  Tags,
} from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchAdminOrders,
  fetchAdminStores,
} from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import OrderStatusBadge from "@/components/account/order-status-badge";
import { formatOrderDate } from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
import type { OrderStatus } from "@/lib/types/api";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Store;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#484848]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[#030803]">{value}</p>
          {hint ? (
            <p className="mt-1 text-xs text-[#484848]">{hint}</p>
          ) : null}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-[#484848] group-hover:bg-[#030803] group-hover:text-white">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 flex items-center gap-1 text-xs font-medium text-traffik-pink">
        View details
        <ArrowRight className="h-3.5 w-3.5" />
      </p>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const storesQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_STORES, { page: 1, limit: 5 }] as const,
    queryFn: () => fetchAdminStores({ page: 1, limit: 5 }),
    enabled: isAuthenticated,
  });

  const pendingStoresQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_STORES, { page: 1, limit: 5, approved: false }] as const,
    queryFn: () => fetchAdminStores({ page: 1, limit: 5, approved: false }),
    enabled: isAuthenticated,
  });

  const ordersQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_ORDERS, { page: 1, limit: 5 }] as const,
    queryFn: () => fetchAdminOrders({ page: 1, limit: 5 }),
    enabled: isAuthenticated,
  });

  const isLoading =
    authLoading ||
    storesQuery.isLoading ||
    pendingStoresQuery.isLoading ||
    ordersQuery.isLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (storesQuery.error || pendingStoresQuery.error || ordersQuery.error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Could not load admin overview"
          onRetry={() => {
            void storesQuery.refetch();
            void pendingStoresQuery.refetch();
            void ordersQuery.refetch();
          }}
        />
      </div>
    );
  }

  const stores = storesQuery.data?.allStores ?? [];
  const totalStores = storesQuery.data?.meta.total ?? 0;
  const approvedOnPage = stores.filter((s) => s.isApproved).length;
  const pendingApprovalCount = pendingStoresQuery.data?.meta.total ?? 0;

  const recentOrders = ordersQuery.data?.items ?? [];
  const totalOrders = ordersQuery.data?.meta.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">
          Admin overview
        </h1>
        <p className="mt-1 text-sm text-[#484848]">
          Welcome back, {user?.firstName}. Monitor platform health and take action.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total stores"
          value={totalStores}
          hint={`${approvedOnPage} approved on this page`}
          icon={Store}
          href="/admin/stores"
        />
        <StatCard
          label="Pending approvals"
          value={pendingApprovalCount}
          hint="Stores awaiting verification"
          icon={ShieldAlert}
          href="/admin/kyc"
        />
        <StatCard
          label="Platform orders"
          value={totalOrders}
          hint="All fulfilment states"
          icon={Receipt}
          href="/admin/orders"
        />
        <StatCard
          label="Catalog"
          value="Manage"
          hint="Categories & vouchers"
          icon={Tags}
          href="/admin/categories"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#030803]">Recent stores</h2>
            <Link
              href="/admin/stores"
              className="text-sm font-medium text-traffik-pink hover:underline"
            >
              View all
            </Link>
          </div>
          {stores.length === 0 ? (
            <p className="text-sm text-[#484848]">No stores registered yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stores.slice(0, 5).map((store) => (
                <li
                  key={store._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#030803]">
                      {store.businessName}
                    </p>
                    <p className="text-xs text-[#484848]">
                      {store.totalOrders} orders · {store.totalItemsSold} items sold
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      store.isApproved
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {store.isApproved ? "Approved" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#030803]">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="text-sm font-medium text-traffik-pink hover:underline"
            >
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-[#484848]">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <li
                  key={order._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#030803]">
                      {order.orderRef ?? order._id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-[#484848]">
                      {formatOrderDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <OrderStatusBadge status={order.status as OrderStatus} />
                    <span className="text-sm font-semibold text-[#030803]">
                      {formatNaira(order.total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
