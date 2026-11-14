"use client";

import { useAuth } from "@/lib/context/providers/auth-provider";
import VendorStoreSettingsForm from "@/components/features/VendorStoreSettingsForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold text-[#030803] sm:text-3xl">
          Store settings
        </h1>
        <p className="mb-8 text-sm text-[#484848]">
          Update your store profile and business details.
        </p>

        <div className="bg-white rounded-lg shadow p-6">
          <VendorStoreSettingsForm />
        </div>
      </div>
    </div>
  );
}
