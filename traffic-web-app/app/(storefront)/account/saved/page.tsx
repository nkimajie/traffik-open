"use client";

import { useMemo, useState } from "react";
import { Heart, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StoreCard from "@/components/storefront/store-card";
import SavedStoreSection from "@/components/storefront/saved-store-section";
import {
  useSavedProductsGroupedQuery,
  useSavedProductsQuery,
  useSavedStoresQuery,
} from "@/lib/services/api/shopper/use-saved.api";
import { StoreGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { groupProductsByStore } from "@/lib/utils/saved-products";

export default function AccountSavedPage() {
  const [tab, setTab] = useState("products");

  const {
    data: groupedFromApi,
    isLoading: groupedLoading,
    error: groupedError,
    refetch: refetchGrouped,
  } = useSavedProductsGroupedQuery();

  const {
    data: flatSaved,
    isLoading: flatLoading,
    error: flatError,
    refetch: refetchFlat,
  } = useSavedProductsQuery(
    { page: 1, limit: 100 },
    groupedError != null,
  );

  const {
    data: storesData,
    isLoading: storesLoading,
    error: storesError,
    refetch: refetchStores,
  } = useSavedStoresQuery({ page: 1, limit: 50 });

  const groupedStores = useMemo(() => {
    if (groupedFromApi && groupedFromApi.length > 0) {
      return groupedFromApi;
    }
    if (groupedError && flatSaved?.items?.length) {
      return groupProductsByStore(flatSaved.items);
    }
    return groupedFromApi ?? [];
  }, [groupedFromApi, groupedError, flatSaved?.items]);

  const productsLoading = groupedLoading || (groupedError != null && flatLoading);
  const productsError = groupedError && flatError;

  const savedStores = storesData?.items ?? [];
  const savedProductCount = groupedStores.reduce(
    (sum, group) => sum + group.productCount,
    0,
  );
  const storeGroupCount = groupedStores.length;

  return (
    <div>
      <h2 className="text-lg font-bold text-[#030803] sm:text-xl">Saved items</h2>
      <p className="mt-1 text-sm text-[#484848]">
        Products grouped by store — order from one store at a time, then come back
        for the rest.
      </p>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="products">
            Products ({savedProductCount})
          </TabsTrigger>
          <TabsTrigger value="stores">
            Stores ({storesData?.meta.total ?? savedStores.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {productsLoading ? (
            <div className="mt-4 space-y-4">
              <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
            </div>
          ) : productsError ? (
            <div className="mt-4">
              <ErrorState
                title="Could not load saved products"
                onRetry={() => {
                  void refetchGrouped();
                  void refetchFlat();
                }}
              />
            </div>
          ) : groupedStores.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No saved products yet"
              description="When you save items from different stores, they'll appear here grouped by store."
              actionLabel="Browse stores"
              actionHref="/stores"
              className="mt-4"
            />
          ) : (
            <div className="mt-4 space-y-6">
              {storeGroupCount > 1 ? (
                <p className="rounded-xl border border-traffik-pink/20 bg-traffik-pink/5 px-4 py-3 text-sm text-[#484848]">
                  You have saved items from{" "}
                  <span className="font-semibold text-[#030803]">
                    {storeGroupCount} stores
                  </span>
                  . Checkout one store at a time, then return here for the next.
                </p>
              ) : null}

              {groupedStores.map((group) => (
                <SavedStoreSection key={group.vendor._id} group={group} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stores">
          {storesLoading ? (
            <div className="mt-4">
              <StoreGridSkeleton count={4} />
            </div>
          ) : storesError ? (
            <div className="mt-4">
              <ErrorState onRetry={() => refetchStores()} />
            </div>
          ) : savedStores.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No saved stores yet"
              description="Save stores you love from the storefront to find them quickly here."
              actionLabel="Browse stores"
              actionHref="/stores"
              className="mt-4"
            />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {savedStores.map((store) => (
                <StoreCard key={store._id} store={store} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
