import type { Metadata } from "next";
import { Suspense } from "react";
import StoresHero from "@/components/storefront/stores-hero";
import StoreFilterGrid from "@/components/storefront/store-filter-grid";
import { StoreGridSkeleton } from "@/components/ui/list-skeletons";

export const metadata: Metadata = {
  title: "Browse Market Stores — Traffik",
  description:
    "Shop verified market stores from Balogun, Ariaria, Kurmi, Onitsha, Gbagi, Wuse, and more across Nigeria.",
};

export default function StoresPage() {
  return (
    <>
      <StoresHero />
      <section className="bg-[#fafafa] py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<StoreGridSkeleton count={8} />}>
            <StoreFilterGrid />
          </Suspense>
        </div>
      </section>
    </>
  );
}
