import type { Metadata } from "next";
import { Suspense } from "react";
import DealsHero from "@/components/storefront/deals-hero";
import DealsFilterGrid from "@/components/storefront/deals-filter-grid";
import { ProductGridSkeleton } from "@/components/ui/list-skeletons";

export const metadata: Metadata = {
  title: "Today's Deals — Traffik",
  description:
    "Discover discounted products from Nigeria's major markets — Ankara, hair, shoes, electronics, and more.",
};

export default function DealsPage() {
  return (
    <>
      <DealsHero />
      <section className="bg-[#fafafa] py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<ProductGridSkeleton count={8} />}>
            <DealsFilterGrid />
          </Suspense>
        </div>
      </section>
    </>
  );
}
