import axiosInstance from "../../config/axios-instance";
import { AxiosResponse, isAxiosError } from "axios";
import { ApiResponseType } from "@/lib/types";
import type { LoginResponseData } from "./login.api";

export interface AdminLoginPayload {
  email: string;
  password: string;
}

type AdminLoginResponse = ApiResponseType<LoginResponseData>;

const adminLogin = async (
  data: AdminLoginPayload,
): Promise<AdminLoginResponse> => {
  try {
    const request: AxiosResponse<AdminLoginResponse> =
      await axiosInstance.post("/auth/admin/login", data);
    return request.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.message || "Failed to login");
    }
    throw new Error("An unexpected error occurred");
  }
};

export default adminLogin;
