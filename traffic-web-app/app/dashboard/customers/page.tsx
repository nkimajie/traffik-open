"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchVendorCustomers,
  fetchVendorDashboard,
} from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { formatNaira } from "@/lib/utils/format-price";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

type CustomerRow = {
  userId: string;
  name: string;
  amount: number;
  lastTransaction?: string;
};

export default function CustomersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.VENDOR_CUSTOMERS, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchVendorCustomers({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated,
  });

  const { data: dashboardData } = useQuery({
    queryKey: [QueryKeys.VENDOR_DASHBOARD, "customers-fallback"] as const,
    queryFn: () => fetchVendorDashboard({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated && !isLoading && !data,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const paginated = data as
    | { items?: CustomerRow[]; meta?: { totalPages?: number } }
    | undefined;

  const fallbackCustomers = Array.isArray(dashboardData?.recentCustomers)
    ? dashboardData.recentCustomers
    : dashboardData?.recentCustomers?.items ?? [];

  const customers: CustomerRow[] =
    paginated?.items?.length
      ? paginated.items
      : (fallbackCustomers as CustomerRow[]);

  const totalPages = paginated?.meta?.totalPages ?? 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-[#030803] sm:text-3xl">
        Customers
      </h1>

      {error && customers.length === 0 ? (
        <ErrorState title="Could not load customers" onRetry={() => refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="When shoppers buy from your store, they'll appear here."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <ul className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <li
                  key={customer.userId}
                  className="flex items-center justify-between px-5 py-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#030803]">{customer.name}</p>
                    {customer.lastTransaction ? (
                      <p className="text-xs text-[#484848]">
                        Last order{" "}
                        {new Date(customer.lastTransaction).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-bold text-[#030803]">
                    {formatNaira(customer.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

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
      )}
    </div>
  );
}
