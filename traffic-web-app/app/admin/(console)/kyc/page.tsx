"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  fetchAdminKycQueue,
  fetchAdminStores,
  updateKycStatus,
  updateVendorApproval,
  type AdminStoreItem,
  type VendorKycRecord,
} from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const PAGE_SIZE = 10;

function kycStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function getKycByVendorId(records: VendorKycRecord[]) {
  const map = new Map<string, VendorKycRecord>();
  for (const record of records) {
    const vendorId =
      typeof record.vendor === "object" && record.vendor?._id
        ? record.vendor._id
        : String(record.vendor);
    const existing = map.get(vendorId);
    if (!existing || (record.createdAt ?? "") > (existing.createdAt ?? "")) {
      map.set(vendorId, record);
    }
  }
  return map;
}

export default function AdminKycPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  const pendingStoresQuery = useQuery({
    queryKey: [
      QueryKeys.ADMIN_STORES,
      { page, limit: PAGE_SIZE, approved: false },
    ] as const,
    queryFn: () =>
      fetchAdminStores({ page, limit: PAGE_SIZE, approved: false }),
    enabled: isAuthenticated && filter === "pending",
  });

  const allKycQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_KYC, { page, limit: PAGE_SIZE }] as const,
    queryFn: () => fetchAdminKycQueue({ page, limit: PAGE_SIZE }),
    enabled: isAuthenticated && filter === "all",
  });

  const kycLookupQuery = useQuery({
    queryKey: [QueryKeys.ADMIN_KYC, { page: 1, limit: 100 }] as const,
    queryFn: () => fetchAdminKycQueue({ page: 1, limit: 100 }),
    enabled: isAuthenticated && filter === "pending",
  });

  const mutation = useMutation({
    mutationFn: async ({
      vendorId,
      kycId,
      status,
      notes,
    }: {
      vendorId: string;
      kycId?: string;
      status: "approved" | "rejected";
      notes?: string;
    }) => {
      if (kycId && status === "approved") {
        return updateKycStatus(kycId, { status, notes });
      }
      if (kycId && status === "rejected") {
        return updateKycStatus(kycId, { status, notes });
      }
      return updateVendorApproval(vendorId, { status, notes });
    },
    onSuccess: (_, variables) => {
      handleSuccessToast({
        description:
          variables.status === "approved"
            ? "Store approved — vendor can now sell."
            : "Store rejected — vendor has been notified.",
      });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.ADMIN_KYC] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.ADMIN_STORES] });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  const isLoading =
    authLoading ||
    (filter === "pending"
      ? pendingStoresQuery.isLoading || kycLookupQuery.isLoading
      : allKycQuery.isLoading);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={5} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const kycByVendor = getKycByVendorId(kycLookupQuery.data?.items ?? []);
  const pendingStores = pendingStoresQuery.data?.allStores ?? [];
  const allKyc = allKycQuery.data?.items ?? [];
  const meta =
    filter === "pending" ? pendingStoresQuery.data?.meta : allKycQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const error =
    filter === "pending" ? pendingStoresQuery.error : allKycQuery.error;

  function handleReject(vendorId: string, kycId?: string) {
    const notes = window.prompt("Rejection reason (optional):") ?? undefined;
    mutation.mutate({ vendorId, kycId, status: "rejected", notes });
  }

  function renderPendingStore(store: AdminStoreItem) {
    const kyc = kycByVendor.get(store._id);
    const ownerName = [store.firstName, store.lastName].filter(Boolean).join(" ");

    return (
      <li
        key={store._id}
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              {store.storeLogo ? (
                <Image
                  src={store.storeLogo}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-[#484848]">
                  {store.businessName?.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#030803]">
                    {store.businessName}
                  </h2>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Awaiting approval
                  </span>
                  {kyc?.status === "pending" ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      KYC submitted
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-[#484848]">
                      KYC not submitted
                    </span>
                  )}
                </div>
                {store.email ? (
                  <p className="mt-1 text-sm text-[#484848]">{store.email}</p>
                ) : null}
                {ownerName ? (
                  <p className="text-sm text-[#484848]">{ownerName}</p>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-sm text-[#484848]">
              {store.businessCategory || "Uncategorized"} · Registered{" "}
              {store.createdAt
                ? new Date(store.createdAt).toLocaleDateString()
                : "—"}
            </p>

            {kyc?.status === "pending" ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[#484848]">Bank</dt>
                  <dd className="font-medium text-[#030803]">{kyc.bankName}</dd>
                </div>
                <div>
                  <dt className="text-[#484848]">Account number</dt>
                  <dd className="font-medium text-[#030803]">
                    {kyc.accountNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#484848]">Date of birth</dt>
                  <dd className="font-medium text-[#030803]">{kyc.dob}</dd>
                </div>
                <div>
                  <dt className="text-[#484848]">BVN</dt>
                  <dd className="font-medium text-[#030803]">{kyc.bvn}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#484848]">
                This vendor completed store signup and is waiting for Traffik to
                verify their store. You can approve them once verification is
                complete.
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  vendorId: store._id,
                  kycId: kyc?.status === "pending" ? kyc._id : undefined,
                  status: "approved",
                })
              }
            >
              Approve store
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                handleReject(
                  store._id,
                  kyc?.status === "pending" ? kyc._id : undefined,
                )
              }
            >
              Reject
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">
            KYC queue
          </h1>
          <p className="mt-1 text-sm text-[#484848]">
            Review new vendor stores awaiting approval to sell on Traffik.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter("pending");
              setPage(1);
            }}
          >
            Pending
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter("all");
              setPage(1);
            }}
          >
            KYC history
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Could not load approval queue"
          onRetry={() => {
            if (filter === "pending") {
              void pendingStoresQuery.refetch();
              void kycLookupQuery.refetch();
            } else {
              void allKycQuery.refetch();
            }
          }}
        />
      ) : filter === "pending" ? (
        !pendingStores.length ? (
          <EmptyState
            icon={ShieldCheck}
            title="No pending approvals"
            description="New vendor stores will appear here after they complete signup."
          />
        ) : (
          <>
            <ul className="space-y-4">
              {pendingStores.map(renderPendingStore)}
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
        )
      ) : !allKyc.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="No KYC submissions"
          description="KYC bank details will appear here when vendors submit them."
        />
      ) : (
        <>
          <ul className="space-y-4">
            {allKyc.map((kyc) => {
              const vendor = kyc.vendor;
              const vendorName =
                vendor?.businessName ||
                [vendor?.firstName, vendor?.lastName].filter(Boolean).join(" ") ||
                "Unknown vendor";

              return (
                <li
                  key={kyc._id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#030803]">
                      {vendorName}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${kycStatusClass(kyc.status)}`}
                    >
                      {kyc.status}
                    </span>
                  </div>
                  {vendor?.email ? (
                    <p className="mt-1 text-sm text-[#484848]">{vendor.email}</p>
                  ) : null}
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[#484848]">Bank</dt>
                      <dd className="font-medium text-[#030803]">{kyc.bankName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#484848]">Account number</dt>
                      <dd className="font-medium text-[#030803]">
                        {kyc.accountNumber}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
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
