import { api } from "./client";
import type { Status } from "../types";

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function createStatus(input: {
  profileId: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  caption?: string;
  backgroundColor?: string;
}) {
  return api.post<Status>("/statuses", input);
}

export function getStatusesByProfile(profileId: string) {
  return api.get<Status[]>(`/statuses/by-profile/${profileId}`);
}

// Batched "which of these profiles currently have an active status" check —
// call this once per list (feed page, search results, connections), not
// per avatar.
export function getActiveStatusIds(profileIds: string[]) {
  if (!profileIds.length) return Promise.resolve([] as string[]);
  return api.get<string[]>(`/statuses/active-ids${qs({ profileIds: profileIds.join(",") })}`);
}

export function deleteStatus(id: string) {
  return api.del(`/statuses/${id}`);
}
