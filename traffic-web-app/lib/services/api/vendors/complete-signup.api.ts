import axiosInstance from "../../config/axios-instance";
import { AxiosResponse, isAxiosError } from "axios";
import { ApiResponseType } from "@/lib/types";
import type { BusinessHourSlot } from "@/lib/utils/business-hours";
import { SignupAlreadyCompletedError } from "./vendor-profile.api";

export interface CompleteSignupPayload {
  businessName: string;
  physicalStore: boolean;
  physicalStoreAddress: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  description: string;
  businessHours: BusinessHourSlot[];
  businessCategories: string[];
  storeLogo: string;
  storeCoverPhoto: string;
}

export interface CompleteSignupResponseData {
  _id: string;
  businessName: string;
  physicalStore: boolean;
  physicalStoreAddress: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  description: string;
  businessHours: BusinessHourSlot[];
  businessCategories: string[];
  businessCategory?: string;
  storeLogo: string;
  storeCoverPhoto: string;
  vendorId: string;
  createdAt: string;
  updatedAt: string;
  isSignupCompleted?: boolean;
}

type CompleteSignupResponse = ApiResponseType<CompleteSignupResponseData>;

const completeSignup = async (
  data: CompleteSignupPayload,
): Promise<CompleteSignupResponse> => {
  try {
    const request: AxiosResponse<CompleteSignupResponse> =
      await axiosInstance.patch("/vendors/complete-signup", data);
    return request.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const code = error.response.data?.code as string | undefined;
      const message =
        error.response.data?.message || "Failed to complete signup";
      if (code === "SIGNUP_ALREADY_COMPLETED") {
        throw new SignupAlreadyCompletedError(message);
      }
      throw new Error(message);
    }
    throw new Error("An unexpected error occurred");
  }
};

export default completeSignup;
