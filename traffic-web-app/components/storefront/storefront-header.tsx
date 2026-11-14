"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLink,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/context/providers/cart-provider";
import { useAuth } from "@/lib/context/providers/auth-provider";
import logoBlack from "@/public/image/traffik-logo-black.png";

const shopNavLinks = [
  { label: "Stores", href: "/stores" },
  { label: "Deals", href: "/deals" },
];

const companyNavLinks = [
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  pathname,
  className,
}: {
  href: string;
  label: string;
  pathname: string;
  className?: string;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "text-traffik-pink"
          : "text-[#484848] hover:text-[#030803]",
        className,
      )}
    >
      {label}
    </Link>
  );
}

function AccountDropdown() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-gray-100"
          aria-label="My account menu"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[100px] truncate text-sm font-medium text-[#030803] lg:inline">
            {user.firstName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[#484848]" aria-hidden />
        </button>
      }
    >
      <DropdownMenuLink href="/account">
        <LayoutGrid className="h-4 w-4" />
        Overview
      </DropdownMenuLink>
      <DropdownMenuLink href="/account/orders">
        <Package className="h-4 w-4" />
        My orders
      </DropdownMenuLink>
      <DropdownMenuLink href="/account/saved">
        <Heart className="h-4 w-4" />
        Saved items
      </DropdownMenuLink>
      <DropdownMenuLink href="/account/addresses">
        <MapPin className="h-4 w-4" />
        Addresses
      </DropdownMenuLink>
      <DropdownMenuLink href="/account/settings">
        <Settings className="h-4 w-4" />
        Settings
      </DropdownMenuLink>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={logout}
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </DropdownMenuItem>
    </DropdownMenu>
  );
}

export default function StorefrontHeader() {
  const pathname = usePathname();
  const { itemCount, hydrated } = useCart();
  const { isAuthenticated, isShopper, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);

  const showShopperAccount = !isLoading && isAuthenticated && isShopper;

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="hidden border-b border-gray-100 bg-gray-50/80 lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <nav aria-label="Company" className="flex items-center gap-1">
            {companyNavLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                pathname={pathname}
                className="px-2.5 py-1 text-xs"
              />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <NavLink
              href="/vendors/sign-in"
              label="Sell on Traffik"
              pathname={pathname}
              className="px-2.5 py-1 text-xs font-semibold"
            />
            {!showShopperAccount && (
              <>
                <span className="text-gray-300" aria-hidden>
                  |
                </span>
                <Link
                  href="/sign-in"
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#484848] transition-colors hover:text-[#030803]"
                >
                  Sign in
                </Link>
              </>
            )}
            {showShopperAccount && <AccountDropdown />}
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex-shrink-0">
          <Image
            src={logoBlack}
            alt="Traffik"
            width={120}
            height={32}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav aria-label="Shop" className="hidden items-center gap-0.5 md:flex">
          {shopNavLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="hidden h-6 w-px bg-gray-200 md:block" aria-hidden />

        <Link
          href="/search"
          className="hidden min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-50 px-4 py-2 text-sm text-[#484848] ring-1 ring-gray-200/80 transition-colors hover:bg-gray-100 md:flex lg:max-w-sm xl:max-w-md"
        >
          <Search className="h-4 w-4 shrink-0 text-traffik-pink" aria-hidden />
          <span className="truncate">Search products, stores, markets…</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#484848] transition-colors hover:bg-gray-100 md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setZoneOpen((open) => !open)}
              className="flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-sm ring-1 ring-gray-200/80 transition-colors hover:bg-gray-100"
              aria-expanded={zoneOpen}
            >
              <MapPin className="h-3.5 w-3.5 text-traffik-pink" aria-hidden />
              <span className="hidden font-medium text-[#030803] lg:inline">
                All Nigeria
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#484848]" aria-hidden />
            </button>
            {zoneOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close location menu"
                  onClick={() => setZoneOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                  <p className="text-sm font-semibold text-[#030803]">
                    Markets across Nigeria
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#484848]">
                    Balogun, Ariaria, Kurmi, Onitsha, Gbagi, Wuse, and more.
                  </p>
                  <Link
                    href="/stores"
                    className="mt-3 inline-block text-xs font-semibold text-traffik-pink hover:underline"
                    onClick={() => setZoneOpen(false)}
                  >
                    Browse all stores →
                  </Link>
                </div>
              </>
            )}
          </div>

          <Link
            href="/cart"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#484848] transition-colors hover:bg-gray-100 sm:h-10 sm:w-10"
            aria-label={
              hydrated && itemCount > 0 ? `Cart, ${itemCount} items` : "Cart"
            }
          >
            <ShoppingBag className="h-5 w-5" />
            {hydrated && itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-traffik-pink px-1 text-[10px] font-bold text-white">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>

          {showShopperAccount ? (
            <div className="hidden sm:block">
              <AccountDropdown />
            </div>
          ) : (
            <Button
              variant="signIn"
              size="sm"
              asChild
              className="hidden rounded-full px-4 sm:inline-flex"
            >
              <Link href="/vendors/sign-up">
                <Store className="mr-1.5 h-3.5 w-3.5" />
                Start selling
              </Link>
            </Button>
          )}

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#484848] lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 lg:hidden">
          <div className="space-y-5">
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#484848]/60">
                Shop
              </p>
              <nav className="mt-1 flex flex-col gap-0.5">
                {shopNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive(pathname, link.href)
                        ? "bg-traffik-pink/10 text-traffik-pink"
                        : "text-[#484848] hover:bg-gray-50",
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/search"
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Search
                </Link>
                <Link
                  href="/cart"
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Cart
                </Link>
              </nav>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#484848]/60">
                Learn
              </p>
              <nav className="mt-1 flex flex-col gap-0.5">
                {companyNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive(pathname, link.href)
                        ? "bg-traffik-pink/10 text-traffik-pink"
                        : "text-[#484848] hover:bg-gray-50",
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#484848]/60">
                Account
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {showShopperAccount ? (
                  <>
                    <Link
                      href="/account"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      My account
                    </Link>
                    <Link
                      href="/account/orders"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      My orders
                    </Link>
                    <Link
                      href="/account/saved"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      Saved items
                    </Link>
                    <Link
                      href="/account/settings"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setMobileOpen(false);
                        logout();
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/vendors/sign-in"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sell on Traffik
                    </Link>
                    <Link
                      href="/sign-in"
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848] hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Button variant="signIn" size="lg" asChild className="mt-2 w-full rounded-xl">
                      <Link href="/vendors/sign-up" onClick={() => setMobileOpen(false)}>
                        Start selling
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
