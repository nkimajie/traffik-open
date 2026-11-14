"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addCartItem,
  logoutShopper,
  saveProduct,
} from "@/lib/services/api/shopper/shopper.api";
import { queryClient } from "@/lib/services/config/query-client";
import { QueryKeys } from "@/lib/services/config/query-keys";
import {
  clearGuestCartStorage,
  readGuestCartItems,
} from "@/lib/utils/guest-cart";
import {
  clearGuestSavedStorage,
  readGuestSavedProducts,
} from "@/lib/utils/guest-saved";
import { isCartVendorConflictError } from "@/lib/types/cart-conflict";
import { clearLegacyVendorOnboardingStorage } from "@/lib/schemas/vendor-store-form.schema";
import { getVendorOnboardingPath } from "@/lib/constants/vendor-onboarding";

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isVerified: boolean;
  isSignupCompleted?: boolean;
  isApproved?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isShopper: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  login: (token: string, userData: User, returnTo?: string) => void;
  markEmailVerified: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getPostLoginPath(user: User, returnTo?: string): string {
  if (user.role === "user" || user.role === "shopper") {
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      return returnTo;
    }
    return "/account";
  }
  if (user.role === "admin") {
    if (
      returnTo &&
      returnTo.startsWith("/admin") &&
      !returnTo.startsWith("//")
    ) {
      return returnTo;
    }
    return "/admin";
  }
  if (user.role === "vendor") {
    const onboardingPath = getVendorOnboardingPath(user, user.isVerified);
    if (onboardingPath === "/dashboard") {
      if (
        returnTo &&
        returnTo.startsWith("/dashboard") &&
        !returnTo.startsWith("//")
      ) {
        return returnTo;
      }
      return "/dashboard";
    }
    if (
      returnTo &&
      returnTo.startsWith("/create-business") &&
      !returnTo.startsWith("//")
    ) {
      return returnTo;
    }
    return onboardingPath;
  }
  return "/dashboard";
}

function setAuthCookies(token: string, user: User) {
  document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
  document.cookie = `role=${user.role}; path=/; max-age=86400; SameSite=Strict`;
  document.cookie = `isVerified=${user.isVerified ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;

  if (user.role === "vendor") {
    const onboardingPath = getVendorOnboardingPath(user, user.isVerified);
    document.cookie = `onboardingComplete=${onboardingPath === "/dashboard" ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `vendorSignupComplete=${user.isSignupCompleted ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `vendorApproved=${user.isApproved ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
  }
}

function clearAuthCookies() {
  document.cookie = "token=; path=/; max-age=0";
  document.cookie = "role=; path=/; max-age=0";
  document.cookie = "isVerified=; path=/; max-age=0";
  document.cookie = "onboardingComplete=; path=/; max-age=0";
  document.cookie = "vendorSignupComplete=; path=/; max-age=0";
  document.cookie = "vendorApproved=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = () => {
      if (typeof window !== "undefined") {
        let storedToken = localStorage.getItem("token");

        if (!storedToken) {
          const cookies = document.cookie.split(";");
          const tokenCookie = cookies.find((c) =>
            c.trim().startsWith("token="),
          );
          if (tokenCookie) {
            storedToken = tokenCookie.split("=")[1];
            localStorage.setItem("token", storedToken);
          }
        }

        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
          try {
            const userData = JSON.parse(storedUser) as User;
            clearLegacyVendorOnboardingStorage();
            setToken(storedToken);
            setUser(userData);
            setAuthCookies(storedToken, userData);
          } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            clearAuthCookies();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, userData: User, returnTo?: string) => {
    if (typeof window !== "undefined") {
      const previousUserId = user?._id;
      if (previousUserId && previousUserId !== userData._id) {
        queryClient.clear();
      } else {
        queryClient.removeQueries({ queryKey: [QueryKeys.VENDOR_PROFILE] });
      }
      clearLegacyVendorOnboardingStorage();

      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setAuthCookies(newToken, userData);
    }
    setToken(newToken);
    setUser(userData);

    const isShopperUser =
      userData.role === "user" || userData.role === "shopper";
    if (isShopperUser) {
      void mergeGuestSavedIntoServer();
      void mergeGuestCartIntoServer();
    }

    router.push(getPostLoginPath(userData, returnTo));
  };

  const markEmailVerified = () => {
    if (!user) return;

    const updatedUser = { ...user, isVerified: true };
    setUser(updatedUser);

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(updatedUser));
      if (token) {
        setAuthCookies(token, updatedUser);
      }
    }
  };

  async function mergeGuestSavedIntoServer() {
    const guestSaved = readGuestSavedProducts();
    if (guestSaved.length === 0) return;

    try {
      for (const item of guestSaved) {
        try {
          await saveProduct(item.productId);
        } catch {
          // Already saved or inactive product — safe to ignore.
        }
      }
      clearGuestSavedStorage();
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
    } catch {
      // Keep local saved list if merge fails.
    }
  }

  async function mergeGuestCartIntoServer() {
    const guestItems = readGuestCartItems();
    if (guestItems.length === 0) return;

    const firstVendorId = guestItems[0]?.vendorId;
    const sameVendorItems = guestItems.filter(
      (item) => item.vendorId === firstVendorId,
    );
    const otherVendorProductIds = Array.from(
      new Set(
        guestItems
          .filter((item) => item.vendorId !== firstVendorId)
          .map((item) => item.productId),
      ),
    );

    try {
      for (const item of sameVendorItems) {
        await addCartItem({
          productId: item.productId,
          quantity: item.quantity,
          variationId: item.variationId,
        });
      }

      for (const productId of otherVendorProductIds) {
        try {
          await saveProduct(productId);
        } catch {
          // Ignore duplicates or inactive products.
        }
      }

      clearGuestCartStorage();
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.CART] });
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.SAVED_PRODUCTS_GROUPED],
      });
    } catch (error) {
      if (!isCartVendorConflictError(error)) {
        // Keep local cart if merge fails for an unexpected reason.
      }
    }
  }

  const logout = () => {
    const role = user?.role;
    const isShopperUser = role === "user" || role === "shopper";
    if (isShopperUser && token) {
      // Best effort: invalidate the token server-side so it cannot be reused.
      // Local sign-out below proceeds regardless of the outcome.
      void logoutShopper(token).catch(() => undefined);
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      clearAuthCookies();
      clearLegacyVendorOnboardingStorage();
    }
    queryClient.clear();
    setToken(null);
    setUser(null);
    if (isShopperUser) {
      router.push("/sign-in");
    } else if (role === "admin") {
      router.push("/admin/login");
    } else {
      router.push("/vendors/sign-in");
    }
  };

  const value = {
    token,
    user,
    isAuthenticated: !!token,
    isLoading,
    isShopper: user?.role === "user" || user?.role === "shopper",
    isVendor: user?.role === "vendor",
    isAdmin: user?.role === "admin",
    login,
    markEmailVerified,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
