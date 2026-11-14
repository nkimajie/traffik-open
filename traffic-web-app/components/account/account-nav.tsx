"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useProfileQuery } from "@/lib/services/api/shopper/use-profile.api";

const navItems = [
  { label: "Overview", href: "/account", icon: LayoutGrid, exact: true },
  { label: "My orders", href: "/account/orders", icon: Package },
  { label: "Saved items", href: "/account/saved", icon: Heart },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Settings", href: "/account/settings", icon: Settings },
];

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AccountNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: profile, isLoading } = useProfileQuery();

  const display = profile ?? user;
  const initials = display
    ? getInitials(display.firstName, display.lastName)
    : "??";

  return (
    <>
      <nav aria-label="Account" className="hidden lg:block">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm ring-1 ring-gray-200/80">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <Avatar size="lg">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {isLoading && !display ? (
                <>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1 h-3 w-36" />
                </>
              ) : (
                <>
                  <p className="truncate font-semibold text-[#030803]">
                    {display?.firstName} {display?.lastName}
                  </p>
                  <p className="truncate text-xs text-[#484848]">
                    {display?.email}
                  </p>
                </>
              )}
            </div>
          </div>

          <ul className="mt-3 space-y-0.5">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-traffik-pink/10 text-traffik-pink"
                        : "text-[#484848] hover:bg-gray-50 hover:text-[#030803]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Log out
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <nav
        aria-label="Account"
        className="flex gap-2 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#030803] text-white"
                  : "bg-gray-100 text-[#484848] hover:bg-gray-200",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
