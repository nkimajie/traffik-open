"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import SavedProductItem from "@/components/storefront/saved-product-item";
import { isStoreOpen } from "@/lib/utils/business-hours";
import type { Product, SavedProductsByStore } from "@/lib/types/api";
import { useCart } from "@/lib/context/providers/cart-provider";
import { toast } from "sonner";

type SavedStoreSectionProps = {
  group: SavedProductsByStore;
};

export default function SavedStoreSection({ group }: SavedStoreSectionProps) {
  const { addItem } = useCart();
  const [movingProductId, setMovingProductId] = useState<string | null>(null);

  const vendor = group.vendor;
  const storeName = vendor.businessName ?? "Store";
  const logo =
    vendor.storeLogo ??
    vendor.storeCoverPhoto ??
    `https://picsum.photos/seed/${vendor._id}/120/120`;
  const isOpen = isStoreOpen(vendor.businessHours);

  function moveProductToCart(product: Product) {
    setMovingProductId(product._id);
    addItem(product, 1, undefined, {
      onAdded: () => {
        setMovingProductId(null);
        toast.success("Added to cart", { description: product.name });
      },
    });
    window.setTimeout(() => setMovingProductId(null), 500);
  }

  function addAllToCart() {
    const products = group.products;
    if (products.length === 0) return;

    function addAt(index: number) {
      if (index >= products.length) {
        toast.success(`Added ${products.length} items from ${storeName}`);
        return;
      }
      addItem(products[index], 1, undefined, {
        onAdded: () => addAt(index + 1),
      });
    }

    addAt(0);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/80">
            <Image
              src={logo}
              alt={storeName}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/stores/${vendor._id}`}
                className="truncate text-base font-bold text-[#030803] hover:text-traffik-pink sm:text-lg"
              >
                {storeName}
              </Link>
              {vendor.isVerified ? (
                <BadgeCheck
                  className="h-4 w-4 shrink-0 text-traffik-green"
                  aria-label="Verified store"
                />
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-[#484848] sm:text-sm">
              {group.productCount} saved item
              {group.productCount !== 1 ? "s" : ""}
              {vendor.businessHours?.length ? (
                <>
                  {" "}
                  ·{" "}
                  <span className={isOpen ? "text-traffik-green" : "text-[#484848]"}>
                    {isOpen ? "Open now" : "Closed"}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <Button
          variant="signIn"
          size="sm"
          className="shrink-0 rounded-xl"
          onClick={addAllToCart}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          Add all to cart
        </Button>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {group.products.map((product) => (
          <SavedProductItem
            key={product._id}
            product={product}
            movePending={movingProductId === product._id}
            onMoveToCart={() => moveProductToCart(product)}
          />
        ))}
      </div>

      {group.products.length === 0 ? (
        <div className="flex items-center gap-2 px-5 pb-5 text-sm text-[#484848]">
          <Store className="h-4 w-4" />
          No products in this store section.
        </div>
      ) : null}
    </section>
  );
}
