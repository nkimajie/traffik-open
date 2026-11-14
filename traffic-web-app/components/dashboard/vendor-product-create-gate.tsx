"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import PendingApprovalNotice from "@/components/dashboard/pending-approval-notice";

type VendorProductCreateGateProps = {
  children: ReactNode;
};

/** Renders children only when the vendor store is approved; otherwise shows pending notice. */
export default function VendorProductCreateGate({
  children,
}: VendorProductCreateGateProps) {
  const { data: vendor, isLoading } = useVendorProfile();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (vendor && !vendor.isApproved) {
    return (
      <PendingApprovalNotice email={vendor.email} />
    );
  }

  return children;
}
