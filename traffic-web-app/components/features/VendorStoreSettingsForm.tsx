"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import completeSignup from "@/lib/services/api/vendors/complete-signup.api";
import VendorStoreFormFields, {
  getInitialBusinessHours,
} from "@/components/features/VendorStoreFormFields";
import {
  defaultVendorStoreFormValues,
  toCompleteSignupPayload,
  vendorProfileToFormValues,
  vendorStoreFormSchema,
  type VendorStoreFormValues,
} from "@/lib/schemas/vendor-store-form.schema";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import { queryClient } from "@/lib/services/config/query-client";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { useAuth } from "@/lib/context/providers/auth-provider";

export default function VendorStoreSettingsForm() {
  const { user } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [isPending, setIsPending] = useState(false);
  const formInitialized = useRef(false);

  const { data: vendorProfile, isLoading: profileLoading } = useVendorProfile();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<VendorStoreFormValues>({
    resolver: zodResolver(vendorStoreFormSchema),
    defaultValues: {
      ...defaultVendorStoreFormValues,
      businessEmail: user?.email ?? "",
      businessHours: getInitialBusinessHours(),
    },
  });

  useEffect(() => {
    formInitialized.current = false;
  }, [user?._id]);

  useEffect(() => {
    if (profileLoading || !vendorProfile || formInitialized.current) return;

    const fromServer = vendorProfileToFormValues(vendorProfile);
    reset({
      ...defaultVendorStoreFormValues,
      ...fromServer,
      businessEmail: fromServer.businessEmail ?? user?.email ?? "",
      businessHours: fromServer.businessHours?.length
        ? fromServer.businessHours
        : getInitialBusinessHours(),
    });
    formInitialized.current = true;
  }, [profileLoading, vendorProfile, reset, user?.email]);

  const onSubmit = async (formValues: VendorStoreFormValues) => {
    setIsPending(true);
    try {
      await completeSignup(toCompleteSignupPayload(formValues));
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.VENDOR_PROFILE, user?._id],
      });
      handleSuccessToast({ description: "Store profile saved successfully." });
    } catch (error) {
      handleErrorToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to save store profile. If onboarding is already complete, contact support to update your store.",
      });
    } finally {
      setIsPending(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <VendorStoreFormFields
        register={register}
        errors={errors}
        watch={watch}
        setValue={setValue}
        inputClassName="py-3"
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save store profile"}
      </Button>
    </form>
  );
}
