import type { Metadata } from "next";
import PageBanner from "@/components/storefront/page-banner";
import SearchResults from "@/components/storefront/search-results";

type SearchPageProps = {
  searchParams: { q?: string };
};

export const metadata: Metadata = {
  title: "Search — Traffik",
  description: "Search products and market stores across Nigeria on Traffik.",
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q ?? "";

  return (
    <>
      <PageBanner
        eyebrow="Search"
        title={query ? `Results for "${query}"` : "Search Traffik"}
        description={
          query
            ? undefined
            : "Find products, stores, and market goods from across Nigeria."
        }
        breadcrumbs={[{ label: "Search" }]}
      />
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchResults query={query} />
        </div>
      </section>
    </>
  );
}
