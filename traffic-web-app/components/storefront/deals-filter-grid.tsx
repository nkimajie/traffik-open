"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  Grid3X3,
  LayoutList,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/storefront/product-card";
import DealListCard from "@/components/storefront/deal-list-card";
import { fetchDealsProducts } from "@/lib/services/api/catalog/products.api";
import type { Product } from "@/lib/types/api";
import {
  getProductCategoryName,
  getProductDiscountPercent,
  getProductPrice,
} from "@/lib/utils/product";
import { ProductGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

type SortOption = "discount" | "price_low" | "price_high" | "popular";
type ViewMode = "grid" | "list";
type DiscountFilter = "all" | "10" | "15" | "20";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "discount", label: "Biggest discount" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "popular", label: "Most popular" },
];

const discountFilters: { value: DiscountFilter; label: string }[] = [
  { value: "all", label: "Any discount" },
  { value: "10", label: "10%+ off" },
  { value: "15", label: "15%+ off" },
  { value: "20", label: "20%+ off" },
];

function sortDeals(deals: Product[], sort: SortOption): Product[] {
  const copy = [...deals];
  switch (sort) {
    case "discount":
      return copy.sort(
        (a, b) => getProductDiscountPercent(b) - getProductDiscountPercent(a),
      );
    case "price_low":
      return copy.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    case "price_high":
      return copy.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    case "popular":
      return copy.sort((a, b) => b.totalRatings - a.totalRatings);
    default:
      return copy;
  }
}

function getHotDeals(deals: Product[], count = 3): Product[] {
  return [...deals]
    .sort((a, b) => getProductDiscountPercent(b) - getProductDiscountPercent(a))
    .slice(0, count);
}

export default function DealsFilterGrid() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "all";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products-deals", { page: 1, limit: 100 }],
    queryFn: () => fetchDealsProducts({ page: 1, limit: 100 }),
  });

  const deals = useMemo(() => data?.items ?? [], [data?.items]);

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(deals.map((deal) => getProductCategoryName(deal))),
    ).filter((name) => name !== "Uncategorized");
    return names.sort();
  }, [deals]);

  const [activeCategory, setActiveCategory] = useState(
    initialCategory === "all" || categories.includes(initialCategory)
      ? initialCategory
      : "all",
  );
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>("all");
  const [sort, setSort] = useState<SortOption>("discount");
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const hotDeals = useMemo(() => getHotDeals(deals, 3), [deals]);

  const filtered = useMemo(() => {
    let result = deals;

    if (activeCategory !== "all") {
      result = result.filter(
        (p) => getProductCategoryName(p) === activeCategory,
      );
    }

    if (discountFilter !== "all") {
      const min = parseInt(discountFilter, 10);
      result = result.filter((p) => getProductDiscountPercent(p) >= min);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((p) =>
        [
          p.name,
          p.description,
          getProductCategoryName(p),
          p.vendor?.businessName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return sortDeals(result, sort);
  }, [deals, activeCategory, discountFilter, query, sort]);

  const showHot =
    activeCategory === "all" &&
    discountFilter === "all" &&
    !query.trim() &&
    sort === "discount";

  const hotIds = new Set(hotDeals.map((p) => p._id));
  const displayDeals = showHot
    ? filtered.filter((p) => !hotIds.has(p._id))
    : filtered;

  const hasActiveFilters =
    activeCategory !== "all" || discountFilter !== "all" || query.trim() !== "";

  function clearFilters() {
    setActiveCategory("all");
    setDiscountFilter("all");
    setQuery("");
  }

  if (isLoading) {
    return <ProductGridSkeleton count={8} />;
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="No deals right now"
        description="New discounts appear as vendors list products."
        actionLabel="Browse stores"
        actionHref="/stores"
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
                placeholder="Search deals…"
                className="w-full rounded-xl bg-gray-50 py-2.5 pl-9 pr-4 text-sm ring-1 ring-gray-200/80 outline-none transition-shadow focus:ring-traffik-pink/40"
                aria-label="Search deals"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-gray-200/80 outline-none focus:ring-traffik-pink/40"
              aria-label="Sort deals"
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
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {discountFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setDiscountFilter(filter.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    discountFilter === filter.value
                      ? "bg-traffik-amber text-[#030803] shadow-sm"
                      : "bg-gray-100 text-[#484848] hover:bg-gray-200",
                  )}
                >
                  {filter.value !== "all" && (
                    <Flame className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {filter.label}
                </button>
              ))}
            </div>

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
          <span className="font-semibold text-[#030803]">{filtered.length}</span> deal
          {filtered.length !== 1 ? "s" : ""}
          {activeCategory !== "all" ? ` in ${activeCategory}` : ""}
          {discountFilter !== "all" ? ` · ${discountFilter}%+ off` : ""}
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

      {showHot && hotDeals.length > 0 && (
        <section aria-labelledby="hot-deals-heading">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-traffik-amber" aria-hidden />
            <h2 id="hot-deals-heading" className="text-lg font-bold text-[#030803]">
              Hottest deals right now
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {hotDeals.map((product) => {
              const pct = getProductDiscountPercent(product);
              return (
                <div
                  key={product._id}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-traffik-pink/5 via-traffik-amber/5 to-traffik-green/5 p-1 ring-1 ring-traffik-amber/20"
                >
                  <span className="absolute right-3 top-3 z-10 rounded-full bg-traffik-pink px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                    -{pct}% OFF
                  </span>
                  <ProductCard product={product} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-4 text-lg font-medium text-[#030803]">No deals found</p>
          <p className="mt-2 text-sm text-[#484848]">
            Try a different category, discount tier, or search term.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-xl bg-traffik-pink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-traffik-pink/90"
          >
            Clear all filters
          </button>
        </div>
      ) : displayDeals.length > 0 ? (
        <section aria-labelledby="all-deals-heading">
          {showHot ? (
            <h2 id="all-deals-heading" className="mb-4 text-lg font-bold text-[#030803]">
              More deals
            </h2>
          ) : (
            <h2 id="all-deals-heading" className="sr-only">
              All deals
            </h2>
          )}

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayDeals.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayDeals.map((product) => (
                <DealListCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
