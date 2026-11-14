"use client";

import Link from "next/link";
import {
  Heart,
  Package,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardQuickActionsProps = {
  canCreateProducts?: boolean;
};

const actions = [
  {
    label: "Add product",
    description: "List a new item",
    href: "/dashboard/products/new",
    icon: Package,
    accent: "from-traffik-pink/10 to-traffik-pink/5",
    requiresApproval: true,
  },
  {
    label: "View orders",
    description: "Manage sales",
    href: "/dashboard/transactions",
    icon: Receipt,
    accent: "from-traffik-amber/10 to-traffik-amber/5",
    requiresApproval: false,
  },
  {
    label: "Customers",
    description: "See who bought",
    href: "/dashboard/customers",
    icon: Users,
    accent: "from-traffik-green/10 to-traffik-green/5",
    requiresApproval: false,
  },
  {
    label: "Engagements",
    description: "Likes & saves",
    href: "/dashboard/engagements",
    icon: Heart,
    accent: "from-traffik-pink/10 to-traffik-green/10",
    requiresApproval: false,
  },
  {
    label: "Store settings",
    description: "Edit profile",
    href: "/dashboard/settings",
    icon: Settings,
    accent: "from-gray-100 to-gray-50",
    requiresApproval: false,
  },
] as const;

export default function DashboardQuickActions({
  canCreateProducts = false,
}: DashboardQuickActionsProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#030803]">Quick actions</h2>
        <Link
          href="/dashboard/products"
          className="text-xs font-medium text-traffik-pink hover:underline"
        >
          All products
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {actions.map((action) => {
          const disabled = action.requiresApproval && !canCreateProducts;
          const Icon = action.icon;

          const inner = (
            <>
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br",
                  action.accent,
                )}
              >
                <Icon className="h-4 w-4 text-[#030803]" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-[#030803]">{action.label}</p>
              <p className="mt-0.5 text-xs text-[#484848]">{action.description}</p>
              {disabled && (
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-traffik-amber">
                  After approval
                </p>
              )}
            </>
          );

          if (disabled) {
            return (
              <div
                key={action.href}
                className="cursor-not-allowed rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 opacity-70"
                title="Available after store verification"
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
