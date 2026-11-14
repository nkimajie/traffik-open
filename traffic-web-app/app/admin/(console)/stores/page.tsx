"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchAdminStores } from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";

const PAGE_SIZE = 10;

export default function AdminStoresPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.ADMIN_STORES, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchAdminStores({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={6} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const stores = data?.allStores ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">Stores</h1>
        <p className="mt-1 text-sm text-[#484848]">
          All vendor stores on the platform, including pending approval.
        </p>
      </div>

      {error ? (
        <ErrorState title="Could not load stores" onRetry={() => refetch()} />
      ) : !stores.length ? (
        <EmptyState
          icon={Store}
          title="No stores yet"
          description="Vendor registrations will appear here."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/80 text-xs uppercase tracking-wide text-[#484848]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Store</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Orders</th>
                    <th className="px-5 py-3 font-semibold">Items sold</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stores.map((store) => (
                    <tr key={store._id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {store.storeLogo ? (
                            <Image
                              src={store.storeLogo}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xs font-semibold text-[#484848]">
                              {store.businessName?.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div>
                            <p className="font-medium text-[#030803]">
                              {store.businessName}
                            </p>
                            <p className="text-xs text-[#484848]">
                              Joined{" "}
                              {store.createdAt
                                ? new Date(store.createdAt).toLocaleDateString()
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#484848]">
                        {store.businessCategory || "—"}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#030803]">
                        {store.totalOrders}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#030803]">
                        {store.totalItemsSold}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            store.isApproved
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {store.isApproved ? "Approved" : "Pending KYC"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            store.isActive
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {store.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
