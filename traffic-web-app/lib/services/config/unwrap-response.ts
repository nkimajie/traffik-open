import { AxiosResponse } from "axios";

/** BaseController envelope */
interface SuccessEnvelope<T> {
  message: string;
  data?: T;
  statusCode?: number;
  success?: boolean;
}

/** ResponseInterceptor envelope */
interface StatusEnvelope<T> {
  status: number;
  message: string;
  data?: T;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | StatusEnvelope<T>;

export function unwrapData<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

export function unwrapAxios<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  return unwrapData(response.data);
}
