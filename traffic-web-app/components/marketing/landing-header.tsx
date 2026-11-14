"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoBlack from "@/public/image/traffik-logo-black.png";

const navLinks = [
  { label: "For Vendors", href: "/vendors" },
  { label: "About", href: "/about" },
];

export default function LandingHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex-shrink-0">
          <Image
            src={logoBlack}
            alt="Traffik"
            width={140}
            height={40}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "bg-gray-100 text-[#030803]"
                  : "text-[#484848] hover:bg-gray-50 hover:text-[#030803]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/auth/sign-in"
            className="px-3 py-2 text-sm font-medium text-[#484848] transition-colors hover:text-[#030803]"
          >
            Sign In
          </Link>
          <Button variant="signIn" size="default" asChild>
            <Link href="/auth/sign-up">Start Selling</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-[#484848] md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium",
                  pathname === link.href
                    ? "bg-gray-100 text-[#030803]"
                    : "text-[#484848]",
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/sign-in"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#484848]"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
            <Button variant="signIn" size="lg" asChild className="mt-2 w-full">
              <Link href="/auth/sign-up" onClick={() => setMobileOpen(false)}>
                Start Selling
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
