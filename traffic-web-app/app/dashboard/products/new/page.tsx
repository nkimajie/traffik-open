"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/providers/auth-provider";
import ProductForm from "@/components/features/ProductForm";
import VendorProductCreateGate from "@/components/dashboard/vendor-product-create-gate";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewProductPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <nav className="mb-6 text-sm text-[#484848]">
        <Link href="/dashboard/products" className="hover:text-[#030803]">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-[#030803]">Add Product</span>
      </nav>

      <VendorProductCreateGate>
        <div className="max-w-3xl">
          <h1 className="mb-6 text-2xl font-bold text-[#030803]">Add Product</h1>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <ProductForm
              mode="create"
              onSuccess={() => router.push("/dashboard/products")}
              submitLabel="Submit"
            />
          </div>
        </div>
      </VendorProductCreateGate>
    </div>
  );
}
