import { api } from "./client";
import type { SearchMode, WayRequest } from "../types";

export function sendWayRequest(input: {
  fromProfileId: string;
  toWayId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  discoveredVia?: SearchMode;
}) {
  return api.post<WayRequest>("/way-requests", input);
}

export function getWayRequest(id: string) {
  return api.get<WayRequest>(`/way-requests/${id}`);
}

export function getIncomingWayRequests(profileId: string) {
  return api.get<WayRequest[]>(`/way-requests/incoming/${profileId}`);
}

export function getOutgoingWayRequests(profileId: string) {
  return api.get<WayRequest[]>(`/way-requests/outgoing/${profileId}`);
}

export function acceptWayRequest(id: string, profileId: string) {
  return api.post<WayRequest>(`/way-requests/${id}/accept`, { profileId });
}

export function declineWayRequest(id: string, profileId: string) {
  return api.post<WayRequest>(`/way-requests/${id}/decline`, { profileId });
}
