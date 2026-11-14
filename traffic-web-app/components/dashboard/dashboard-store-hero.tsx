"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldAlert, ShieldCheck, Settings } from "lucide-react";
import type { Vendor } from "@/lib/types/api";
import { cn } from "@/lib/utils";

type DashboardStoreHeroProps = {
  vendor: Vendor;
  userName?: string;
};

export default function DashboardStoreHero({
  vendor,
  userName,
}: DashboardStoreHeroProps) {
  const storeName = vendor.businessName?.trim() || "Your store";
  const isApproved = vendor.isApproved === true;
  const cover = vendor.storeCoverPhoto;
  const logo = vendor.storeLogo;

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-32 sm:h-40">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-traffik-pink/25 via-traffik-amber/20 to-traffik-green/25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030803]/70 via-[#030803]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green" />

        <div className="absolute bottom-4 left-5 right-5 sm:left-6 sm:right-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Vendor dashboard
          </p>
          <h1 className="mt-1 truncate text-2xl font-bold text-white sm:text-3xl">
            {storeName}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {userName ? `Good to see you, ${userName}` : "Welcome back"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative -mt-14 h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg sm:-mt-16 sm:h-20 sm:w-20">
            {logo ? (
              <Image
                src={logo}
                alt={storeName}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-traffik-pink/10 to-traffik-green/10 text-xl font-bold text-[#030803]">
                {storeName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 pt-1 sm:pt-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                isApproved
                  ? "bg-traffik-green/15 text-traffik-green"
                  : "bg-traffik-amber/15 text-[#030803]",
              )}
            >
              {isApproved ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-traffik-amber" />
              )}
              {isApproved ? "Verified store" : "Verification pending"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!isApproved && (
            <Link
              href="/create-business/step2"
              className="inline-flex items-center gap-1.5 rounded-xl bg-traffik-amber/15 px-3.5 py-2 text-xs font-semibold text-[#030803] transition-colors hover:bg-traffik-amber/25"
            >
              Verification status
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-[#484848] transition-colors hover:border-gray-300 hover:text-[#030803]"
          >
            <Settings className="h-3.5 w-3.5" />
            Store settings
          </Link>
        </div>
      </div>

      {!isApproved && (
        <div className="border-t border-traffik-amber/20 bg-gradient-to-r from-traffik-amber/8 to-transparent px-5 py-3.5 sm:px-6">
          <p className="text-sm text-[#484848]">
            <span className="font-semibold text-[#030803]">
              A Traffik agent will contact you
            </span>{" "}
            to verify your store. You can explore the dashboard now — product
            listing unlocks after approval.
          </p>
        </div>
      )}
    </section>
  );
}
