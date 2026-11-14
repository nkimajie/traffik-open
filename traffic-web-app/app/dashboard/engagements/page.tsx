"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, Store } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchVendorDashboard } from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import DashboardStatCard from "@/components/dashboard/dashboard-stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";

export default function EngagementsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.VENDOR_DASHBOARD, "engagements"] as const,
    queryFn: () => fetchVendorDashboard(),
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Could not load engagement data"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const engagement = data?.engagement;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-2xl font-bold text-[#030803] sm:text-3xl">
        Engagements
      </h1>
      <p className="mb-6 text-sm text-[#484848]">
        See how shoppers interact with your store and products.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardStatCard
          label="Product favourites"
          value={String(engagement?.itemFavourites ?? 0)}
          icon={Heart}
        />
        <DashboardStatCard
          label="Store bookmarks this month"
          value={String(engagement?.monthlyStoreBookmarks ?? 0)}
          icon={Store}
        />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-[#030803]">
          Grow your reach
        </h2>
        <p className="text-sm text-[#484848]">
          Keep your catalog fresh and share your store link so shoppers can
          bookmark you and save products they love.
        </p>
        <Link
          href="/dashboard/products"
          className="mt-4 inline-flex text-sm font-medium text-traffik-pink hover:underline"
        >
          Manage products →
        </Link>
      </section>
    </div>
  );
}
