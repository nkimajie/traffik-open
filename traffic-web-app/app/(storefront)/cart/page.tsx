"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Breadcrumbs from "@/components/storefront/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useCart } from "@/lib/context/providers/cart-provider";
import { useAddressesQuery } from "@/lib/services/api/shopper/use-addresses.api";
import {
  useCreateOrderMutation,
  usePreviewOrderMutation,
} from "@/lib/services/api/shopper/use-orders.api";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNaira } from "@/lib/utils/format-price";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import type { Address } from "@/lib/types/api";

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated, isShopper } = useAuth();
  const {
    items,
    itemCount,
    subtotal,
    storeName,
    updateQuantity,
    removeItem,
    clearCart,
    hydrated,
    isLoading,
    isServerCart,
  } = useCart();
  const { data: addresses = [], isLoading: addressesLoading } =
    useAddressesQuery(isAuthenticated && isShopper);
  const previewOrderMutation = usePreviewOrderMutation();
  const createOrderMutation = useCreateOrderMutation();
  const { handleErrorToast } = useToastAlert();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<
    "DOOR_DELIVERY" | "PICKUP_STATION"
  >("DOOR_DELIVERY");
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);

  const defaultAddress = useMemo(
    () => addresses.find((address) => address.isDefault) ?? addresses[0],
    [addresses],
  );

  const activeAddressId = selectedAddressId ?? defaultAddress?._id ?? null;

  if (!hydrated || (isServerCart && isLoading)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <OrderListSkeleton count={3} />
      </div>
    );
  }

  function openCheckout() {
    if (!isAuthenticated || !isShopper) {
      router.push("/sign-in?returnTo=/cart");
      return;
    }

    if (addresses.length === 0) {
      handleErrorToast({
        description: "Add a delivery address before checkout.",
      });
      router.push("/account/addresses");
      return;
    }

    setSelectedAddressId(defaultAddress?._id ?? null);
    setPreviewTotal(null);
    setCheckoutOpen(true);

    if (defaultAddress) {
      previewOrderMutation.mutate(
        {
          addressId: defaultAddress._id,
          deliveryMethod,
        },
        {
          onSuccess: (data) => {
            const total = (data as { total?: number })?.total;
            if (typeof total === "number") setPreviewTotal(total);
          },
        },
      );
    }
  }

  function handleAddressChange(addressId: string) {
    setSelectedAddressId(addressId);
    setPreviewTotal(null);
    previewOrderMutation.mutate(
      { addressId, deliveryMethod },
      {
        onSuccess: (data) => {
          const total = (data as { total?: number })?.total;
          if (typeof total === "number") setPreviewTotal(total);
        },
      },
    );
  }

  function handleDeliveryMethodChange(method: "DOOR_DELIVERY" | "PICKUP_STATION") {
    setDeliveryMethod(method);
    if (!activeAddressId) return;
    setPreviewTotal(null);
    previewOrderMutation.mutate(
      { addressId: activeAddressId, deliveryMethod: method },
      {
        onSuccess: (data) => {
          const total = (data as { total?: number })?.total;
          if (typeof total === "number") setPreviewTotal(total);
        },
      },
    );
  }

  function handlePlaceOrder() {
    if (!activeAddressId) {
      handleErrorToast({ description: "Select a delivery address." });
      return;
    }

    createOrderMutation.mutate(
      { addressId: activeAddressId, deliveryMethod },
      {
        onSuccess: (order) => {
          if (order.paymentUrl) {
            setCheckoutOpen(false);
            window.location.href = order.paymentUrl;
            return;
          }

          setCheckoutOpen(false);
          handleErrorToast({
            description:
              "Payment could not be started. Open the order to retry or contact support.",
          });
          router.push(`/account/orders/${order._id}`);
        },
        onError: () => {
          handleErrorToast({ description: "Checkout failed. Please try again." });
        },
      },
    );
  }

  return (
    <div>
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "Cart" }]} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">Your cart</h1>
            <p className="mt-1 text-sm text-[#484848]">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
              {storeName ? ` · ${storeName}` : ""} · escrow protected
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-sm font-medium text-[#484848] hover:text-traffik-pink"
            >
              Clear cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Browse stores and add items to get started."
            actionLabel="Browse stores"
            actionHref="/stores"
            className="mt-12"
          />
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
              {items.map((item) => (
                <li key={`${item.productId}-${item.variationId ?? "default"}`} className="flex gap-4 p-4 sm:p-5">
                  <Link
                    href={`/products/${item.productId}`}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24"
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.productId}`}
                      className="line-clamp-2 font-semibold text-[#030803] hover:text-traffik-pink"
                    >
                      {item.name}
                    </Link>
                    {item.vendorId ? (
                      <Link
                        href={`/stores/${item.vendorId}`}
                        className="mt-1 block truncate text-xs text-[#484848] hover:text-traffik-pink"
                      >
                        {item.vendorName}
                      </Link>
                    ) : null}
                    <p className="mt-2 font-bold text-[#030803]">
                      {formatNaira(item.price)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center text-[#484848] hover:bg-gray-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center text-[#484848] hover:bg-gray-50"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#484848] hover:text-traffik-pink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>

                  <p className="hidden shrink-0 text-right font-bold text-[#030803] sm:block">
                    {formatNaira(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <h2 className="text-lg font-bold text-[#030803]">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm text-[#484848]">
                <span>Subtotal</span>
                <span className="font-semibold text-[#030803]">
                  {formatNaira(subtotal)}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#484848]">
                Delivery calculated at checkout
              </p>
              <Button
                variant="signIn"
                size="lg"
                className="mt-6 w-full rounded-xl"
                onClick={openCheckout}
              >
                {isAuthenticated && isShopper ? "Checkout" : "Sign in to checkout"}
              </Button>
              <Link
                href="/stores"
                className="mt-3 block text-center text-sm font-medium text-traffik-pink hover:underline"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Choose a delivery address and method to place your order.
            </DialogDescription>
          </DialogHeader>

          {addressesLoading ? (
            <OrderListSkeleton count={2} />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-[#030803]">Delivery address</p>
                <div className="mt-2 space-y-2">
                  {addresses.map((address) => (
                    <AddressOption
                      key={address._id}
                      address={address}
                      selected={activeAddressId === address._id}
                      onSelect={() => handleAddressChange(address._id)}
                    />
                  ))}
                </div>
                <Link
                  href="/account/addresses"
                  className="mt-2 inline-block text-xs font-medium text-traffik-pink hover:underline"
                >
                  Manage addresses
                </Link>
              </div>

              <div>
                <p className="text-sm font-medium text-[#030803]">Delivery method</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleDeliveryMethodChange("DOOR_DELIVERY")}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      deliveryMethod === "DOOR_DELIVERY"
                        ? "border-traffik-pink bg-traffik-pink/5 text-traffik-pink"
                        : "border-gray-200 text-[#484848]"
                    }`}
                  >
                    Door delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeliveryMethodChange("PICKUP_STATION")}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      deliveryMethod === "PICKUP_STATION"
                        ? "border-traffik-pink bg-traffik-pink/5 text-traffik-pink"
                        : "border-gray-200 text-[#484848]"
                    }`}
                  >
                    Pickup station
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                <div className="flex justify-between text-[#484848]">
                  <span>Subtotal</span>
                  <span>{formatNaira(subtotal)}</span>
                </div>
                <div className="mt-2 flex justify-between font-bold text-[#030803]">
                  <span>Total</span>
                  <span>
                    {previewTotal != null
                      ? formatNaira(previewTotal)
                      : previewOrderMutation.isPending
                        ? "Calculating…"
                        : formatNaira(subtotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signIn"
              onClick={handlePlaceOrder}
              disabled={
                !activeAddressId ||
                createOrderMutation.isPending ||
                previewOrderMutation.isPending
              }
            >
              Place order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressOption({
  address,
  selected,
  onSelect,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
        selected
          ? "border-traffik-pink bg-traffik-pink/5"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <p className="font-medium text-[#030803]">
        {address.fullName}
        {address.isDefault ? " · Default" : ""}
      </p>
      <p className="mt-1 text-[#484848]">
        {address.streetAddress}, {address.city}
      </p>
    </button>
  );
}
