import axiosInstance from "../../config/axios-instance";
import { isAxiosError } from "axios";

function wrapError(error: unknown, fallback: string): never {
  if (isAxiosError(error) && error.response) {
    throw new Error(error.response.data?.message || fallback);
  }
  throw new Error(fallback);
}

export async function verifyOtp(token: string): Promise<void> {
  try {
    await axiosInstance.post("/otp/verify", { token });
  } catch (error) {
    wrapError(error, "Failed to verify email");
  }
}

export async function requestOtp(): Promise<void> {
  try {
    await axiosInstance.post("/otp/resend");
  } catch (error) {
    wrapError(error, "Failed to send verification code");
  }
}

/** @deprecated Use requestOtp */
export async function resendOtp(): Promise<void> {
  return requestOtp();
}
