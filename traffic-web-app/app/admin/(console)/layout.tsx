"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { ADMIN_DASHBOARD_NAV } from "@/lib/constants/admin-nav";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#F4F4F5]">
      <DashboardSidebar
        className="hidden md:flex"
        navItems={ADMIN_DASHBOARD_NAV}
        homeHref="/admin"
        portalLabel="Admin console"
        helpTitle="Platform control"
        helpDescription="Review stores, approve KYC, and manage orders across Traffik."
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          showSearch={false}
          searchPlaceholder="Search stores, orders…"
          settingsHref="/admin/settings"
          settingsLabel="Settings"
        />

        <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          {ADMIN_DASHBOARD_NAV.map((item) => {
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
