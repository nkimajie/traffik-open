"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { createVoucher, fetchVouchers } from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OrderListSkeleton } from "@/components/ui/list-skeletons";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(3, "Code must be at least 3 characters"),
  percentage: z.coerce.number().min(1).max(100),
  expiringDate: z.string().min(1, "Expiry date is required"),
});

type FormValues = z.infer<typeof schema>;

export default function AdminVouchersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [showForm, setShowForm] = useState(false);

  const vouchersQuery = useQuery({
    queryKey: [QueryKeys.VOUCHERS] as const,
    queryFn: fetchVouchers,
    enabled: isAuthenticated,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
  });

  const mutation = useMutation({
    mutationFn: createVoucher,
    onSuccess: () => {
      handleSuccessToast({ description: "Voucher created." });
      reset();
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.VOUCHERS] });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  if (authLoading || vouchersQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <OrderListSkeleton count={4} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const vouchers = vouchersQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#030803] sm:text-3xl">Vouchers</h1>
          <p className="mt-1 text-sm text-[#484848]">
            Platform discount codes shoppers can apply at checkout.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Create voucher"}
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit((values) =>
            mutation.mutate({
              ...values,
              expiringDate: new Date(values.expiringDate).toISOString(),
            }),
          )}
          className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-[#030803]">New voucher</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input label="Name" placeholder="Summer sale" {...register("name")} />
              {errors.name ? (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              ) : null}
            </div>
            <div>
              <Input label="Code" placeholder="SUMMER2026" {...register("code")} />
              {errors.code ? (
                <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
              ) : null}
            </div>
            <div>
              <Input
                label="Discount %"
                type="number"
                min={1}
                max={100}
                {...register("percentage")}
              />
              {errors.percentage ? (
                <p className="mt-1 text-sm text-red-500">
                  {errors.percentage.message}
                </p>
              ) : null}
            </div>
            <div>
              <Input
                label="Expires on"
                type="datetime-local"
                {...register("expiringDate")}
              />
              {errors.expiringDate ? (
                <p className="mt-1 text-sm text-red-500">
                  {errors.expiringDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create voucher"}
          </Button>
        </form>
      ) : null}

      {vouchersQuery.error ? (
        <ErrorState
          title="Could not load vouchers"
          onRetry={() => vouchersQuery.refetch()}
        />
      ) : !vouchers.length ? (
        <EmptyState
          icon={Ticket}
          title="No active vouchers"
          description="Create a discount code for shoppers to use at checkout."
        />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {vouchers.map((voucher) => (
            <li
              key={voucher._id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-[#030803]">{voucher.name}</p>
                <p className="text-sm text-[#484848]">
                  Code{" "}
                  <span className="font-mono font-medium text-[#030803]">
                    {voucher.code}
                  </span>
                </p>
              </div>
              <div className="text-sm text-[#484848]">
                <span className="font-semibold text-traffik-pink">
                  {voucher.percentage}% off
                </span>
                {" · "}
                Expires{" "}
                {new Date(voucher.expiringDate).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
