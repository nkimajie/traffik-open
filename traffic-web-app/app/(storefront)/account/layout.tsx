"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import AccountNav from "@/components/account/account-nav";
import { useAuth } from "@/lib/context/providers/auth-provider";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isShopper } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/sign-in?returnTo=/account");
    }
    if (!isLoading && isAuthenticated && !isShopper) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, isShopper, router]);

  if (isLoading || !isAuthenticated || !isShopper) {
    return null;
  }

  return (
    <div>
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "My account" }]} />
          <h1 className="mt-2 text-2xl font-bold text-[#030803] sm:text-3xl">
            My account
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <AccountNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
