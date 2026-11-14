"use client";

import CartVendorConflictDialog from "@/components/storefront/cart-vendor-conflict-dialog";
import { useCart } from "@/lib/context/providers/cart-provider";
import { toast } from "sonner";

export default function CartConflictHost() {
  const {
    conflict,
    conflictOpen,
    setConflictOpen,
    resolveSaveForLater,
    resolveReplaceCart,
  } = useCart();

  async function handleSaveForLater() {
    try {
      await resolveSaveForLater();
      toast.success("Saved for later", {
        description: "Find it under Saved items, grouped by store.",
      });
    } catch {
      toast.error("Could not save this item");
    }
  }

  async function handleReplaceCart() {
    try {
      await resolveReplaceCart();
      toast.success("Cart updated", {
        description: "Your previous items were moved to Saved.",
      });
    } catch {
      toast.error("Could not update your cart");
    }
  }

  return (
    <CartVendorConflictDialog
      conflict={conflict}
      open={conflictOpen}
      onOpenChange={setConflictOpen}
      onSaveForLater={handleSaveForLater}
      onReplaceCart={handleReplaceCart}
    />
  );
}
