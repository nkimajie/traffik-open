import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import PageBanner from "@/components/storefront/page-banner";
import ProductCard from "@/components/storefront/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { serverApiGet } from "@/lib/services/server/api-client";
import type { Category, PaginatedData, Product } from "@/lib/types/api";
import { slugify } from "@/lib/utils/slug";
import { Tag } from "lucide-react";

type CategoryPageProps = {
  params: { slug: string };
};

async function resolveCategory(slug: string): Promise<Category | undefined> {
  const categories = await serverApiGet<Category[]>(QueryKeys.CATEGORIES);
  return categories.find((cat) => slugify(cat.name) === slug);
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  try {
    const category = await resolveCategory(params.slug);
    if (!category) return { title: "Category — Traffik" };

    return {
      title: `${category.name} — Traffik`,
      description: `Shop ${category.name.toLowerCase()} from verified market stores across Nigeria.`,
    };
  } catch {
    return { title: "Category — Traffik" };
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  let category: Category | undefined;
  try {
    category = await resolveCategory(params.slug);
  } catch {
    notFound();
  }

  if (!category) {
    notFound();
  }

  let products: Product[] = [];
  let total = 0;
  try {
    const data = await serverApiGet<PaginatedData<Product>>(
      `${QueryKeys.PRODUCTS}?categoryId=${category._id}&page=1&limit=48`,
    );
    products = data.items;
    total = data.meta.total;
  } catch {
    products = [];
  }

  return (
    <>
      <PageBanner
        variant="gradient"
        eyebrow="Category"
        title={category.name}
        description={`Browse ${total > 0 ? `${total.toLocaleString()}+` : ""} items from market stores nationwide.`}
        breadcrumbs={[
          { label: "Categories", href: "/#categories" },
          { label: category.name },
        ]}
      >
        {category.image && (
          <div className="relative mt-6 h-32 w-full max-w-md overflow-hidden rounded-2xl sm:h-40">
            <Image
              src={category.image}
              alt={category.name}
              fill
              className="object-cover"
              sizes="400px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
          </div>
        )}
      </PageBanner>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {products.length > 0 ? (
            <>
              <p className="mb-6 text-sm text-[#484848]">
                {products.length} product{products.length !== 1 ? "s" : ""}{" "}
                available
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Tag}
              title="Coming soon"
              description={`Vendors are adding ${category.name.toLowerCase()} products. Check back shortly.`}
              actionLabel="Browse stores"
              actionHref="/stores"
            />
          )}
        </div>
      </section>
    </>
  );
}
