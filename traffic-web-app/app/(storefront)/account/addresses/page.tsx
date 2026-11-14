"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Address } from "@/lib/types/api";
import {
  useAddressesQuery,
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  useUpdateAddressMutation,
} from "@/lib/services/api/shopper/use-addresses.api";
import { StoreGridSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const addressSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  landmark: z.string().optional(),
  zipCode: z.string().min(1, "Zip code is required"),
  phone: z.string().min(1, "Phone is required"),
  isDefault: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

export default function AccountAddressesPage() {
  const { data: addresses = [], isLoading, error, refetch } = useAddressesQuery();
  const createAddressMutation = useCreateAddressMutation();
  const updateAddressMutation = useUpdateAddressMutation();
  const deleteAddressMutation = useDeleteAddressMutation();
  const setDefaultMutation = useSetDefaultAddressMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { isDefault: false },
  });

  function openAdd() {
    setEditingId(null);
    reset({
      fullName: "",
      state: "",
      city: "",
      streetAddress: "",
      landmark: "",
      zipCode: "",
      phone: "",
      isDefault: false,
    });
    setDialogOpen(true);
  }

  function openEdit(address: Address) {
    setEditingId(address._id);
    reset({
      fullName: address.fullName,
      state: address.state,
      city: address.city,
      streetAddress: address.streetAddress,
      landmark: address.landmark ?? "",
      zipCode: address.zipCode,
      phone: address.phone,
      isDefault: address.isDefault ?? false,
    });
    setDialogOpen(true);
  }

  function onSubmit(values: AddressFormValues) {
    if (editingId) {
      updateAddressMutation.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            handleSuccessToast({ description: "Address updated." });
            setDialogOpen(false);
          },
          onError: () => {
            handleErrorToast({ description: "Could not update address." });
          },
        },
      );
      return;
    }

    createAddressMutation.mutate(values, {
      onSuccess: () => {
        handleSuccessToast({ description: "Address added." });
        setDialogOpen(false);
      },
      onError: () => {
        handleErrorToast({ description: "Could not add address." });
      },
    });
  }

  function handleDelete(id: string) {
    deleteAddressMutation.mutate(id, {
      onSuccess: () => {
        handleSuccessToast({ description: "Address removed." });
      },
      onError: () => {
        handleErrorToast({ description: "Could not remove address." });
      },
    });
  }

  function setDefault(id: string) {
    setDefaultMutation.mutate(id, {
      onSuccess: () => {
        handleSuccessToast({ description: "Default address updated." });
      },
      onError: () => {
        handleErrorToast({ description: "Could not set default address." });
      },
    });
  }

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-[#030803] sm:text-xl">Addresses</h2>
        <div className="mt-6">
          <StoreGridSkeleton count={2} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-bold text-[#030803] sm:text-xl">Addresses</h2>
        <div className="mt-6">
          <ErrorState onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#030803] sm:text-xl">Addresses</h2>
          <p className="mt-1 text-sm text-[#484848]">
            Manage delivery addresses for your orders.
          </p>
        </div>
        <Button variant="signIn" size="sm" className="rounded-xl" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address for faster checkout."
          actionLabel="Add address"
          onAction={openAdd}
          className="mt-6"
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div
              key={address._id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-traffik-pink" aria-hidden />
                  <p className="font-semibold text-[#030803]">{address.fullName}</p>
                </div>
                {address.isDefault && <Badge variant="featured">Default</Badge>}
              </div>
              <p className="mt-2 text-sm text-[#484848]">{address.streetAddress}</p>
              {address.landmark && (
                <p className="text-sm text-[#484848]">{address.landmark}</p>
              )}
              <p className="text-sm text-[#484848]">
                {address.city}, {address.state} {address.zipCode}
              </p>
              <p className="mt-1 text-sm text-[#484848]">{address.phone}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="text-xs font-medium text-traffik-pink hover:underline"
                >
                  Edit
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(address._id)}
                    className="text-xs font-medium text-[#484848] hover:underline"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(address._id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={openAdd}
            className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-[#484848] transition-colors hover:border-traffik-pink/40 hover:bg-traffik-pink/5"
          >
            <Plus className="h-8 w-8 text-[#484848]/40" aria-hidden />
            <span className="mt-2 text-sm font-medium">Add new address</span>
          </button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit address" : "Add new address"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Input label="Full name" {...register("fullName")} />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Input label="State" {...register("state")} />
                {errors.state && (
                  <p className="mt-1 text-sm text-red-500">{errors.state.message}</p>
                )}
              </div>
              <div>
                <Input label="City" {...register("city")} />
                {errors.city && (
                  <p className="mt-1 text-sm text-red-500">{errors.city.message}</p>
                )}
              </div>
            </div>
            <div>
              <Input label="Street address" {...register("streetAddress")} />
              {errors.streetAddress && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.streetAddress.message}
                </p>
              )}
            </div>
            <div>
              <Input label="Landmark (optional)" {...register("landmark")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Input label="Zip code" {...register("zipCode")} />
                {errors.zipCode && (
                  <p className="mt-1 text-sm text-red-500">{errors.zipCode.message}</p>
                )}
              </div>
              <div>
                <Input label="Phone" {...register("phone")} />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#484848]">
              <input type="checkbox" {...register("isDefault")} className="rounded" />
              Use as default shipping address
            </label>
            <Button
              type="submit"
              variant="signIn"
              className="w-full rounded-xl"
              disabled={
                createAddressMutation.isPending || updateAddressMutation.isPending
              }
            >
              {editingId ? "Save changes" : "Add address"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
