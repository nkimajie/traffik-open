"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, ShieldCheck, Tag } from "lucide-react";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import { fetchDealsProducts } from "@/lib/services/api/catalog/products.api";
import type { Product } from "@/lib/types/api";
import {
  getProductCategoryName,
  getProductDiscountPercent,
} from "@/lib/utils/product";
import { Skeleton } from "@/components/ui/skeleton";

function getMaxDealDiscount(deals: Product[]): number {
  if (deals.length === 0) return 0;
  return Math.max(...deals.map(getProductDiscountPercent));
}

export default function DealsHero() {
  const { data, isLoading } = useQuery({
    queryKey: ["products-deals", { hero: true }],
    queryFn: () => fetchDealsProducts({ page: 1, limit: 100 }),
  });

  const deals = useMemo(() => data?.items ?? [], [data?.items]);

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(deals.map((deal) => getProductCategoryName(deal))),
    ).filter((name) => name !== "Uncategorized");
    return names.sort();
  }, [deals]);

  const maxDiscount = getMaxDealDiscount(deals);

  return (
    <section className="relative overflow-hidden bg-[#030803]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-traffik-amber/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-traffik-pink/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Deals" }]}
          className="mb-6 [&_a]:text-white/60 [&_a:hover]:text-white [&_span]:text-white [&_svg]:text-white/40"
        />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-traffik-amber/30 bg-traffik-amber/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-traffik-amber backdrop-blur-sm">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              Today&apos;s deals
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Save on market finds —{" "}
              <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
                {isLoading ? (
                  <span className="inline-block h-10 w-32 animate-pulse rounded bg-white/10 align-middle" />
                ) : maxDiscount > 0 ? (
                  `up to ${maxDiscount}% off`
                ) : (
                  "great prices"
                )}
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/60 sm:text-lg">
              Ankara, hair bundles, shoes, electronics, and more from verified market
              stores. Every deal is escrow protected.
            </p>
          </div>

          <div className="flex shrink-0 gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-sm sm:gap-10">
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-white">{deals.length}</p>
              )}
              <p className="text-xs text-white/50">Live deals</p>
            </div>
            <div className="w-px bg-white/10" aria-hidden />
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-traffik-amber">
                  {maxDiscount > 0 ? `${maxDiscount}%` : "—"}
                </p>
              )}
              <p className="text-xs text-white/50">Max savings</p>
            </div>
            <div className="w-px bg-white/10" aria-hidden />
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-white">{categories.length}</p>
              )}
              <p className="text-xs text-white/50">Categories</p>
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/deals?category=${encodeURIComponent(cat)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-traffik-amber/30 hover:text-white"
              >
                <Tag className="h-3 w-3 text-traffik-amber" aria-hidden />
                {cat}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/45">
          <ShieldCheck className="h-3.5 w-3.5 text-traffik-green" aria-hidden />
          Kashia escrow on every purchase
        </div>
      </div>

      <div className="flex h-1">
        <div className="flex-1 bg-traffik-pink" />
        <div className="flex-1 bg-traffik-amber" />
        <div className="flex-1 bg-traffik-green" />
      </div>
    </section>
  );
}
