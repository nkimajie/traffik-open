import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoreProfileHero from "@/components/storefront/store-profile-hero";
import StoreProductGrid from "@/components/storefront/store-product-grid";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { serverApiGet } from "@/lib/services/server/api-client";
import type { Product, Vendor } from "@/lib/types/api";

type StorePageProps = {
  params: { vendorId: string };
};

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  try {
    const store = await serverApiGet<Vendor>(
      `${QueryKeys.VENDOR_PUBLIC}/${params.vendorId}`,
    );
    return {
      title: `${store.businessName ?? "Store"} — Traffik`,
      description: store.description,
    };
  } catch {
    return { title: "Store — Traffik" };
  }
}

export default async function StorePage({ params }: StorePageProps) {
  let store: Vendor;
  try {
    store = await serverApiGet<Vendor>(
      `${QueryKeys.VENDOR_PUBLIC}/${params.vendorId}?page=1&limit=100`,
    );
  } catch {
    notFound();
  }

  const products: Product[] = store.products?.items ?? [];

  return (
    <div>
      <StoreProfileHero
        store={store}
        productCount={store.products?.meta.total ?? products.length}
      />

      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-bold text-[#030803] sm:text-xl">
            Products from this store
          </h2>
          <div className="mt-6">
            <StoreProductGrid
              products={products}
              storeName={store.businessName ?? "This store"}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
