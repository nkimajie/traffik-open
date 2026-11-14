"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BusinessForm from "@/components/create-business/BusinessForm";
import ApproveAccount from "@/components/create-business/ApproveAccount";
import VerifyEmailForm from "@/components/create-business/VerifyEmailForm";
import { CREATE_BUSINESS_STEPS } from "@/components/create-business/sidebar";
import {
  getVendorOnboardingPath,
  isVendorOnboardingComplete,
} from "@/lib/constants/vendor-onboarding";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import { useAuth } from "@/lib/context/providers/auth-provider";

const BusinessStep = ({ params }: { params: { stepId: string } }) => {
  const router = useRouter();
  const step = params.stepId;
  const { user, isLoading: authLoading } = useAuth();
  const { data: vendorProfile, isLoading: profileLoading } = useVendorProfile();

  const emailVerified = Boolean(
    user?.isVerified || vendorProfile?.isVerified,
  );

  useEffect(() => {
    if (profileLoading || authLoading) return;

    if (
      isVendorOnboardingComplete(vendorProfile ?? user ?? undefined, emailVerified)
    ) {
      router.replace("/dashboard");
      return;
    }

    const targetPath = getVendorOnboardingPath(
      vendorProfile ?? user ?? undefined,
      emailVerified,
    );
    const currentPath = `/create-business/${step}`;

    if (currentPath !== targetPath) {
      router.replace(targetPath);
    }
  }, [
    step,
    router,
    vendorProfile,
    user,
    profileLoading,
    authLoading,
    emailVerified,
  ]);

  if (profileLoading || authLoading) {
    return null;
  }

  if (isVendorOnboardingComplete(vendorProfile ?? user ?? undefined, emailVerified)) {
    return null;
  }

  switch (step) {
    case "step0":
      return <VerifyEmailForm />;
    case "step1":
      return <BusinessForm />;
    case "step2":
      return <ApproveAccount />;
    default:
      return (
        <div className="text-center py-16">
          <p className="text-gray-600">Invalid step.</p>
          <button
            type="button"
            className="mt-4 text-traffik-pink underline"
            onClick={() => router.push(CREATE_BUSINESS_STEPS[0].path)}
          >
            Go to email verification
          </button>
        </div>
      );
  }
};

export default BusinessStep;
