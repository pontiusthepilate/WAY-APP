import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";
import { formatDisplayName } from "../lib/displayName";

const TOKEN_KEY = "way.session.token";

let cachedToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Applies formatDisplayName to every "displayName" field anywhere in a
// parsed JSON response — one pass here covers every screen that renders a
// name, instead of a title-casing call at each of the dozens of render
// sites across the app.
export function capitalizeDisplayNames<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => capitalizeDisplayNames(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key === "displayName" && typeof val === "string" ? formatDisplayName(val) : capitalizeDisplayNames(val);
    }
    return out as T;
  }
  return value;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      // Only declare JSON when a body is actually being sent — Fastify's
      // JSON parser rejects a request that has this header but zero bytes
      // of body (e.g. every no-payload POST like /view, /join, /end).
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const rawBody = isJson ? await res.json() : undefined;
  const body = isJson ? capitalizeDisplayNames(rawBody) : rawBody;

  if (!res.ok) {
    throw new ApiError(body?.error ?? res.statusText, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "DELETE", body: data ? JSON.stringify(data) : undefined }),
};
