"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/context/providers/cart-provider";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  useSaveProductMutation,
  useUnsaveProductMutation,
} from "@/lib/services/api/shopper/use-saved.api";
import {
  isGuestProductSaved,
  toggleGuestSavedProduct,
} from "@/lib/utils/guest-saved";
import type { Product } from "@/lib/types/api";

type ProductPurchaseActionsProps = {
  product: Product;
};

export default function ProductPurchaseActions({
  product,
}: ProductPurchaseActionsProps) {
  const { addItem } = useCart();
  const { isAuthenticated, isShopper } = useAuth();
  const router = useRouter();
  const saveMutation = useSaveProductMutation();
  const unsaveMutation = useUnsaveProductMutation();

  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(
    product.isFavourite ?? isGuestProductSaved(product._id),
  );

  function handleAddToCart() {
    addItem(product, quantity, undefined, {
      onAdded: () => {
        toast.success("Added to cart", {
          description: `${quantity} × ${product.name}`,
          action: {
            label: "View cart",
            onClick: () => router.push("/cart"),
          },
        });
      },
    });
  }

  async function handleSaveToggle() {
    if (isAuthenticated && isShopper) {
      try {
        if (saved) {
          await unsaveMutation.mutateAsync(product._id);
          setSaved(false);
          toast.success("Removed from saved");
        } else {
          await saveMutation.mutateAsync(product._id);
          setSaved(true);
          toast.success("Saved for later");
        }
      } catch {
        toast.error("Could not update saved items");
      }
      return;
    }

    const next = toggleGuestSavedProduct(product._id);
    setSaved(next);
    toast.success(next ? "Saved for later" : "Removed from saved");
  }

  return (
    <>
      <div className="mt-8 flex items-center gap-4">
        <span className="text-sm font-medium text-[#484848]">Quantity</span>
        <div className="inline-flex items-center rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-[#484848] transition-colors hover:bg-gray-50"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[2.5rem] text-center text-sm font-semibold text-[#030803]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="flex h-10 w-10 items-center justify-center text-[#484848] transition-colors hover:bg-gray-50"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="signIn"
          size="lg"
          className="flex-1 rounded-xl"
          onClick={handleAddToCart}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          Add to cart
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 rounded-xl"
          onClick={handleSaveToggle}
          disabled={saveMutation.isPending || unsaveMutation.isPending}
        >
          {saved ? "Saved" : "Save for later"}
        </Button>
      </div>

      <p className="mt-4 text-xs text-[#484848]">
        Your payment is held in Kashia escrow until you confirm delivery.{" "}
        <Link href="/how-it-works" className="font-medium text-traffik-pink hover:underline">
          How it works
        </Link>
      </p>
    </>
  );
}
