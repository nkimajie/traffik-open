import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Heart, MapPin } from "lucide-react";
import StoreStatusPill from "@/components/storefront/store-status-pill";
import { hasStructuredBusinessHours } from "@/lib/utils/business-hours";
import { getVendorPrimaryCategoryLabel } from "@/lib/utils/vendor-categories";
import type { Vendor } from "@/lib/types/api";

type StoreListCardProps = {
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

export default function StoreListCard({ store }: StoreListCardProps) {
  const cover =
    store.storeCoverPhoto ??
    `https://picsum.photos/seed/${store._id}-cover/800/450`;

  return (
    <Link
      href={`/stores/${store._id}`}
      className="group flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-traffik-pink/25 sm:min-h-[140px]"
    >
      <div className="relative hidden w-36 shrink-0 overflow-hidden sm:block md:w-44">
        <Image
          src={cover}
          alt=""
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="176px"
        />
        {store.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-traffik-amber px-2 py-0.5 text-[9px] font-bold uppercase text-[#030803]">
            Featured
          </span>
        )}
      </div>

      <div className="relative m-4 h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-200 sm:hidden">
        {store.storeLogo ? (
          <Image src={store.storeLogo} alt="" fill className="object-cover" sizes="64px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-traffik-pink/30 to-traffik-green/30 text-sm font-bold text-[#030803]">
            {storeInitials(store.businessName ?? "Store")}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-4 pr-4 sm:py-5 sm:pl-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-[#030803] group-hover:text-traffik-pink sm:text-lg">
            {store.businessName}
          </h3>
          {store.isApproved && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-traffik-green/10 px-2 py-0.5 text-[10px] font-bold uppercase text-traffik-green">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Verified
            </span>
          )}
          {hasStructuredBusinessHours(store.businessHours) ? (
            <StoreStatusPill businessHours={store.businessHours} />
          ) : null}
        </div>

        {getVendorPrimaryCategoryLabel(store) && (
          <p className="text-sm text-[#484848]">
            {getVendorPrimaryCategoryLabel(store)}
          </p>
        )}

        {store.physicalStoreAddress && (
          <p className="inline-flex items-center gap-1 text-xs text-[#484848]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-traffik-pink" aria-hidden />
            <span className="truncate">{store.physicalStoreAddress}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#484848]">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-traffik-pink" aria-hidden />
            {(store.totalLikes ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="hidden shrink-0 items-center pr-5 md:flex">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[#484848] transition-colors group-hover:bg-traffik-pink group-hover:text-white">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
