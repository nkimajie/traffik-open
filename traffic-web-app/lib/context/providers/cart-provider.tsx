"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Product } from "@/lib/types/api";
import { getProductImage, getProductPrice } from "@/lib/utils/product";
import { useAuth } from "@/lib/context/providers/auth-provider";
import {
  useAddCartItemMutation,
  useCartQuery,
  useClearCartMutation,
  useRemoveCartItemMutation,
  useReplaceCartMutation,
  useSaveCartItemForLaterMutation,
  useUpdateCartItemMutation,
} from "@/lib/services/api/shopper/use-cart.api";
import {
  CART_STORAGE_KEY,
  readGuestCartItems,
  type GuestCartItem,
} from "@/lib/utils/guest-cart";
import {
  CART_VENDOR_CONFLICT,
  type CartVendorConflict,
  isCartVendorConflictError,
} from "@/lib/types/cart-conflict";

export type CartItem = GuestCartItem;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  storeName?: string;
  storeId?: string | null;
  hydrated: boolean;
  isServerCart: boolean;
  isLoading: boolean;
  conflict: CartVendorConflict | null;
  conflictOpen: boolean;
  setConflictOpen: (open: boolean) => void;
  addItem: (
    product: Product,
    quantity?: number,
    variationId?: string,
    options?: { onAdded?: () => void },
  ) => boolean;
  resolveSaveForLater: () => Promise<void>;
  resolveReplaceCart: () => Promise<void>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CART_META_STORAGE_KEY = "traffik-cart-meta";

type StoredCartMeta = Record<
  string,
  {
    name: string;
    image: string;
    vendorId: string;
    vendorName: string;
    variationId?: string;
  }
>;

const CartContext = createContext<CartContextValue | null>(null);

function productToCartItem(
  product: Product,
  quantity: number,
  variationId?: string,
): CartItem {
  const image =
    getProductImage(product) ??
    `https://picsum.photos/seed/${product._id}/600/600`;

  return {
    productId: product._id,
    variationId,
    name: product.name,
    price: getProductPrice(product),
    image,
    quantity,
    vendorId: product.vendorId,
    vendorName: product.vendor?.businessName ?? "Store",
  };
}

function cartItemKey(productId: string, variationId?: string) {
  return variationId ? `${productId}:${variationId}` : productId;
}

function readCartMeta(): StoredCartMeta {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(CART_META_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as StoredCartMeta) : {};
  } catch {
    return {};
  }
}

function writeCartMeta(meta: StoredCartMeta) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_META_STORAGE_KEY, JSON.stringify(meta));
}

function rememberProductMeta(product: Product, variationId?: string) {
  const meta = readCartMeta();
  const image =
    getProductImage(product) ??
    `https://picsum.photos/seed/${product._id}/600/600`;
  meta[cartItemKey(product._id, variationId)] = {
    name: product.name,
    image,
    vendorId: product.vendorId,
    vendorName: product.vendor?.businessName ?? "Store",
    variationId,
  };
  writeCartMeta(meta);
}

function buildGuestConflict(
  currentItems: CartItem[],
  product: Product,
  quantity: number,
  variationId?: string,
): CartVendorConflict {
  const current = currentItems[0];
  return {
    code: CART_VENDOR_CONFLICT,
    currentVendor: {
      _id: current.vendorId,
      businessName: current.vendorName,
    },
    incomingVendor: {
      _id: product.vendorId,
      businessName: product.vendor?.businessName ?? "Store",
      storeLogo: product.vendor?.storeLogo ?? null,
    },
    incomingProductId: product._id,
    incomingVariationId: variationId,
    incomingQuantity: quantity,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isShopper, isLoading: authLoading } = useAuth();
  const useServerCart = isAuthenticated && isShopper;

  const [localItems, setLocalItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [conflict, setConflict] = useState<CartVendorConflict | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);

  const {
    data: serverCart,
    isLoading: serverCartLoading,
    isFetching: serverCartFetching,
  } = useCartQuery(useServerCart && !authLoading);

  const addCartItemMutation = useAddCartItemMutation();
  const saveForLaterMutation = useSaveCartItemForLaterMutation();
  const replaceCartMutation = useReplaceCartMutation();
  const updateCartItemMutation = useUpdateCartItemMutation();
  const removeCartItemMutation = useRemoveCartItemMutation();
  const clearCartMutation = useClearCartMutation();

  useEffect(() => {
    if (authLoading) return;

    if (!useServerCart) {
      setLocalItems(readGuestCartItems());
    }

    setHydrated(true);
  }, [authLoading, useServerCart]);

  useEffect(() => {
    if (!hydrated || useServerCart) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(localItems));
  }, [localItems, hydrated, useServerCart]);

  const serverItems = useMemo(() => {
    if (!serverCart?.items?.length) return [] as CartItem[];
    const meta = readCartMeta();
    const vendorFromCart = serverCart.vendor;

    return serverCart.items.map((item) => {
      const key = cartItemKey(item.productId, item.variationId);
      const cached = meta[key] ?? meta[item.productId];
      const product = item.product;

      return {
        productId: item.productId,
        variationId: item.variationId,
        name: product?.name ?? cached?.name ?? "Product",
        price: item.price,
        image:
          product?.images?.[0] ??
          cached?.image ??
          `https://picsum.photos/seed/${item.productId}/600/600`,
        quantity: item.quantity,
        vendorId:
          item.vendorId ??
          product?.vendorId ??
          cached?.vendorId ??
          vendorFromCart?._id ??
          "",
        vendorName:
          vendorFromCart?.businessName ??
          product?.vendor?.businessName ??
          cached?.vendorName ??
          "Store",
      };
    });
  }, [serverCart]);

  const items = useServerCart ? serverItems : localItems;

  const storeName = useMemo(() => {
    if (useServerCart && serverCart?.vendor?.businessName) {
      return serverCart.vendor.businessName;
    }
    return items[0]?.vendorName;
  }, [useServerCart, serverCart, items]);

  const storeId = useMemo(() => {
    if (useServerCart) return serverCart?.vendorId ?? serverCart?.vendor?._id ?? null;
    return items[0]?.vendorId ?? null;
  }, [useServerCart, serverCart, items]);

  const addItem = useCallback(
    (
      product: Product,
      quantity = 1,
      variationId?: string,
      options?: { onAdded?: () => void },
    ): boolean => {
      rememberProductMeta(product, variationId);

      if (useServerCart) {
        addCartItemMutation.mutate(
          { productId: product._id, quantity, variationId },
          {
            onSuccess: () => options?.onAdded?.(),
            onError: (error) => {
              if (isCartVendorConflictError(error)) {
                setConflict(error.conflict);
                setConflictOpen(true);
              }
            },
          },
        );
        return true;
      }

      if (
        localItems.length > 0 &&
        localItems[0].vendorId &&
        product.vendorId &&
        localItems[0].vendorId !== product.vendorId
      ) {
        setConflict(buildGuestConflict(localItems, product, quantity, variationId));
        setConflictOpen(true);
        return false;
      }

      setLocalItems((current) => {
        const existing = current.find(
          (item) =>
            item.productId === product._id &&
            item.variationId === variationId,
        );
        if (existing) {
          return current.map((item) =>
            item.productId === product._id &&
            item.variationId === variationId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [...current, productToCartItem(product, quantity, variationId)];
      });
      options?.onAdded?.();
      return true;
    },
    [useServerCart, addCartItemMutation, localItems],
  );

  const resolveSaveForLater = useCallback(async () => {
    if (!conflict) return;

    if (useServerCart) {
      await saveForLaterMutation.mutateAsync(conflict.incomingProductId);
    } else {
      const { toggleGuestSavedProduct } = await import("@/lib/utils/guest-saved");
      toggleGuestSavedProduct(conflict.incomingProductId);
    }

    setConflict(null);
    setConflictOpen(false);
  }, [conflict, useServerCart, saveForLaterMutation]);

  const resolveReplaceCart = useCallback(async () => {
    if (!conflict) return;

    const payload = {
      productId: conflict.incomingProductId,
      quantity: conflict.incomingQuantity,
      variationId: conflict.incomingVariationId,
    };

    if (useServerCart) {
      await replaceCartMutation.mutateAsync(payload);
    } else {
      const currentProductIds = Array.from(
        new Set(localItems.map((item) => item.productId)),
      );
      const { toggleGuestSavedProduct } = await import("@/lib/utils/guest-saved");
      for (const productId of currentProductIds) {
        toggleGuestSavedProduct(productId);
      }

      setLocalItems([
        {
          productId: conflict.incomingProductId,
          variationId: conflict.incomingVariationId,
          name: "Product",
          price: 0,
          image: `https://picsum.photos/seed/${conflict.incomingProductId}/600/600`,
          quantity: conflict.incomingQuantity,
          vendorId: conflict.incomingVendor._id,
          vendorName: conflict.incomingVendor.businessName ?? "Store",
        },
      ]);
    }

    setConflict(null);
    setConflictOpen(false);
  }, [conflict, useServerCart, replaceCartMutation, localItems]);

  const removeItem = useCallback(
    (productId: string) => {
      if (useServerCart) {
        removeCartItemMutation.mutate(productId);
        return;
      }
      setLocalItems((current) =>
        current.filter((item) => item.productId !== productId),
      );
    },
    [useServerCart, removeCartItemMutation],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(productId);
        return;
      }

      if (useServerCart) {
        updateCartItemMutation.mutate({ productId, quantity });
        return;
      }

      setLocalItems((current) =>
        current.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      );
    },
    [useServerCart, removeItem, updateCartItemMutation],
  );

  const clearCart = useCallback(() => {
    if (useServerCart) {
      clearCartMutation.mutate();
      return;
    }
    setLocalItems([]);
  }, [useServerCart, clearCartMutation]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(() => {
    if (useServerCart && serverCart) {
      return serverCart.subtotal;
    }
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [useServerCart, serverCart, items]);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      storeName,
      storeId,
      hydrated: hydrated && !authLoading,
      isServerCart: useServerCart,
      isLoading:
        authLoading ||
        (useServerCart && (serverCartLoading || serverCartFetching)),
      conflict,
      conflictOpen,
      setConflictOpen,
      addItem,
      resolveSaveForLater,
      resolveReplaceCart,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [
      items,
      itemCount,
      subtotal,
      storeName,
      storeId,
      hydrated,
      authLoading,
      useServerCart,
      serverCartLoading,
      serverCartFetching,
      conflict,
      conflictOpen,
      addItem,
      resolveSaveForLater,
      resolveReplaceCart,
      removeItem,
      updateQuantity,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
