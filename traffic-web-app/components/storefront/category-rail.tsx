"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import SectionHeader from "@/components/storefront/section-header";
import { fetchCategories } from "@/lib/services/api/catalog/catalog.api";
import { slugify } from "@/lib/utils/slug";
import { ProductGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "lucide-react";

function categoryFallback(name: string): string {
  return `https://picsum.photos/seed/${slugify(name)}/400/400`;
}

export default function CategoryRail() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  return (
    <section id="categories" aria-labelledby="categories-heading" className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Categories"
          eyebrowColor="pink"
          title="What are you shopping for?"
          description="Clothing, hair, fabrics, beauty, and market goods from vendors nationwide."
          action={{ label: "Browse all", href: "/stores" }}
        />

        {isLoading ? (
          <div className="mt-10">
            <ProductGridSkeleton count={8} />
          </div>
        ) : error ? (
          <div className="mt-10">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : !data?.length ? (
          <div className="mt-10">
            <EmptyState
              icon={Tag}
              title="No categories yet"
              description="Check back soon as vendors add their stores."
              actionLabel="Browse stores"
              actionHref="/stores"
            />
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">
            {data.map((category) => (
              <Link
                key={category._id}
                href={`/categories/${slugify(category.name)}`}
                className="group"
              >
                <article className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200/60 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-traffik-pink/30 sm:aspect-square">
                  <Image
                    src={category.image ?? categoryFallback(category.name)}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 640px) 50vw, 160px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-xs font-bold text-white sm:text-sm">{category.name}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
