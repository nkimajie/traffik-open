"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { createCategory } from "@/lib/services/api/admin/admin.api";
import { fetchCategories } from "@/lib/services/api/catalog/catalog.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminCategoriesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: [QueryKeys.CATEGORIES] as const,
    queryFn: fetchCategories,
    enabled: isAuthenticated,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      handleSuccessToast({ description: "Category created." });
      reset();
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.CATEGORIES] });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  if (authLoading || categoriesQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={4} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">
            Categories
          </h1>
          <p className="mt-1 text-sm text-[#484848]">
            Platform taxonomy used by vendors and the storefront.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add category"}
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-[#030803]">
            New category
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Name"
                placeholder="e.g. Electronics"
                {...register("name")}
              />
              {errors.name ? (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              ) : null}
            </div>
            <div>
              <Input
                label="Description (optional)"
                placeholder="Short description"
                {...register("description")}
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create category"}
          </Button>
        </form>
      ) : null}

      {categoriesQuery.error ? (
        <ErrorState
          title="Could not load categories"
          onRetry={() => categoriesQuery.refetch()}
        />
      ) : !categories.length ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create the first category for the platform catalog."
        />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {categories.map((category) => (
            <li key={category._id} className="px-5 py-4">
              <p className="font-semibold text-[#030803]">{category.name}</p>
              {category.description ? (
                <p className="mt-1 text-sm text-[#484848]">{category.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
