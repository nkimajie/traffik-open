import { z } from "zod";
import type { BusinessHourSlot } from "@/lib/utils/business-hours";
import { normalizeBusinessHours } from "@/lib/utils/business-hours";

export const businessHourSlotSchema = z.object({
  day: z.string().min(1),
  open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM"),
  close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM"),
});

export const vendorStoreFormSchema = z
  .object({
    businessName: z.string().min(1, "Business name is required"),
    physicalStore: z.enum(["yes", "no"]),
    physicalStoreAddress: z.string().optional(),
    businessEmail: z.string().email("Invalid business email"),
    businessPhone: z
      .string()
      .min(1, "Business phone is required")
      .regex(/^\+?[1-9]\d{1,14}$/, "Use a valid phone number (e.g. +2348012345678)"),
    website: z.string().url("Invalid website URL").optional().or(z.literal("")),
    description: z.string().min(1, "Business description is required"),
    businessHours: z
      .array(businessHourSlotSchema)
      .min(1, "Add hours for at least one open day"),
    businessCategories: z
      .array(z.string())
      .min(1, "Select at least one category")
      .max(5, "Select at most five categories"),
    storeLogo: z.string().url("Invalid logo URL").optional().or(z.literal("")),
    storeCoverPhoto: z
      .string()
      .url("Invalid cover photo URL")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      data.physicalStore !== "yes" ||
      (data.physicalStoreAddress?.trim()?.length ?? 0) > 0,
    {
      message: "Business address is required if you have a physical store",
      path: ["physicalStoreAddress"],
    },
  );

export type VendorStoreFormValues = z.infer<typeof vendorStoreFormSchema>;

export const defaultVendorStoreFormValues: Partial<VendorStoreFormValues> = {
  physicalStore: "no",
  physicalStoreAddress: "",
  website: "",
  storeLogo: "",
  storeCoverPhoto: "",
  businessCategories: [],
  businessHours: [],
};

/** Pre-vendor-scoping keys — removed on read/login/logout. */
const LEGACY_ONBOARDING_DRAFT_KEY = "vendor-onboarding-draft";
const LEGACY_ONBOARDING_BUSINESS_DONE_KEY = "vendor-onboarding-business-done";

const ONBOARDING_DRAFT_PREFIX = "vendor-onboarding-draft:";
const ONBOARDING_BUSINESS_DONE_PREFIX = "vendor-onboarding-business-done:";

function draftKey(vendorId: string) {
  return `${ONBOARDING_DRAFT_PREFIX}${vendorId}`;
}

function businessDoneKey(vendorId: string) {
  return `${ONBOARDING_BUSINESS_DONE_PREFIX}${vendorId}`;
}

/** Removes unscoped keys that leaked data across vendor accounts. */
export function clearLegacyVendorOnboardingStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_ONBOARDING_DRAFT_KEY);
  localStorage.removeItem(LEGACY_ONBOARDING_BUSINESS_DONE_KEY);
}

export function toCompleteSignupPayload(values: VendorStoreFormValues) {
  return {
    businessName: values.businessName,
    physicalStore: values.physicalStore === "yes",
    physicalStoreAddress: values.physicalStoreAddress || "",
    businessEmail: values.businessEmail,
    businessPhone: values.businessPhone,
    website: values.website || "",
    description: values.description,
    businessHours: values.businessHours as BusinessHourSlot[],
    businessCategories: values.businessCategories,
    storeLogo: values.storeLogo || "",
    storeCoverPhoto: values.storeCoverPhoto || "",
  };
}

export function readVendorOnboardingDraft(
  vendorId: string,
): Partial<VendorStoreFormValues> | null {
  if (typeof window === "undefined" || !vendorId) return null;
  clearLegacyVendorOnboardingStorage();
  try {
    const raw = localStorage.getItem(draftKey(vendorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VendorStoreFormValues>;
    const hours = normalizeBusinessHours(parsed.businessHours);
    return {
      ...parsed,
      businessHours: hours ?? undefined,
    };
  } catch {
    return null;
  }
}

export function writeVendorOnboardingDraft(
  vendorId: string,
  values: VendorStoreFormValues,
) {
  if (typeof window === "undefined" || !vendorId) return;
  localStorage.setItem(draftKey(vendorId), JSON.stringify(values));
}

export function clearVendorOnboardingDraft(vendorId: string) {
  if (typeof window === "undefined" || !vendorId) return;
  localStorage.removeItem(draftKey(vendorId));
}

export function markVendorBusinessStepComplete(vendorId: string) {
  if (typeof window === "undefined" || !vendorId) return;
  localStorage.setItem(businessDoneKey(vendorId), "true");
}

export function isVendorBusinessStepComplete(vendorId: string): boolean {
  if (typeof window === "undefined" || !vendorId) return false;
  clearLegacyVendorOnboardingStorage();
  return localStorage.getItem(businessDoneKey(vendorId)) === "true";
}

/** Map a vendor profile from the API into form default values. */
export function vendorProfileToFormValues(
  vendor: {
    businessName?: string;
    businessEmail?: string;
    businessPhone?: string;
    description?: string;
    physicalStore?: boolean;
    physicalStoreAddress?: string;
    website?: string;
    businessHours?: BusinessHourSlot[];
    businessCategories?: Array<string | { _id: string }>;
    storeLogo?: string | null;
    storeCoverPhoto?: string | null;
    email?: string;
  },
): Partial<VendorStoreFormValues> {
  const categoryIds = (vendor.businessCategories ?? []).map((entry) =>
    typeof entry === "string" ? entry : entry._id,
  );

  return {
    businessName: vendor.businessName ?? "",
    businessEmail: vendor.businessEmail ?? vendor.email ?? "",
    businessPhone: vendor.businessPhone ?? "",
    description: vendor.description ?? "",
    physicalStore: vendor.physicalStore ? "yes" : "no",
    physicalStoreAddress: vendor.physicalStoreAddress ?? "",
    website: vendor.website ?? "",
    businessHours: normalizeBusinessHours(vendor.businessHours) ?? [],
    businessCategories: categoryIds,
    storeLogo: vendor.storeLogo ?? "",
    storeCoverPhoto: vendor.storeCoverPhoto ?? "",
  };
}

/** True when the vendor has finished the business-details onboarding step. */
export function vendorHasCompletedBusinessSignup(
  vendor: { isSignupCompleted?: boolean } | null | undefined,
): boolean {
  return vendor?.isSignupCompleted === true;
}
