"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import logoVector from "@/public/image/login-vector.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import completeSignup from "@/lib/services/api/vendors/complete-signup.api";
import { SignupAlreadyCompletedError } from "@/lib/services/api/vendors/vendor-profile.api";
import VendorStoreFormFields, {
  getInitialBusinessHours,
} from "@/components/features/VendorStoreFormFields";
import {
  clearVendorOnboardingDraft,
  defaultVendorStoreFormValues,
  markVendorBusinessStepComplete,
  readVendorOnboardingDraft,
  toCompleteSignupPayload,
  vendorProfileToFormValues,
  vendorStoreFormSchema,
  writeVendorOnboardingDraft,
  type VendorStoreFormValues,
} from "@/lib/schemas/vendor-store-form.schema";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import { queryClient } from "@/lib/services/config/query-client";
import { QueryKeys } from "@/lib/services/config/query-keys";

function buildFreshDefaults(accountEmail?: string): VendorStoreFormValues {
  return {
    businessName: "",
    businessEmail: accountEmail ?? "",
    businessPhone: "",
    description: "",
    physicalStore: "no",
    physicalStoreAddress: "",
    website: "",
    businessHours: getInitialBusinessHours(),
    businessCategories: [],
    storeLogo: "",
    storeCoverPhoto: "",
  };
}

export default function BusinessForm() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const vendorId = user?._id ?? "";
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [isPending, setIsPending] = useState(false);
  const formInitialized = useRef(false);

  const {
    data: vendorProfile,
    isLoading: profileLoading,
  } = useVendorProfile();

  const signupAlreadyCompleted = vendorProfile?.isSignupCompleted === true;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<VendorStoreFormValues>({
    resolver: zodResolver(vendorStoreFormSchema),
    defaultValues: buildFreshDefaults(),
  });

  useEffect(() => {
    formInitialized.current = false;
  }, [vendorId]);

  useEffect(() => {
    if (authLoading || profileLoading || !vendorId || formInitialized.current) {
      return;
    }

    if (signupAlreadyCompleted && vendorProfile) {
      const fromServer = vendorProfileToFormValues(vendorProfile);
      reset({
        ...defaultVendorStoreFormValues,
        ...fromServer,
        businessEmail: fromServer.businessEmail ?? user?.email ?? "",
        businessHours: fromServer.businessHours?.length
          ? fromServer.businessHours
          : getInitialBusinessHours(),
      });
      markVendorBusinessStepComplete(vendorId);
      clearVendorOnboardingDraft(vendorId);
      formInitialized.current = true;
      return;
    }

    const draft = readVendorOnboardingDraft(vendorId);
    if (draft?.businessName?.trim()) {
      reset({
        ...buildFreshDefaults(user?.email),
        ...draft,
        businessEmail: draft.businessEmail ?? user?.email ?? "",
        businessHours: draft.businessHours?.length
          ? draft.businessHours
          : getInitialBusinessHours(),
      });
    } else {
      reset(buildFreshDefaults(user?.email));
    }

    formInitialized.current = true;
  }, [
    authLoading,
    profileLoading,
    vendorId,
    vendorProfile,
    signupAlreadyCompleted,
    reset,
    user?.email,
  ]);

  const values = watch();

  useEffect(() => {
    if (!vendorId || signupAlreadyCompleted || !formInitialized.current) return;
    writeVendorOnboardingDraft(vendorId, values);
  }, [values, vendorId, signupAlreadyCompleted]);

  function goToNextStep() {
    if (vendorId) {
      markVendorBusinessStepComplete(vendorId);
    }
    router.push("/create-business/step2");
  }

  const onSubmit = async (formValues: VendorStoreFormValues) => {
    if (signupAlreadyCompleted) {
      goToNextStep();
      return;
    }

    setIsPending(true);
    try {
      await completeSignup(toCompleteSignupPayload(formValues));
      if (vendorId) {
        markVendorBusinessStepComplete(vendorId);
        clearVendorOnboardingDraft(vendorId);
      }
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.VENDOR_PROFILE, vendorId],
      });

      handleSuccessToast({
        description: "Business details saved successfully!",
      });

      setTimeout(() => {
        router.push("/create-business/step2");
      }, 1000);
    } catch (error: unknown) {
      if (error instanceof SignupAlreadyCompletedError) {
        if (vendorId) {
          markVendorBusinessStepComplete(vendorId);
          clearVendorOnboardingDraft(vendorId);
        }
        await queryClient.invalidateQueries({
          queryKey: [QueryKeys.VENDOR_PROFILE, vendorId],
        });
        handleSuccessToast({
          description: "Business details were already saved. Continuing…",
        });
        setTimeout(() => {
          router.push("/create-business/step2");
        }, 800);
        return;
      }

      handleErrorToast({
        description:
          error instanceof Error
            ? error.message
            : "Failed to save business details. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  };

  if (authLoading || profileLoading || !vendorId) {
    return (
      <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0">
      <div className="mb-8 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-black sm:text-3xl">
          Create Business
        </h2>
        <Image
          src={logoVector}
          width={50}
          height={30}
          alt=""
          className="h-8 w-10 shrink-0"
        />
      </div>

      {signupAlreadyCompleted && (
        <div className="mb-6 rounded-xl border border-traffik-green/30 bg-traffik-green/5 p-4 text-sm text-[#030803]">
          <p className="font-medium">Business details already saved</p>
          <p className="mt-1 text-[#484848]">
            Your store profile is on file. Continue to the next step or update
            details in{" "}
            <Link href="/dashboard/settings" className="text-traffik-pink hover:underline">
              Settings
            </Link>
            .
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 rounded-xl"
            onClick={goToNextStep}
          >
            Continue to approval step
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
        <VendorStoreFormFields
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
        />

        <Button
          type="submit"
          variant="signIn"
          className="w-full"
          size="lg"
          disabled={isPending}
        >
          <span className="text-lg text-black">
            {isPending
              ? "Saving..."
              : signupAlreadyCompleted
                ? "Continue"
                : "Submit"}
          </span>
        </Button>
      </form>
    </div>
  );
}
