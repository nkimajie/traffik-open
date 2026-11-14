"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatNaira } from "@/lib/utils/format-price";
import { cn } from "@/lib/utils";

export type VendorProductCardData = {
  id: string;
  name: string;
  image?: string | null;
  categoryLabel?: string;
  price: number;
  soldCount?: number;
  likeCount?: number;
  href?: string;
};

type VendorProductCardProps = {
  product: VendorProductCardData;
  className?: string;
};

export default function VendorProductCard({
  product,
  className,
}: VendorProductCardProps) {
  const content = (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-gray-100 bg-white transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/5] bg-gray-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 50vw, 220px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
        {product.soldCount != null && product.soldCount > 0 && (
          <span className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#030803] shadow-sm">
            Sold {product.soldCount}
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1 text-xs text-[#484848]">
          <Heart className="h-3.5 w-3.5 fill-traffik-pink text-traffik-pink" />
          <span>{(product.likeCount ?? 0).toLocaleString()}</span>
        </div>
        <h3 className="line-clamp-1 text-sm font-semibold text-[#030803]">
          {product.name}
        </h3>
        {product.categoryLabel ? (
          <p className="line-clamp-1 text-xs text-[#484848]">
            {product.categoryLabel}
          </p>
        ) : null}
        <p className="text-sm font-bold text-[#030803]">
          {formatNaira(product.price)}
        </p>
      </div>
    </article>
  );

  if (product.href) {
    return (
      <Link href={product.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
