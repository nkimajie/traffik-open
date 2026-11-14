import { CREATE_BUSINESS_STEPS } from "@/components/create-business/sidebar";
import type { Vendor } from "@/lib/types/api";

export type VendorOnboardingState = Pick<
  Vendor,
  "isSignupCompleted" | "isApproved" | "isVerified"
>;

export function isVendorOnboardingComplete(
  vendor:
    | Partial<VendorOnboardingState>
    | null
    | undefined,
  emailVerified?: boolean,
): boolean {
  const verified = emailVerified ?? vendor?.isVerified;
  return Boolean(
    verified && vendor?.isSignupCompleted && vendor?.isApproved,
  );
}

export function getVendorOnboardingPath(
  vendor:
    | Partial<VendorOnboardingState>
    | null
    | undefined,
  emailVerified?: boolean,
): string {
  const verified = emailVerified ?? vendor?.isVerified;

  if (!verified) {
    return CREATE_BUSINESS_STEPS[0].path;
  }

  if (!vendor?.isSignupCompleted) {
    return CREATE_BUSINESS_STEPS[1].path;
  }

  if (!vendor?.isApproved) {
    return CREATE_BUSINESS_STEPS[2].path;
  }

  return "/dashboard";
}

export function getCompletedOnboardingSteps(
  vendor: Pick<Vendor, "isSignupCompleted" | "isApproved"> | null | undefined,
  emailVerified: boolean,
): string[] {
  const done: string[] = [];

  if (emailVerified) {
    done.push(CREATE_BUSINESS_STEPS[0].path);
  }

  if (vendor?.isSignupCompleted) {
    done.push(CREATE_BUSINESS_STEPS[1].path);
  }

  if (vendor?.isApproved) {
    done.push(CREATE_BUSINESS_STEPS[2].path);
  }

  return done;
}

export type StoreVerificationStatus = "incomplete" | "pending" | "approved";

export function getStoreVerificationStatus(
  vendor: Pick<Vendor, "isSignupCompleted" | "isApproved"> | null | undefined,
): StoreVerificationStatus {
  if (!vendor?.isSignupCompleted) return "incomplete";
  return vendor.isApproved ? "approved" : "pending";
}

export function getOnboardingStepSublabel(
  stepPath: string,
  vendor: Pick<Vendor, "isSignupCompleted" | "isApproved"> | null | undefined,
  emailVerified: boolean,
): string | undefined {
  const step = CREATE_BUSINESS_STEPS.find((item) => item.path === stepPath);
  if (!step) return undefined;

  if (stepPath === CREATE_BUSINESS_STEPS[0].path) {
    return emailVerified
      ? "Email address confirmed"
      : step.sublabel;
  }

  if (stepPath === CREATE_BUSINESS_STEPS[1].path) {
    return vendor?.isSignupCompleted
      ? "Business profile submitted"
      : step.sublabel;
  }

  if (stepPath === CREATE_BUSINESS_STEPS[2].path) {
    if (vendor?.isApproved) {
      return "Your store has been verified — you can start selling";
    }
    if (vendor?.isSignupCompleted) {
      return "Awaiting Traffik agent review";
    }
  }

  return step.sublabel;
}
