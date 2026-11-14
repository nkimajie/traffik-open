import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { isAxiosError } from "axios";
import type { Vendor } from "@/lib/types/api";
import { QueryKeys } from "../../config/query-keys";

export async function fetchVendorProfile(): Promise<Vendor> {
  try {
    const res = await axiosInstance.get(QueryKeys.VENDOR_PROFILE);
    return unwrapAxios<Vendor>(res);
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data?.message || "Failed to load vendor profile",
      );
    }
    throw new Error("Failed to load vendor profile");
  }
}

export class SignupAlreadyCompletedError extends Error {
  code = "SIGNUP_ALREADY_COMPLETED" as const;

  constructor(message = "Vendor signup already completed") {
    super(message);
    this.name = "SignupAlreadyCompletedError";
  }
}
