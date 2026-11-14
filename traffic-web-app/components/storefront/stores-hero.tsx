"use client";

import { ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import { fetchPublicVendors } from "@/lib/services/api/catalog/catalog.api";
import { Skeleton } from "@/components/ui/skeleton";

export default function StoresHero() {
  const { data, isLoading } = useQuery({
    queryKey: ["vendors-public", { hero: true }],
    queryFn: () => fetchPublicVendors({ page: 1, limit: 100 }),
  });

  const stores = data?.items ?? [];
  const featuredCount = stores.filter((s) => s.isFeatured).length;

  return (
    <section className="relative overflow-hidden bg-[#030803]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-traffik-pink/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-traffik-green/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Stores" }]}
          className="mb-6 [&_a]:text-white/60 [&_a:hover]:text-white [&_span]:text-white [&_svg]:text-white/40"
        />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-traffik-green backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              All stores escrow protected
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Market stores across{" "}
              <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
                Nigeria
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/60 sm:text-lg">
              Every vendor is a real stall in a real market — Balogun, Ariaria, Kurmi,
              Onitsha, and more. Browse verified stores and start shopping.
            </p>
          </div>

          <div className="flex shrink-0 gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-sm sm:gap-10">
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-white">{stores.length}</p>
              )}
              <p className="text-xs text-white/50">Stores</p>
            </div>
            <div className="w-px bg-white/10" aria-hidden />
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-white">{featuredCount}</p>
              )}
              <p className="text-xs text-white/50">Featured</p>
            </div>
            <div className="w-px bg-white/10" aria-hidden />
            <div className="text-center">
              {isLoading ? (
                <Skeleton className="mx-auto h-8 w-12 bg-white/20" />
              ) : (
                <p className="text-2xl font-bold text-white">
                  {data?.meta.total ?? stores.length}
                </p>
              )}
              <p className="text-xs text-white/50">Listed</p>
            </div>
          </div>
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
