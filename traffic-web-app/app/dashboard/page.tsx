"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchVendorDashboard } from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { formatNaira } from "@/lib/utils/format-price";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import { useGetVendorProductsQuery } from "@/lib/services/api/products/get-products.api";
import DashboardStoreHero from "@/components/dashboard/dashboard-store-hero";
import DashboardMetricsBento from "@/components/dashboard/dashboard-metrics-bento";
import DashboardQuickActions from "@/components/dashboard/dashboard-quick-actions";
import DashboardGettingStarted from "@/components/dashboard/dashboard-getting-started";
import DashboardHomeSections from "@/components/dashboard/dashboard-home-sections";

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-36 sm:col-span-2 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-24 sm:col-span-2 rounded-2xl" />
      </div>
    </div>
  );
}

/** Decorative week bars scaled from revenue + profit values. */
function buildWeekBars(revenue: number, profits: number) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const seed = Math.max(revenue, profits, 1);
  const values = days.map((label, i) => ({
    label,
    value: Math.round((seed / 7) * (0.6 + ((i * 13) % 7) / 10)),
  }));
  const max = Math.max(...values.map((v) => v.value), 1);
  return values.map((v) => ({ ...v, max }));
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: vendorProfile, isLoading: profileLoading } = useVendorProfile();

  const { data: productsPage } = useGetVendorProductsQuery(1, 1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.VENDOR_DASHBOARD] as const,
    queryFn: () => fetchVendorDashboard(),
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading || profileLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated || !vendorProfile) {
    return null;
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Could not load dashboard"
          message="We couldn't fetch your store metrics. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const summary = data?.summary;
  const engagement = data?.engagement;
  const canCreateProducts = vendorProfile.isApproved === true;
  const revenueValue = summary?.revenue?.value ?? 0;
  const profitsValue = summary?.profits?.value ?? 0;

  const recentCustomers = Array.isArray(data?.recentCustomers)
    ? data.recentCustomers
    : data?.recentCustomers?.items ?? [];

  const topPerformers = data?.topPerformers ?? [];
  const hasProducts = (productsPage?.meta?.total ?? productsPage?.items?.length ?? 0) > 0;
  const allOnboardingComplete =
    vendorProfile.isSignupCompleted &&
    canCreateProducts &&
    hasProducts;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <DashboardStoreHero vendor={vendorProfile} userName={user?.firstName} />

      <DashboardMetricsBento
        revenue={{
          value: formatNaira(revenueValue),
          change: summary?.revenue
            ? `${summary.revenue.isIncrease ? "+" : "-"}${summary.revenue.percentageChange?.toFixed(1) ?? 0}%`
            : null,
          positive: summary?.revenue?.isIncrease !== false,
          bars: buildWeekBars(revenueValue, profitsValue),
        }}
        balance={formatNaira(summary?.availableBalance?.value ?? 0)}
        profits={{
          value: formatNaira(profitsValue),
          change: summary?.profits
            ? `${summary.profits.isIncrease ? "+" : "-"}${summary.profits.percentageChange?.toFixed(1) ?? 0}%`
            : null,
          positive: summary?.profits?.isIncrease !== false,
        }}
        favourites={String(engagement?.itemFavourites ?? 0)}
        bookmarks={String(engagement?.monthlyStoreBookmarks ?? 0)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div
          className={`space-y-6 ${allOnboardingComplete ? "xl:col-span-12" : "xl:col-span-8"}`}
        >
          <DashboardQuickActions canCreateProducts={canCreateProducts} />
          <DashboardHomeSections
            topPerformers={topPerformers}
            recentCustomers={recentCustomers}
            canCreateProducts={canCreateProducts}
          />
        </div>

        {!allOnboardingComplete && (
          <div className="xl:col-span-4">
            <DashboardGettingStarted
              signupComplete={vendorProfile.isSignupCompleted === true}
              isApproved={canCreateProducts}
              canCreateProducts={canCreateProducts}
              hasProducts={hasProducts}
            />
          </div>
        )}
      </div>
    </div>
  );
}
