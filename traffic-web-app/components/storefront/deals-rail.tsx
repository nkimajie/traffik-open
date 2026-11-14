"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/storefront/product-card";
import { fetchDealsProducts } from "@/lib/services/api/catalog/products.api";
import { ProductGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export default function DealsRail() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products-deals"],
    queryFn: () => fetchDealsProducts({ page: 1, limit: 4 }),
  });

  const deals = data?.items?.slice(0, 4) ?? [];

  return (
    <section
      id="deals"
      aria-labelledby="deals-heading"
      className="relative overflow-hidden bg-[#030803] py-14 sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-traffik-amber/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-traffik-pink/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-traffik-amber/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-traffik-amber">
              <Flame className="h-3.5 w-3.5" aria-hidden />
              Today&apos;s picks
            </div>
            <h2
              id="deals-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl"
            >
              Deals worth grabbing
            </h2>
            <p className="mt-2 max-w-lg text-sm text-white/55 sm:text-base">
              Ankara, hair bundles, shoes, and more — every item from a verified market store.
            </p>
          </div>
          <Link
            href="/deals"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            View all deals
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-10">
            <ProductGridSkeleton count={4} />
          </div>
        ) : error ? (
          <div className="mt-10">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : deals.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={Flame}
              title="No deals right now"
              description="New discounts appear as vendors list products."
              actionLabel="Browse all products"
              actionHref="/stores"
              className="border-white/20 bg-white/5 text-white [&_h3]:text-white [&_p]:text-white/60"
            />
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {deals.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
