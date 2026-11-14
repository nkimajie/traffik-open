import Image from "next/image";
import {
  BadgeCheck,
  Heart,
  MapPin,
  Package,
  ShieldCheck,
} from "lucide-react";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import StoreStatusPill from "@/components/storefront/store-status-pill";
import { hasStructuredBusinessHours } from "@/lib/utils/business-hours";
import {
  getVendorCategoryLabels,
} from "@/lib/utils/vendor-categories";
import type { Vendor } from "@/lib/types/api";

type StoreProfileHeroProps = {
  store: Vendor;
  productCount: number;
};

export default function StoreProfileHero({
  store,
  productCount,
}: StoreProfileHeroProps) {
  const cover =
    store.storeCoverPhoto ??
    `https://picsum.photos/seed/${store._id}-cover/1200/400`;

  return (
    <>
      <div className="relative h-40 overflow-hidden bg-gray-200 sm:h-52 md:h-60">
        <Image
          src={cover}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <div className="absolute inset-x-0 top-0 mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Stores", href: "/stores" },
              { label: store.businessName ?? "Store" },
            ]}
            className="[&_a]:text-white/75 [&_a:hover]:text-white [&_span]:text-white [&_svg]:text-white/40"
          />
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:gap-5 sm:py-6">
            <div className="relative mx-auto h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-gray-100 shadow-md sm:mx-0 sm:-mt-12 sm:h-24 sm:w-24 sm:rounded-2xl sm:border-4">
              {store.storeLogo ? (
                <Image
                  src={store.storeLogo}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#030803]">
                  {(store.businessName ?? "S").charAt(0)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center sm:pt-1 sm:text-left">
              <h1 className="text-xl font-bold leading-tight text-[#030803] sm:text-2xl md:text-3xl">
                {store.businessName}
              </h1>
              {getVendorCategoryLabels(store).length > 0 && (
                <p className="mt-1 text-sm text-[#484848]">
                  {getVendorCategoryLabels(store).join(" · ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {store.isApproved && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-traffik-green/10 px-2 py-0.5 text-xs font-semibold text-traffik-green">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Verified
                  </span>
                )}
                {store.isFeatured && (
                  <span className="rounded-full bg-traffik-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#030803]">
                    Featured
                  </span>
                )}
                {hasStructuredBusinessHours(store.businessHours) ? (
                  <StoreStatusPill businessHours={store.businessHours} />
                ) : null}
              </div>
            </div>
          </div>

          {store.description && (
            <p className="max-w-3xl pb-4 text-sm leading-relaxed text-[#484848] sm:pb-5 sm:text-base">
              {store.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 py-4 text-sm text-[#484848]">
            {store.physicalStoreAddress && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-traffik-pink" aria-hidden />
                {store.physicalStoreAddress}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-4 w-4 shrink-0 text-traffik-pink" aria-hidden />
              {(store.totalLikes ?? 0).toLocaleString()} likes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-4 w-4 shrink-0 text-traffik-green" aria-hidden />
              {productCount} products
            </span>
          </div>

          <p className="flex items-center gap-1.5 border-t border-gray-100 py-3 text-xs text-[#484848]">
            <ShieldCheck className="h-3.5 w-3.5 text-traffik-green" aria-hidden />
            Escrow protected on every order
          </p>
        </div>
      </div>
    </>
  );
}
