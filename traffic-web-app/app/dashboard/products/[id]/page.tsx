"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/providers/auth-provider";
import useGetProductQuery from "@/lib/services/api/products/get-product.api";
import ProductForm from "@/components/features/ProductForm";
import { DetailSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";

type EditProductPageProps = {
  params: { id: string };
};

export default function EditProductPage({ params }: EditProductPageProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { data: product, isLoading, error, refetch } = useGetProductQuery(
    params.id,
  );

  if (authLoading || isLoading) {
    return (
      <div className="p-8 max-w-3xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !product) {
    return (
      <div className="p-8">
        <ErrorState
          title="Product not found"
          message="We couldn't load this product. It may have been removed."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/products"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
          Edit Product
        </h1>
        <p className="text-gray-600 mb-8">Update details for {product.name}.</p>

        <div className="bg-white rounded-lg shadow p-6">
          <ProductForm
            mode="edit"
            product={product}
            onSuccess={() => router.push("/dashboard/products")}
          />
        </div>
      </div>
    </div>
  );
}
