import { api } from "./client";
import type { Call } from "../types";

interface CallWithToken {
  call: Call;
  token: string | null;
  liveKitConfigured: boolean;
}

export function startCall(input: { profileId: string; conversationId: string; type: "voice" | "video" }) {
  return api.post<CallWithToken>("/calls", input);
}

export function getCall(id: string, profileId: string) {
  return api.get<Call>(`/calls/${id}?profileId=${encodeURIComponent(profileId)}`);
}

export function acceptCall(id: string, profileId: string) {
  return api.post<CallWithToken>(`/calls/${id}/accept`, { profileId });
}

export function declineCall(id: string, profileId: string) {
  return api.post<Call>(`/calls/${id}/decline`, { profileId });
}

export function endCall(id: string, profileId: string) {
  return api.post<Call>(`/calls/${id}/end`, { profileId });
}
