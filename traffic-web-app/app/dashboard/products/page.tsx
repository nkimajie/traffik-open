"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useGetVendorProductsQuery } from "@/lib/services/api/products/get-products.api";
import { fetchVendorDashboard } from "@/lib/services/api/shopper/shopper.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { ProductGridSkeleton } from "@/components/ui/list-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import PendingApprovalNotice from "@/components/dashboard/pending-approval-notice";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import VendorProductCard, {
  type VendorProductCardData,
} from "@/components/dashboard/vendor-product-card";
import {
  getProductCategoryName,
  getProductImage,
  getProductPrice,
} from "@/lib/utils/product";
import type { Product } from "@/lib/types/api";

const PAGE_SIZE = 12;

function toCard(product: Product): VendorProductCardData {
  const category = getProductCategoryName(product);
  return {
    id: product._id,
    name: product.name,
    image: getProductImage(product),
    categoryLabel: category !== "Uncategorized" ? category : undefined,
    price: getProductPrice(product),
    href: `/dashboard/products/${product._id}`,
  };
}

export default function ProductsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: vendorProfile } = useVendorProfile();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useGetVendorProductsQuery(
    page,
    PAGE_SIZE,
  );

  const { data: dashboardData } = useQuery({
    queryKey: [QueryKeys.VENDOR_DASHBOARD] as const,
    queryFn: () => fetchVendorDashboard(),
    enabled: isAuthenticated,
  });

  const canCreateProducts = vendorProfile?.isApproved === true;
  const showPendingApproval =
    vendorProfile != null && vendorProfile.isApproved !== true;

  const topPerformers = useMemo(() => {
    const items = dashboardData?.topPerformers ?? [];
    return items.map((item) => ({
      id: item.productId,
      name: item.name,
      image: item.image,
      categoryLabel: [item.category, item.subcategory]
        .filter(Boolean)
        .join(" / "),
      price: 0,
      soldCount: item.soldCount,
      likeCount: item.likeCount,
      href: `/dashboard/products/${item.productId}`,
    }));
  }, [dashboardData?.topPerformers]);

  if (authLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const products = data?.items ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const allItems = products.map(toCard);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">
          Products
        </h1>
        {canCreateProducts ? (
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-[#030803] bg-white px-5 hover:bg-gray-50"
          >
            <Link href="/dashboard/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add product
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            variant="outline"
            className="rounded-xl"
            title="Product creation unlocks after store verification"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add product
          </Button>
        )}
      </div>

      {showPendingApproval && (
        <div className="mb-6">
          <PendingApprovalNotice email={vendorProfile.email} compact />
        </div>
      )}

      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : error ? (
        <ErrorState title="Could not load products" onRetry={() => refetch()} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={
            canCreateProducts
              ? "Start adding products to your inventory"
              : "Once your store is verified, you can list products and start selling"
          }
          actionLabel={canCreateProducts ? "Add your first product" : undefined}
          onAction={
            canCreateProducts
              ? () => {
                  window.location.href = "/dashboard/products/new";
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-10">
          {topPerformers.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#030803]">
                Top performers
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {topPerformers.map((product) => (
                  <VendorProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-[#030803]">
              All items
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {allItems.map((product) => (
                <VendorProductCard key={product.id} product={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-[#484848]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
