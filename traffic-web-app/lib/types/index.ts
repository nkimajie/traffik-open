import type { PaginatedData } from "./api";

export interface ApiResponseType<T> {
  status?: number | boolean;
  message: string;
  data: T;
  statusCode?: number;
  success?: boolean;
}

/** @deprecated Use PaginatedData from api.ts */
export interface PaginatedResponse<T> {
  items: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export type ApiPaginatedResponseType<T> = ApiResponseType<PaginatedData<T>>;

export * from "./api";
