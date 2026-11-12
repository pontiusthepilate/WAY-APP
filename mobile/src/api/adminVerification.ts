import { API_BASE_URL } from "./config";
import { capitalizeDisplayNames } from "./client";
import type { BusinessVerificationRequest, VerificationStatus } from "./businessVerification";
import type { ProfileSummary } from "../types";

// Admin routes use a single shared secret (X-Admin-Secret), not the normal
// signed-in-user JWT — there's no admin role/user system yet, see
// backend/src/lib/adminAuth.ts. Bypasses api/client.ts's shared `api`
// object entirely since that one only ever attaches a Bearer token.
export type AdminVerificationRequest = BusinessVerificationRequest & { profile: ProfileSummary | null };

async function adminRequest<T>(path: string, secret: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      "X-Admin-Secret": secret,
      ...options.headers,
    },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const rawBody = isJson ? await res.json() : undefined;
  const body = isJson ? capitalizeDisplayNames(rawBody) : rawBody;
  if (!res.ok) throw new Error(body?.error ?? res.statusText);
  return body as T;
}

export function listVerificationRequests(
  secret: string,
  filters: { status?: VerificationStatus; isResubmission?: boolean } = {}
) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.isResubmission !== undefined) params.set("isResubmission", String(filters.isResubmission));
  const qs = params.toString();
  return adminRequest<AdminVerificationRequest[]>(`/admin/business-verification${qs ? `?${qs}` : ""}`, secret);
}

export function decideVerificationRequest(
  secret: string,
  id: string,
  input: { decision: "verified" | "rejected"; rejectionReason?: string }
) {
  return adminRequest<AdminVerificationRequest>(`/admin/business-verification/${id}/decide`, secret, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
