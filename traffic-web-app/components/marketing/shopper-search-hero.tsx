"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSuggestions = [
  "Fresh produce near me",
  "Handmade accessories",
  "Electronics deals",
  "Local fashion brands",
];

const categories = [
  "Fashion",
  "Food & Groceries",
  "Electronics",
  "Home & Living",
  "Beauty",
  "Sports",
];

export default function ShopperSearchHero() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % searchSuggestions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#f2f2f2] py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-traffik-pink/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-traffik-pink">
          For Shoppers
        </p>
        <h1 className="mt-3 text-4xl font-bold text-[#030803] sm:text-5xl">
          Find what you love,{" "}
          <span className="bg-gradient-to-r from-traffik-pink to-traffik-amber bg-clip-text text-transparent">
            locally
          </span>
        </h1>
        <p className="mt-4 text-lg text-[#484848]">
          Search stores, browse categories, and discover products from verified
          vendors in your area.
        </p>

        {/* Search-first hero — Haul-inspired */}
        <div className="relative mx-auto mt-10 max-w-xl">
          <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-lg shadow-gray-200/50">
            <Search className="h-5 w-5 flex-shrink-0 text-[#484848]" />
            <input
              type="text"
              readOnly
              placeholder={searchSuggestions[placeholderIndex]}
              className="ml-3 flex-1 bg-transparent text-[#030803] placeholder:text-[#484848]/60 outline-none"
              aria-label="Search marketplace"
            />
            <Button variant="signIn" size="sm" disabled className="ml-2 shrink-0">
              Search
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#484848]">
            Full search coming with the Traffik app
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-[#484848] transition-colors hover:border-traffik-pink/30 hover:text-traffik-pink"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
