"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Grid3X3,
  LayoutList,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StoreCard from "@/components/storefront/store-card";
import StoreListCard from "@/components/storefront/store-list-card";
import { fetchPublicVendors } from "@/lib/services/api/catalog/catalog.api";
import type { Vendor } from "@/lib/types/api";
import { StoreGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getVendorCategoryLabels,
  vendorMatchesCategoryFilter,
} from "@/lib/utils/vendor-categories";

type SortOption = "featured" | "popular" | "name";
type ViewMode = "grid" | "list";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "popular", label: "Most popular" },
  { value: "name", label: "Name A–Z" },
];

function sortStores(stores: Vendor[], sort: SortOption): Vendor[] {
  const copy = [...stores];
  switch (sort) {
    case "featured":
      return copy.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (b.totalLikes ?? 0) - (a.totalLikes ?? 0),
      );
    case "popular":
      return copy.sort((a, b) => (b.totalLikes ?? 0) - (a.totalLikes ?? 0));
    case "name":
      return copy.sort((a, b) =>
        (a.businessName ?? "").localeCompare(b.businessName ?? ""),
      );
    default:
      return copy;
  }
}

export default function StoreFilterGrid() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vendors-public", { page: 1, limit: 100 }],
    queryFn: () => fetchPublicVendors({ page: 1, limit: 100 }),
  });

  const stores = useMemo(() => data?.items ?? [], [data?.items]);

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(stores.flatMap((store) => getVendorCategoryLabels(store))),
    );
    return names.sort();
  }, [stores]);

  const featuredStores = useMemo(
    () => stores.filter((store) => store.isFeatured).slice(0, 3),
    [stores],
  );

  const filtered = useMemo(() => {
    let result = stores;

    if (activeCategory !== "all") {
      result = result.filter((store) =>
        vendorMatchesCategoryFilter(store, activeCategory),
      );
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((store) =>
        [
          store.businessName,
          ...getVendorCategoryLabels(store),
          store.description,
          store.physicalStoreAddress,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return sortStores(result, sort);
  }, [stores, activeCategory, query, sort]);

  const showFeatured =
    activeCategory === "all" && !query.trim() && sort === "featured";

  const featuredIds = new Set(featuredStores.map((s) => s._id));
  const displayStores = showFeatured
    ? filtered.filter((store) => !featuredIds.has(store._id))
    : filtered;

  const hasActiveFilters = activeCategory !== "all" || query.trim() !== "";

  function clearFilters() {
    setActiveCategory("all");
    setQuery("");
  }

  if (isLoading) {
    return <StoreGridSkeleton count={8} />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (stores.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="No stores yet"
        description="Vendors are setting up their stalls. Check back soon."
        actionLabel="Become a vendor"
        actionHref="/vendors/sign-up"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="sticky top-14 z-40 -mx-4 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[6.5rem] lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-traffik-pink"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stores…"
                className="w-full rounded-xl bg-gray-50 py-2.5 pl-9 pr-4 text-sm ring-1 ring-gray-200/80 outline-none transition-shadow focus:ring-traffik-pink/40"
                aria-label="Search stores"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-gray-200/80 outline-none focus:ring-traffik-pink/40"
              aria-label="Sort stores"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition-colors lg:hidden",
                showFilters
                  ? "bg-traffik-pink text-white ring-traffik-pink"
                  : "bg-gray-50 text-[#484848] ring-gray-200/80",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
            </button>

            <div className="ml-auto flex rounded-xl bg-gray-100 p-1 ring-1 ring-gray-200/80">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  view === "grid"
                    ? "bg-white text-[#030803] shadow-sm"
                    : "text-[#484848] hover:text-[#030803]",
                )}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  view === "list"
                    ? "bg-white text-[#030803] shadow-sm"
                    : "text-[#484848] hover:text-[#030803]",
                )}
                aria-label="List view"
                aria-pressed={view === "list"}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className={cn("flex flex-col gap-3", !showFilters && "hidden lg:flex")}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  activeCategory === "all"
                    ? "bg-traffik-pink/10 text-traffik-pink ring-1 ring-traffik-pink/30"
                    : "bg-gray-50 text-[#484848] hover:bg-gray-100",
                )}
              >
                All categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    activeCategory === cat
                      ? "bg-traffik-pink/10 text-traffik-pink ring-1 ring-traffik-pink/30"
                      : "bg-gray-50 text-[#484848] hover:bg-gray-100",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#484848]">
          <span className="font-semibold text-[#030803]">{filtered.length}</span>{" "}
          store
          {filtered.length !== 1 ? "s" : ""}
          {activeCategory !== "all" ? ` · ${activeCategory}` : ""}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-traffik-pink hover:underline"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>

      {showFeatured && featuredStores.length > 0 && (
        <section aria-labelledby="featured-stores-heading">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-traffik-amber" aria-hidden />
            <h2
              id="featured-stores-heading"
              className="text-lg font-bold text-[#030803]"
            >
              Featured market stores
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
            {featuredStores.map((store) => (
              <div key={store._id} className="w-72 shrink-0 md:w-auto">
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-4 text-lg font-medium text-[#030803]">No stores found</p>
          <p className="mt-2 text-sm text-[#484848]">
            Try a different category or search term.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-xl bg-traffik-pink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-traffik-pink/90"
          >
            Clear all filters
          </button>
        </div>
      ) : displayStores.length > 0 ? (
        <section aria-labelledby="all-stores-heading">
          {showFeatured ? (
            <h2
              id="all-stores-heading"
              className="mb-4 text-lg font-bold text-[#030803]"
            >
              More stores
            </h2>
          ) : (
            <h2 id="all-stores-heading" className="sr-only">
              All stores
            </h2>
          )}

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayStores.map((store) => (
                <StoreCard key={store._id} store={store} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayStores.map((store) => (
                <StoreListCard key={store._id} store={store} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
