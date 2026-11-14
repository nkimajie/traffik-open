"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import SearchForm from "@/components/storefront/search-form";
import { Button } from "@/components/ui/button";

const searchSuggestions = [
  "Ankara fabric from Balogun Market",
  "Human hair bundles in Abuja",
  "Aso-oke from Gbagi, Ibadan",
  "Shoes from Ariaria Market, Aba",
  "Lace front wigs",
];

const popularSearches = [
  "Ankara",
  "Hair & Wigs",
  "Fabrics",
  "Shoes",
  "Clothing",
];

const featuredMarkets = [
  { name: "Balogun", city: "Lagos", href: "/stores" },
  { name: "Ariaria", city: "Aba", href: "/stores" },
  { name: "Kurmi", city: "Kano", href: "/stores" },
  { name: "Onitsha", city: "Anambra", href: "/stores" },
  { name: "Gbagi", city: "Ibadan", href: "/stores" },
  { name: "Wuse", city: "Abuja", href: "/stores" },
  { name: "Alaba", city: "Lagos", href: "/stores" },
  { name: "Tejuosho", city: "Lagos", href: "/stores" },
];

const heroTiles = [
  {
    src: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80&auto=format&fit=crop",
    alt: "Ankara fabrics at Balogun Market",
    label: "Balogun Fabrics",
    sub: "Lagos Island",
    href: "/stores/store-1",
    className: "col-span-7 row-span-2 min-h-[300px]",
  },
  {
    src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80&auto=format&fit=crop",
    alt: "Hair and wigs at Wuse Market",
    label: "Wuse Hair & Beauty",
    sub: "Abuja",
    href: "/stores/store-5",
    className: "col-span-5 min-h-[142px]",
  },
  {
    src: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80&auto=format&fit=crop",
    alt: "Shoes at Ariaria Market",
    label: "Ariaria Shoes",
    sub: "Aba",
    href: "/stores/store-3",
    className: "col-span-5 min-h-[142px]",
  },
];

export default function StorefrontHero() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % searchSuggestions.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#030803]">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-traffik-pink/20 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-traffik-green/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-traffik-amber/10 blur-3xl" />
      </div>

      {/* Brand accent bar */}
      <div className="relative flex h-1">
        <div className="flex-1 bg-traffik-pink" />
        <div className="flex-1 bg-traffik-amber" />
        <div className="flex-1 bg-traffik-green" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-traffik-pink backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Kashia escrow on every order
            </div>

            <h1 className="mt-6 text-[2.25rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              Nigeria&apos;s markets,{" "}
              <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
                delivered to you
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65 sm:text-lg">
              Shop clothes, hair, fabrics, and goods from real market stores —
              Balogun to Ariaria, Kurmi to Onitsha. Every item tied to a verified vendor.
            </p>

            <div className="mt-8">
              <SearchForm
                size="large"
                placeholder={searchSuggestions[placeholderIndex]}
                className="shadow-xl shadow-black/20 ring-white/10"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/40">Popular:</span>
                {popularSearches.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition-colors hover:border-traffik-pink/40 hover:text-white"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button variant="signIn" size="lg" asChild className="rounded-xl px-6">
                <Link href="/stores">
                  Browse stores
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Link
                href="/how-it-works"
                className="text-sm font-semibold text-white/70 transition-colors hover:text-white"
              >
                How escrow works →
              </Link>
            </div>
          </div>

          {/* Bento — desktop */}
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-12 grid-rows-2 gap-3">
              {heroTiles.map((tile, index) => (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className={`group relative overflow-hidden rounded-2xl ring-1 ring-white/10 ${tile.className}`}
                >
                  <Image
                    src={tile.src}
                    alt={tile.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="400px"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity group-hover:from-black/90" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-sm font-bold text-white">{tile.label}</p>
                    <p className="text-xs text-white/65">{tile.sub}</p>
                  </div>
                  <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4 text-white" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Scroll — mobile/tablet */}
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {heroTiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="relative h-48 w-64 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10"
              >
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  fill
                  className="object-cover"
                  sizes="256px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-sm font-bold text-white">{tile.label}</p>
                  <p className="text-xs text-white/65">{tile.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Market marquee */}
      <div className="relative border-t border-white/10 bg-black/30 py-3 backdrop-blur-sm">
        <div className="flex animate-marquee gap-8 whitespace-nowrap">
          {[...featuredMarkets, ...featuredMarkets].map((market, i) => (
            <Link
              key={`${market.name}-${i}`}
              href={market.href}
              className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              <span className="font-semibold text-white/80">{market.name}</span>
              <span>· {market.city}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
