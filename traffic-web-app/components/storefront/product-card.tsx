"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { discountPercent, formatNaira } from "@/lib/utils/format-price";
import type { Product } from "@/lib/types/api";
import { getProductImage, getProductPrice } from "@/lib/utils/product";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  useSaveProductMutation,
  useUnsaveProductMutation,
} from "@/lib/services/api/shopper/use-saved.api";
import {
  isGuestProductSaved,
  toggleGuestSavedProduct,
} from "@/lib/utils/guest-saved";

import { Button } from "@/components/ui/button";

type ProductCardProps = {
  product: Product;
  hideStoreAttribution?: boolean;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
};

export default function ProductCard({
  product,
  hideStoreAttribution = false,
  footerAction,
}: ProductCardProps) {
  const { isAuthenticated, isShopper } = useAuth();
  const saveMutation = useSaveProductMutation();
  const unsaveMutation = useUnsaveProductMutation();

  const [saved, setSaved] = useState(
    product.isFavourite ?? isGuestProductSaved(product._id),
  );
  const finalPrice = getProductPrice(product);
  const hasDiscount = product.discount != null && finalPrice < product.amount;
  const percentOff = hasDiscount
    ? discountPercent(product.amount, finalPrice)
    : 0;
  const image =
    getProductImage(product) ??
    `https://picsum.photos/seed/${product._id}/600/600`;

  const vendor = product.vendor;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-traffik-pink/20">
      <Link
        href={`/products/${product._id}`}
        className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-traffik-pink"
      >
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 240px, 280px"
          />
          {hasDiscount && (
            <span className="absolute left-3 top-3 rounded-full bg-traffik-pink px-2.5 py-1 text-xs font-bold text-white">
              -{percentOff}%
            </span>
          )}
          <button
            type="button"
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();

              if (isAuthenticated && isShopper) {
                try {
                  if (saved) {
                    await unsaveMutation.mutateAsync(product._id);
                    setSaved(false);
                  } else {
                    await saveMutation.mutateAsync(product._id);
                    setSaved(true);
                  }
                } catch {
                  toast.error("Could not update saved items");
                }
                return;
              }

              setSaved(toggleGuestSavedProduct(product._id));
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white"
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart
              className={`h-4 w-4 ${saved ? "fill-traffik-pink text-traffik-pink" : "text-[#484848]"}`}
            />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-4 pb-4">
          <h3 className="line-clamp-2 text-sm font-semibold text-[#030803] group-hover:text-traffik-pink">
            {product.name}
          </h3>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#030803]">
              {formatNaira(finalPrice)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-[#484848] line-through">
                {formatNaira(product.amount)}
              </span>
            )}
          </div>

          <div className="mt-2">
            {product.totalRatings > 0 ? (
              <p
                className="inline-flex items-center gap-1 text-xs text-[#484848]"
                aria-label={`${product.rating} out of 5, ${product.totalRatings} ratings`}
              >
                <Star className="h-3.5 w-3.5 fill-traffik-amber text-traffik-amber" aria-hidden />
                <span className="font-medium text-[#030803]">{product.rating}</span>
                <span>({product.totalRatings})</span>
              </p>
            ) : (
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[#484848]">
                New
              </span>
            )}
          </div>
        </div>
      </Link>

      {footerAction ? (
        <div className="mt-auto border-t border-gray-100 px-4 pb-4 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-traffik-pink/30 text-traffik-pink hover:bg-traffik-pink/5"
            onClick={footerAction.onClick}
          >
            {footerAction.label}
          </Button>
        </div>
      ) : !hideStoreAttribution && vendor?.businessName ? (
        <Link
          href={`/stores/${vendor._id ?? product.vendorId}`}
          className="mx-4 mb-4 flex items-center gap-2 border-t border-gray-100 pt-3 transition-colors hover:text-traffik-pink"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-traffik-pink/20 to-traffik-green/20 text-[10px] font-bold text-[#030803]">
            {vendor.businessName.charAt(0)}
          </div>
          <span className="truncate text-xs font-medium text-[#484848] hover:text-traffik-pink">
            {vendor.businessName}
          </span>
          {vendor.isApproved && (
            <BadgeCheck
              className="h-3.5 w-3.5 flex-shrink-0 text-traffik-green"
              aria-label="Verified store"
            />
          )}
        </Link>
      ) : null}
    </article>
  );
}
