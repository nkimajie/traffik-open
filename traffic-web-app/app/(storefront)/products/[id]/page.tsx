import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  MapPin,
  ShieldCheck,
  Star,
  Store,
  Truck,
} from "lucide-react";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import ProductGallery from "@/components/storefront/product-gallery";
import ProductCard from "@/components/storefront/product-card";
import ProductPurchaseActions from "@/components/storefront/product-purchase-actions";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { serverApiGet } from "@/lib/services/server/api-client";
import type { PaginatedData, Product, Vendor } from "@/lib/types/api";
import { discountPercent, formatNaira } from "@/lib/utils/format-price";
import { getProductPrice } from "@/lib/utils/product";
import { slugify } from "@/lib/utils/slug";

type ProductPageProps = {
  params: { id: string };
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  try {
    const product = await serverApiGet<Product>(
      `${QueryKeys.PRODUCT}/${params.id}`,
    );
    return {
      title: `${product.name} — Traffik`,
      description: product.description,
    };
  } catch {
    return { title: "Product — Traffik" };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  let product: Product;
  try {
    product = await serverApiGet<Product>(`${QueryKeys.PRODUCT}/${params.id}`);
  } catch {
    notFound();
  }

  let store: Vendor | null = null;
  try {
    store = await serverApiGet<Vendor>(
      `${QueryKeys.VENDOR_PUBLIC}/${product.vendorId}`,
    );
  } catch {
    store = null;
  }

  let related: Product[] = [];
  try {
    const relatedData = await serverApiGet<PaginatedData<Product>>(
      `/products/vendor/${product.vendorId}/products?page=1&limit=5`,
    );
    related = relatedData.items.filter((p) => p._id !== product._id).slice(0, 4);
  } catch {
    related = [];
  }

  const finalPrice = getProductPrice(product);
  const hasDiscount = product.discount != null && finalPrice < product.amount;
  const percentOff = hasDiscount
    ? discountPercent(product.amount, finalPrice)
    : 0;
  const vendor = product.vendor;
  const category = product.category;

  return (
    <div>
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              ...(category
                ? [
                    {
                      label: category.name,
                      href: `/categories/${slugify(category.name)}`,
                    },
                  ]
                : []),
              { label: product.name },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ProductGallery
            images={product.images}
            alt={product.name}
            productId={product._id}
          />

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-traffik-green/10 px-3 py-1 text-xs font-semibold text-traffik-green">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Escrow protected
            </div>

            <h1 className="mt-4 text-2xl font-bold text-[#030803] sm:text-3xl">
              {product.name}
            </h1>

            {product.totalRatings > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#484848]">
                <Star
                  className="h-4 w-4 fill-traffik-amber text-traffik-amber"
                  aria-hidden
                />
                <span className="font-semibold text-[#030803]">
                  {product.rating}
                </span>
                <span>({product.totalRatings} reviews)</span>
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-[#030803]">
                {formatNaira(finalPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-[#484848] line-through">
                    {formatNaira(product.amount)}
                  </span>
                  <span className="rounded-full bg-traffik-pink px-2.5 py-0.5 text-xs font-bold text-white">
                    -{percentOff}%
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="mt-6 leading-relaxed text-[#484848]">
                {product.description}
              </p>
            )}

            {vendor?.businessName && (
              <Link
                href={`/stores/${vendor._id ?? product.vendorId}`}
                className="mt-6 flex items-center gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200/80 transition-all hover:ring-traffik-pink/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-traffik-pink/20 to-traffik-green/20 text-sm font-bold text-[#030803]">
                  {vendor.businessName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#484848]">
                    Sold by
                  </p>
                  <p className="flex items-center gap-1.5 truncate font-semibold text-[#030803]">
                    {vendor.businessName}
                    {store?.isApproved && (
                      <BadgeCheck
                        className="h-4 w-4 text-traffik-green"
                        aria-label="Verified"
                      />
                    )}
                  </p>
                  {store?.physicalStoreAddress && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#484848]">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {store.physicalStoreAddress}
                    </p>
                  )}
                </div>
                <Store className="h-5 w-5 text-[#484848]" aria-hidden />
              </Link>
            )}

            {store && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#484848]">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-traffik-amber" aria-hidden />
                  Market delivery available
                </span>
              </div>
            )}

            <ProductPurchaseActions product={product} />
          </div>
        </div>

        {related.length > 0 && vendor?.businessName && (
          <section
            aria-labelledby="related-heading"
            className="mt-16 border-t border-gray-100 pt-12"
          >
            <h2
              id="related-heading"
              className="text-xl font-bold text-[#030803] sm:text-2xl"
            >
              More from {vendor.businessName}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item._id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
