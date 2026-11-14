"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logoImage from "@/public/image/traffik-logo-black.png";
import {
  VENDOR_DASHBOARD_NAV,
  type DashboardNavItem,
} from "@/lib/constants/dashboard-nav";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  navItems?: DashboardNavItem[];
  homeHref?: string;
  portalLabel?: string;
  helpTitle?: string;
  helpDescription?: string;
  className?: string;
};

export default function DashboardSidebar({
  navItems = VENDOR_DASHBOARD_NAV,
  homeHref = "/dashboard",
  portalLabel = "Vendor portal",
  helpTitle = "Need help?",
  helpDescription = "Our team verifies new stores and helps you get selling faster.",
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex w-[240px] shrink-0 flex-col border-r border-gray-200/80 bg-white lg:w-[260px]",
        className,
      )}
    >
      <div className="px-5 py-6">
        <Link href={homeHref} className="inline-flex items-center">
          <Image
            src={logoImage}
            alt="Traffik"
            width={130}
            height={34}
            className="h-7 w-auto"
            priority
          />
        </Link>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#484848]">
          {portalLabel}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-[#030803] text-white shadow-sm"
                  : "text-[#484848] hover:bg-gray-50 hover:text-[#030803]",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-traffik-pink via-traffik-amber to-traffik-green" />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-white" : "text-[#484848] group-hover:text-[#030803]",
                )}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 mb-5 mt-auto rounded-2xl bg-gradient-to-br from-traffik-pink/5 via-traffik-amber/5 to-traffik-green/5 p-4 ring-1 ring-gray-100">
        <p className="text-xs font-semibold text-[#030803]">{helpTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-[#484848]">
          {helpDescription}
        </p>
      </div>
    </aside>
  );
}
