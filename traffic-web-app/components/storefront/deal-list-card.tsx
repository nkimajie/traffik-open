"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { discountPercent, formatNaira } from "@/lib/utils/format-price";
import type { Product } from "@/lib/types/api";
import {
  getProductCategoryName,
  getProductImage,
  getProductPrice,
} from "@/lib/utils/product";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  useSaveProductMutation,
  useUnsaveProductMutation,
} from "@/lib/services/api/shopper/use-saved.api";
import {
  isGuestProductSaved,
  toggleGuestSavedProduct,
} from "@/lib/utils/guest-saved";

type DealListCardProps = {
  product: Product;
};

export default function DealListCard({ product }: DealListCardProps) {
  const { isAuthenticated, isShopper } = useAuth();
  const saveMutation = useSaveProductMutation();
  const unsaveMutation = useUnsaveProductMutation();

  const [saved, setSaved] = useState(
    product.isFavourite ?? isGuestProductSaved(product._id),
  );
  const finalPrice = getProductPrice(product);
  const percentOff =
    product.discount != null
      ? discountPercent(product.amount, finalPrice)
      : 0;
  const image =
    getProductImage(product) ??
    `https://picsum.photos/seed/${product._id}/600/600`;
  const vendor = product.vendor;

  async function handleSaveToggle(event: React.MouseEvent) {
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
  }

  return (
    <article className="group flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-traffik-pink/25">
      <Link
        href={`/products/${product._id}`}
        className="relative hidden w-36 shrink-0 overflow-hidden sm:block md:w-44"
      >
        <Image src={image} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="176px" />
        {percentOff > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-traffik-pink px-2 py-0.5 text-[10px] font-bold text-white">
            -{percentOff}%
          </span>
        )}
      </Link>

      <div className="relative m-4 h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-200 sm:hidden">
        <Image src={image} alt="" fill className="object-cover" sizes="80px" />
        {percentOff > 0 && (
          <span className="absolute left-1 top-1 rounded-full bg-traffik-pink px-1.5 py-0.5 text-[9px] font-bold text-white">
            -{percentOff}%
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-4 pr-4 sm:py-5 sm:pl-0">
        <Link href={`/products/${product._id}`} className="group/title">
          <h3 className="line-clamp-2 text-base font-bold text-[#030803] group-hover/title:text-traffik-pink sm:text-lg">
            {product.name}
          </h3>
        </Link>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold text-[#030803]">{formatNaira(finalPrice)}</span>
          {product.discount && (
            <span className="text-sm text-[#484848] line-through">
              {formatNaira(product.amount)}
            </span>
          )}
          {percentOff > 0 && (
            <span className="rounded-full bg-traffik-amber/15 px-2 py-0.5 text-xs font-bold text-[#030803]">
              Save {formatNaira(product.amount - finalPrice)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#484848]">
          {product.totalRatings > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-traffik-amber text-traffik-amber" aria-hidden />
              {product.rating} ({product.totalRatings})
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-0.5">
            {getProductCategoryName(product)}
          </span>
        </div>

        {vendor?.businessName && (
          <Link
            href={`/stores/${vendor._id ?? product.vendorId}`}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#484848] hover:text-traffik-pink"
          >
            {vendor.businessName}
          </Link>
        )}
      </div>

      <div className="hidden shrink-0 flex-col items-end justify-center gap-2 pr-5 md:flex">
        <button
          type="button"
          onClick={handleSaveToggle}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-traffik-pink/10"
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-traffik-pink text-traffik-pink" : "text-[#484848]"}`} />
        </button>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[#484848] transition-colors group-hover:bg-traffik-pink group-hover:text-white">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </article>
  );
}
