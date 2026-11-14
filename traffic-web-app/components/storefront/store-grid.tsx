"use client";

import { useQuery } from "@tanstack/react-query";
import StoreCard from "@/components/storefront/store-card";
import SectionHeader from "@/components/storefront/section-header";
import { fetchPublicVendors } from "@/lib/services/api/catalog/catalog.api";
import { StoreGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Store } from "lucide-react";

export default function StoreGrid() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vendors-public", { featured: true }],
    queryFn: () => fetchPublicVendors({ page: 1, limit: 8 }),
  });

  const featuredStores =
    data?.items?.filter((s) => s.isFeatured).slice(0, 4) ??
    data?.items?.slice(0, 4) ??
    [];

  return (
    <section
      id="stores"
      aria-labelledby="stores-heading"
      className="bg-[#fafafa] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Market stores"
          eyebrowColor="green"
          title="Shop from Nigeria&apos;s major markets"
          description="Every vendor is a real stall — Balogun, Ariaria, Kurmi, Onitsha, Gbagi, Wuse, and more."
          action={{ label: "All stores", href: "/stores" }}
        />

        {isLoading ? (
          <div className="mt-10">
            <StoreGridSkeleton count={4} />
          </div>
        ) : error ? (
          <div className="mt-10">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : featuredStores.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={Store}
              title="No stores yet"
              description="Vendors are setting up their stalls. Check back soon."
              actionLabel="Become a vendor"
              actionHref="/vendors/sign-up"
            />
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-6">
            {featuredStores.map((store) => (
              <StoreCard key={store._id} store={store} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
