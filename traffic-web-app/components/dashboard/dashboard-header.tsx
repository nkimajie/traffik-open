"use client";

import { Bell, ChevronDown, LogOut, Search, Settings } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLink,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type DashboardHeaderProps = {
  showSearch?: boolean;
  searchPlaceholder?: string;
  settingsHref?: string;
  settingsLabel?: string;
};

export default function DashboardHeader({
  showSearch = true,
  searchPlaceholder = "Search products, customers…",
  settingsHref,
  settingsLabel = "Store settings",
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {showSearch ? (
          <div className="relative hidden min-w-0 flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-traffik-pink/70"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              className="h-11 rounded-2xl border-gray-200 bg-gray-50/80 pl-10 shadow-sm focus-visible:ring-traffik-pink/30"
              aria-label="Search dashboard"
            />
          </div>
        ) : (
          <div className="hidden flex-1 md:block" />
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-[#484848] shadow-sm transition-colors hover:bg-gray-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-traffik-pink ring-2 ring-white" />
          </button>

          <DropdownMenu
            trigger={
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-colors hover:bg-gray-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#030803] to-[#1a1a1a] text-xs font-semibold text-white">
                  {initials || "V"}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-[#030803] sm:block">
                  {user?.firstName} {user?.lastName}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
            }
          >
            {settingsHref ? (
              <>
                <DropdownMenuLink href={settingsHref}>
                  <Settings className="h-4 w-4" />
                  {settingsLabel}
                </DropdownMenuLink>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              className="text-red-600 hover:text-red-600"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
