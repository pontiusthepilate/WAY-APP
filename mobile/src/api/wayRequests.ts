import { api } from "./client";
import type { ConnectRecommendation, DiscoveredVia, WayRequest } from "../types";

export function sendWayRequest(input: {
  fromProfileId: string;
  toWayId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  discoveredVia?: DiscoveredVia;
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

export function getConnectRecommendations(profileId: string) {
  return api.get<ConnectRecommendation[]>(`/way-requests/recommendations/${profileId}`);
}

export function acceptWayRequest(id: string, profileId: string, sharePhoneNumber?: boolean) {
  return api.post<WayRequest>(`/way-requests/${id}/accept`, { profileId, sharePhoneNumber });
}

export function declineWayRequest(id: string, profileId: string) {
  return api.post<WayRequest>(`/way-requests/${id}/decline`, { profileId });
}
