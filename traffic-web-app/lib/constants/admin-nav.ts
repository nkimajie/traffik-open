import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Store,
  ShieldCheck,
  Receipt,
  Tags,
  Ticket,
  Settings,
} from "lucide-react";
import type { DashboardNavItem } from "./dashboard-nav";

export const ADMIN_DASHBOARD_NAV: DashboardNavItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  { label: "Stores", href: "/admin/stores", icon: Store },
  { label: "KYC queue", href: "/admin/kyc", icon: ShieldCheck },
  { label: "Orders", href: "/admin/orders", icon: Receipt },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Vouchers", href: "/admin/vouchers", icon: Ticket },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export type { LucideIcon };
