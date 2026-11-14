"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils/format-price";
import type { Product } from "@/lib/types/api";
import { getProductImage, getProductPrice } from "@/lib/utils/product";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useUnsaveProductMutation } from "@/lib/services/api/shopper/use-saved.api";

type SavedProductItemProps = {
  product: Product;
  onMoveToCart: () => void;
  movePending?: boolean;
};

export default function SavedProductItem({
  product,
  onMoveToCart,
  movePending = false,
}: SavedProductItemProps) {
  const { isAuthenticated, isShopper } = useAuth();
  const unsaveMutation = useUnsaveProductMutation();
  const finalPrice = getProductPrice(product);
  const image =
    getProductImage(product) ??
    `https://picsum.photos/seed/${product._id}/200/200`;

  async function handleUnsave() {
    if (!isAuthenticated || !isShopper) return;
    try {
      await unsaveMutation.mutateAsync(product._id);
      toast.success("Removed from saved");
    } catch {
      toast.error("Could not remove item");
    }
  }

  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:gap-4 sm:p-4">
      <Link
        href={`/products/${product._id}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-24 sm:w-24"
      >
        <Image
          src={image}
          alt={product.name}
          fill
          className="object-cover"
          sizes="96px"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <Link
            href={`/products/${product._id}`}
            className="line-clamp-2 text-sm font-semibold text-[#030803] hover:text-traffik-pink sm:text-base"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-base font-bold text-[#030803] sm:text-lg">
            {formatNaira(finalPrice)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl border-traffik-pink/30 text-traffik-pink hover:bg-traffik-pink/5"
            disabled={movePending}
            onClick={onMoveToCart}
          >
            <ShoppingBag className="mr-1.5 h-4 w-4" />
            Move to cart
          </Button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#484848] hover:bg-white hover:text-traffik-pink"
            disabled={unsaveMutation.isPending}
            onClick={() => void handleUnsave()}
          >
            <Heart className="h-3.5 w-3.5 fill-traffik-pink text-traffik-pink" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
