"use client";
import { Sidebar, CREATE_BUSINESS_STEPS } from "@/components/create-business/sidebar";
import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { cn } from "@/lib/utils";
import {
  getCompletedOnboardingSteps,
  getOnboardingStepSublabel,
  isVendorOnboardingComplete,
} from "@/lib/constants/vendor-onboarding";

interface CreateBusinessLayoutProps {
  children: ReactNode;
}

const CreateBusinessLayout: React.FC<CreateBusinessLayoutProps> = ({
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token } = useAuth();
  const { data: vendorProfile, isLoading: profileLoading } = useVendorProfile();
  const emailVerified = Boolean(user?.isVerified || vendorProfile?.isVerified);

  const onboardingComplete = isVendorOnboardingComplete(
    vendorProfile ?? user ?? undefined,
    emailVerified,
  );

  useEffect(() => {
    if (profileLoading || !vendorProfile) return;
    if (!onboardingComplete) return;

    router.replace("/dashboard");
  }, [profileLoading, vendorProfile, onboardingComplete, router]);

  useEffect(() => {
    if (!token || !user || user.role !== "vendor" || !vendorProfile) return;

    const syncedUser = {
      ...user,
      isVerified: emailVerified,
      isSignupCompleted: vendorProfile.isSignupCompleted,
      isApproved: vendorProfile.isApproved,
    };

    localStorage.setItem("user", JSON.stringify(syncedUser));
    document.cookie = `isVerified=${emailVerified ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `onboardingComplete=${onboardingComplete ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `vendorSignupComplete=${vendorProfile.isSignupCompleted ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `vendorApproved=${vendorProfile.isApproved ? "1" : "0"}; path=/; max-age=86400; SameSite=Strict`;
  }, [token, user, vendorProfile, emailVerified, onboardingComplete]);

  const completedSteps = useMemo(
    () => getCompletedOnboardingSteps(vendorProfile, emailVerified),
    [vendorProfile, emailVerified],
  );

  const stepSublabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const step of CREATE_BUSINESS_STEPS) {
      const sublabel = getOnboardingStepSublabel(
        step.path,
        vendorProfile,
        emailVerified,
      );
      if (sublabel) {
        labels[step.path] = sublabel;
      }
    }
    return labels;
  }, [vendorProfile, emailVerified]);

  if (profileLoading || onboardingComplete) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden md:flex-row md:h-screen md:overflow-hidden">
      <Sidebar
        currentPath={pathname}
        completedSteps={completedSteps}
        stepSublabels={stepSublabels}
      />
      <div className="min-w-0 flex-1 overflow-y-auto md:h-screen">
        <div
          className={cn(
            "mx-auto w-full",
            pathname === "/create-business/step0"
              ? "max-w-4xl px-4 sm:px-6"
              : "max-w-3xl p-4 sm:p-6 lg:p-8",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CreateBusinessLayout;
