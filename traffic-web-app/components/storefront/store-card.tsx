import Image from "next/image";
import Link from "next/link";
import { Clock, Heart, MapPin } from "lucide-react";
import StoreStatusPill from "@/components/storefront/store-status-pill";
import { hasStructuredBusinessHours } from "@/lib/utils/business-hours";
import { getVendorPrimaryCategoryLabel } from "@/lib/utils/vendor-categories";
import type { Vendor } from "@/lib/types/api";

type StoreCardProps = {
  store: Vendor;
};

function storeInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function StoreCard({ store }: StoreCardProps) {
  const cover =
    store.storeCoverPhoto ??
    `https://picsum.photos/seed/${store._id}-cover/800/450`;

  return (
    <Link
      href={`/stores/${store._id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:ring-traffik-pink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-traffik-pink"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={cover}
          alt={`${store.businessName} cover`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        {hasStructuredBusinessHours(store.businessHours) ? (
          <div className="absolute right-3 top-3">
            <StoreStatusPill businessHours={store.businessHours} />
          </div>
        ) : null}
        {store.isFeatured && (
          <span className="absolute left-3 top-3 rounded-full bg-traffik-amber px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#030803]">
            Featured
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-md">
            {store.storeLogo ? (
              <Image
                src={store.storeLogo}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-traffik-pink/30 to-traffik-green/30 text-xs font-bold text-white">
                {storeInitials(store.businessName ?? "Store")}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-0.5">
            <h3 className="truncate text-sm font-bold text-white">
              {store.businessName}
            </h3>
            <p className="truncate text-xs text-white/80">
              {getVendorPrimaryCategoryLabel(store)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          {store.physicalStoreAddress ? (
            <p className="inline-flex items-center gap-1 text-xs text-[#484848]">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-traffik-pink" aria-hidden />
              <span className="line-clamp-1">{store.physicalStoreAddress}</span>
            </p>
          ) : (
            <p className="text-xs text-[#484848]">{store.description?.slice(0, 60)}</p>
          )}
          {store.isApproved && (
            <span className="flex-shrink-0 rounded-md bg-traffik-green/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-traffik-green">
              Verified
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs text-[#484848]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Market delivery
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-traffik-pink" aria-hidden />
            {(store.totalLikes ?? 0).toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
