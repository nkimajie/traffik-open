"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import FileUpload from "@/components/ui/file-upload";
import BusinessHoursPicker, {
  weekScheduleToBusinessHours,
} from "@/components/create-business/BusinessHoursPicker";
import { fetchCategories } from "@/lib/services/api/catalog/catalog.api";
import type { VendorStoreFormValues } from "@/lib/schemas/vendor-store-form.schema";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type VendorStoreFormFieldsProps = {
  register: UseFormRegister<VendorStoreFormValues>;
  errors: FieldErrors<VendorStoreFormValues>;
  watch: UseFormWatch<VendorStoreFormValues>;
  setValue: UseFormSetValue<VendorStoreFormValues>;
  inputClassName?: string;
};

export default function VendorStoreFormFields({
  register,
  errors,
  watch,
  setValue,
  inputClassName = "",
}: VendorStoreFormFieldsProps) {
  const physicalStore = watch("physicalStore");
  const businessCategories = watch("businessCategories") ?? [];
  const businessHours = watch("businessHours") ?? [];

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const categoryOptions =
    categories?.map((category) => ({
      value: category._id,
      label: category.name,
    })) ?? [];

  const fieldClass = cn("border-black py-6 text-black", inputClassName);

  return (
    <>
      <div className="mb-2 min-w-0">
        <Input
          label="Business Name"
          placeholder="Enter business name"
          className={cn(fieldClass, errors.businessName && "border-red-500")}
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-red-500 text-sm mt-1">
            {errors.businessName.message}
          </p>
        )}
      </div>

      <div className="mb-2">
        <Input
          label="Business Email"
          type="email"
          placeholder="Enter business email"
          className={cn(fieldClass, errors.businessEmail && "border-red-500")}
          {...register("businessEmail")}
        />
        {errors.businessEmail && (
          <p className="text-red-500 text-sm mt-1">
            {errors.businessEmail.message}
          </p>
        )}
      </div>

      <div className="mb-2">
        <Input
          label="Business Phone"
          type="tel"
          placeholder="Enter business phone (e.g., +2348012345678)"
          className={cn(fieldClass, errors.businessPhone && "border-red-500")}
          {...register("businessPhone")}
        />
        {errors.businessPhone && (
          <p className="text-red-500 text-sm mt-1">
            {errors.businessPhone.message}
          </p>
        )}
      </div>

      <div className="mb-2">
        <Input
          label="Business Description"
          placeholder="Describe your business"
          className={cn(fieldClass, errors.description && "border-red-500")}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="mb-2">
        <label htmlFor="businessCategories" className="mb-2 block text-sm text-black">
          Business categories
        </label>
        {categoriesLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : categoriesError ? (
          <ErrorState
            title="Could not load categories"
            message="Categories are required to complete your store profile."
            onRetry={() => refetchCategories()}
          />
        ) : (
          <>
            <MultiSelect
              id="businessCategories"
              options={categoryOptions}
              value={businessCategories}
              onChange={(next) => setValue("businessCategories", next)}
              placeholder="Select categories you sell in"
              maxSelected={5}
              aria-invalid={!!errors.businessCategories}
            />
            {errors.businessCategories && (
              <p className="text-red-500 text-sm mt-1">
                {errors.businessCategories.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mb-4">
        <BusinessHoursPicker
          value={businessHours}
          onChange={(next) => setValue("businessHours", next)}
        />
        {errors.businessHours && (
          <p className="text-red-500 text-sm mt-1">
            {typeof errors.businessHours.message === "string"
              ? errors.businessHours.message
              : "Add hours for at least one open day"}
          </p>
        )}
      </div>

      <fieldset className="my-6">
        <legend className="text-black text-sm mb-3">
          Do you have a physical store?
        </legend>
        <div className="flex gap-5 items-center">
          <label className="flex gap-3 items-center text-black text-sm">
            <input
              type="radio"
              value="yes"
              className="h-4 w-4 border-black"
              {...register("physicalStore")}
            />
            Yes
          </label>
          <label className="flex gap-3 items-center text-black text-sm">
            <input
              type="radio"
              value="no"
              className="h-4 w-4 border-black"
              {...register("physicalStore")}
            />
            No
          </label>
        </div>
      </fieldset>

      {physicalStore === "yes" && (
        <div className="mb-2">
          <Input
            label="Physical Store Address"
            placeholder="Enter store address"
            className={cn(
              fieldClass,
              errors.physicalStoreAddress && "border-red-500",
            )}
            {...register("physicalStoreAddress")}
          />
          {errors.physicalStoreAddress && (
            <p className="text-red-500 text-sm mt-1">
              {errors.physicalStoreAddress.message}
            </p>
          )}
        </div>
      )}

      <div className="mb-2">
        <Input
          label="Website (Optional)"
          type="url"
          placeholder="https://yourwebsite.com"
          className={cn(fieldClass, errors.website && "border-red-500")}
          {...register("website")}
        />
        {errors.website && (
          <p className="text-red-500 text-sm mt-1">{errors.website.message}</p>
        )}
      </div>

      <div className="mb-2">
        <FileUpload
          label="Store Logo (Optional)"
          value={watch("storeLogo")}
          onChange={(url) => setValue("storeLogo", url)}
          maxSizeMB={2}
        />
        {errors.storeLogo && (
          <p className="text-red-500 text-sm mt-1">{errors.storeLogo.message}</p>
        )}
      </div>

      <div className="mb-6">
        <FileUpload
          label="Store Cover Photo (Optional)"
          value={watch("storeCoverPhoto")}
          onChange={(url) => setValue("storeCoverPhoto", url)}
          maxSizeMB={5}
        />
        {errors.storeCoverPhoto && (
          <p className="text-red-500 text-sm mt-1">
            {errors.storeCoverPhoto.message}
          </p>
        )}
      </div>
    </>
  );
}

/** Seed default Mon–Sat hours when the form mounts with an empty schedule. */
export function getInitialBusinessHours(): VendorStoreFormValues["businessHours"] {
  return weekScheduleToBusinessHours({
    monday: { open: true, openTime: "09:00", closeTime: "18:00" },
    tuesday: { open: true, openTime: "09:00", closeTime: "18:00" },
    wednesday: { open: true, openTime: "09:00", closeTime: "18:00" },
    thursday: { open: true, openTime: "09:00", closeTime: "18:00" },
    friday: { open: true, openTime: "09:00", closeTime: "18:00" },
    saturday: { open: true, openTime: "09:00", closeTime: "18:00" },
    sunday: { open: false, openTime: "09:00", closeTime: "18:00" },
  });
}
