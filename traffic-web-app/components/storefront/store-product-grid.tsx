"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types/api";
import {
  getProductCategoryName,
  getProductPrice,
} from "@/lib/utils/product";
import ProductCard from "@/components/storefront/product-card";

type StoreProductGridProps = {
  products: Product[];
  storeName: string;
};

type SortOption = "featured" | "price_low" | "price_high" | "name";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

function sortProducts(products: Product[], sort: SortOption) {
  const copy = [...products];
  switch (sort) {
    case "price_low":
      return copy.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    case "price_high":
      return copy.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy.sort((a, b) => b.totalRatings - a.totalRatings);
  }
}

export default function StoreProductGrid({
  products,
  storeName,
}: StoreProductGridProps) {
  const categories = useMemo(() => {
    const names = Array.from(new Set(products.map(getProductCategoryName)));
    return ["All", ...names.filter((name) => name !== "Uncategorized")];
  }, [products]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");

  const filtered = useMemo(() => {
    let result = products;

    if (activeCategory !== "All") {
      result = result.filter(
        (p) => getProductCategoryName(p) === activeCategory,
      );
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((p) =>
        [p.name, p.description, getProductCategoryName(p)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return sortProducts(result, sort);
  }, [products, activeCategory, query, sort]);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <p className="text-[#484848]">
          {storeName} is setting up their catalog. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#484848]/50"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search in ${storeName}…`}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-[#030803] placeholder:text-[#484848]/50 focus:border-traffik-pink focus:outline-none focus:ring-2 focus:ring-traffik-pink/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#484848] hover:bg-gray-100"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className="h-11 shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#030803] focus:border-traffik-pink focus:outline-none focus:ring-2 focus:ring-traffik-pink/20"
          aria-label="Sort products"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeCategory === cat
                  ? "bg-[#030803] text-white"
                  : "bg-gray-100 text-[#484848] hover:bg-gray-200",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-[#484848]">
        {filtered.length} of {products.length} item{products.length !== 1 ? "s" : ""}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-[#484848]">No products match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveCategory("All");
            }}
            className="mt-3 text-sm font-medium text-traffik-pink hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {filtered.map((product) => (
            <ProductCard key={product._id} product={product} hideStoreAttribution />
          ))}
        </div>
      )}
    </>
  );
}
