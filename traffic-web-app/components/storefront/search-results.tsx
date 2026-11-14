"use client";

import Link from "next/link";
import { Package, Search, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/storefront/product-card";
import StoreCard from "@/components/storefront/store-card";
import SearchForm from "@/components/storefront/search-form";
import { searchCatalog } from "@/lib/services/api/catalog/catalog.api";
import { ProductGridSkeleton, StoreGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";

type SearchResultsProps = {
  query: string;
};

export default function SearchResults({ query }: SearchResultsProps) {
  const trimmed = query.trim();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["search", trimmed],
    queryFn: () =>
      searchCatalog({ q: trimmed, type: "all", page: 1, limit: 24 }),
    enabled: trimmed.length > 0,
  });

  const products = data?.products?.items ?? [];
  const stores = data?.vendors?.items ?? [];
  const hasResults = products.length > 0 || stores.length > 0;

  if (!trimmed) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <SearchForm size="large" className="mx-auto" />
        <p className="mt-8 text-sm text-[#484848]">
          Try searching for &ldquo;Ankara&rdquo;, &ldquo;hair bundles&rdquo;, or a market name like
          &ldquo;Balogun&rdquo;.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["Ankara", "Hair & Wigs", "Balogun", "Ariaria", "Shoes"].map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-[#484848] transition-colors hover:bg-traffik-pink/10 hover:text-traffik-pink"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-12">
        <SearchForm defaultValue={trimmed} size="large" />
        <StoreGridSkeleton count={3} />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <SearchForm defaultValue={trimmed} size="large" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <Search className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
        <p className="mt-4 text-lg font-medium text-[#030803]">
          No results for &ldquo;{trimmed}&rdquo;
        </p>
        <p className="mt-2 text-sm text-[#484848]">
          Try a different keyword or browse our market stores directly.
        </p>
        <Link
          href="/stores"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-traffik-pink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-traffik-pink/90"
        >
          <Store className="h-4 w-4" aria-hidden />
          Browse stores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <SearchForm defaultValue={trimmed} size="large" />

      {stores.length > 0 && (
        <section aria-labelledby="search-stores-heading">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-traffik-pink" aria-hidden />
            <h2 id="search-stores-heading" className="text-lg font-bold text-[#030803]">
              Stores ({data?.vendors?.meta.total ?? stores.length})
            </h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreCard key={store._id} store={store} />
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section aria-labelledby="search-products-heading">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-traffik-green" aria-hidden />
            <h2 id="search-products-heading" className="text-lg font-bold text-[#030803]">
              Products ({data?.products?.meta.total ?? products.length})
            </h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
