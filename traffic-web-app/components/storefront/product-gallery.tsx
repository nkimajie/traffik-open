"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ProductGalleryProps = {
  images: string[];
  alt: string;
  productId: string;
};

export default function ProductGallery({
  images,
  alt,
  productId,
}: ProductGalleryProps) {
  const gallery =
    images.length > 0
      ? images
      : [`https://picsum.photos/seed/${productId}/800/800`];

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200/80">
        <Image
          src={gallery[activeIndex]}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      {gallery.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gallery.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-all",
                activeIndex === index
                  ? "ring-traffik-pink"
                  : "ring-transparent hover:ring-gray-300",
              )}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
