import { api } from "./client";
import type { ProfileAccessRequest } from "../types";

export function sendProfileAccessRequest(input: { fromProfileId: string; toWayId: string; message?: string }) {
  return api.post<ProfileAccessRequest>("/profile-access-requests", input);
}

export function getProfileAccessRequest(id: string) {
  return api.get<ProfileAccessRequest>(`/profile-access-requests/${id}`);
}

export function getIncomingProfileAccessRequests(profileId: string) {
  return api.get<ProfileAccessRequest[]>(`/profile-access-requests/incoming/${profileId}`);
}

export function getOutgoingProfileAccessRequests(profileId: string) {
  return api.get<ProfileAccessRequest[]>(`/profile-access-requests/outgoing/${profileId}`);
}

export function acceptProfileAccessRequest(id: string, profileId: string) {
  return api.post<ProfileAccessRequest>(`/profile-access-requests/${id}/accept`, { profileId });
}

// `block` optionally also blocks the requester from sending another
// ProfileAccessRequest — see backend/src/lib/blocking.ts's isAccessRequestBlocked.
export function declineProfileAccessRequest(id: string, profileId: string, block?: boolean) {
  return api.post<ProfileAccessRequest>(`/profile-access-requests/${id}/decline`, { profileId, block });
}
