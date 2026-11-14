import type { LucideIcon } from "lucide-react";
import {
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

/** Vendor portal sidebar — shared shell pattern will reuse for admin later. */
export const VENDOR_DASHBOARD_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Product", href: "/dashboard/products", icon: Package },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt },
  { label: "Engagements", href: "/dashboard/engagements", icon: Heart },
];
