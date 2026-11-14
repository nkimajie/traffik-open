"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CartVendorConflict } from "@/lib/types/cart-conflict";

type CartVendorConflictDialogProps = {
  conflict: CartVendorConflict | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveForLater: () => void;
  onReplaceCart: () => void;
  isPending?: boolean;
};

export default function CartVendorConflictDialog({
  conflict,
  open,
  onOpenChange,
  onSaveForLater,
  onReplaceCart,
  isPending = false,
}: CartVendorConflictDialogProps) {
  if (!conflict) return null;

  const currentName = conflict.currentVendor.businessName ?? "your current store";
  const incomingName = conflict.incomingVendor.businessName ?? "this store";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>One store at a time</DialogTitle>
          <DialogDescription>
            Your cart has items from <strong>{currentName}</strong>. You
            can&apos;t order from two stores in one go yet — Market Assist is
            coming soon.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-[#484848]">
          What would you like to do with the item from{" "}
          <strong>{incomingName}</strong>?
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="signIn"
            className="w-full rounded-xl"
            disabled={isPending}
            onClick={onSaveForLater}
          >
            Save {incomingName} item for later
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            disabled={isPending}
            onClick={onReplaceCart}
          >
            Start a new cart with {incomingName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
