"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { VENDOR_DASHBOARD_NAV } from "@/lib/constants/dashboard-nav";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/context/providers/auth-provider";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isVendor, user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isVendor && user && !user.isVerified) {
      router.replace("/create-business/step0");
    }
  }, [isLoading, isVendor, user, router]);

  return (
    <div className="flex min-h-screen bg-[#F4F4F5]">
      <DashboardSidebar className="hidden md:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />

        <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          {VENDOR_DASHBOARD_NAV.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                  isActive
                    ? "bg-[#030803] text-white"
                    : "bg-gray-100 text-[#484848]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
