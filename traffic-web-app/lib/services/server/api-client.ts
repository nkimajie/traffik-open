import { unwrapData } from "@/lib/services/config/unwrap-response";
import type { ApiEnvelope } from "@/lib/services/config/unwrap-response";

/** Resolved in next.config.mjs, so this is always defined at build time. */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export async function serverApiGet<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(init?.headers ?? {}),
  };
  if (init?.token) {
    (headers as Record<string, string>).Authorization = `Bearer ${init.token}`;
  }

  const apiPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${apiPath}`, {
    ...init,
    headers,
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }

  const json = (await res.json()) as ApiEnvelope<T> | T;
  return unwrapData(json);
}
