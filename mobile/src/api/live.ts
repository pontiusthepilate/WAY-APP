import { api } from "./client";
import type { LiveChatMessage, LiveSession } from "../types";

export function createLiveSession(input: { profileId: string; title?: string; scheduledFor?: string }) {
  return api.post<LiveSession>("/live/sessions", input);
}

export function startLiveSession(id: string) {
  return api.post<LiveSession>(`/live/sessions/${id}/start`);
}

export function endLiveSession(id: string) {
  return api.post<LiveSession>(`/live/sessions/${id}/end`);
}

export function getActiveLiveSessions() {
  return api.get<LiveSession[]>("/live/sessions/active");
}

export function getScheduledLiveSessions(profileId: string) {
  return api.get<LiveSession[]>(`/live/sessions/scheduled?profileId=${encodeURIComponent(profileId)}`);
}

export function getLiveSession(id: string) {
  return api.get<LiveSession>(`/live/sessions/${id}`);
}

export function joinLiveSession(id: string) {
  return api.post<{ viewerCount: number }>(`/live/sessions/${id}/join`);
}

export function leaveLiveSession(id: string) {
  return api.post<{ viewerCount: number }>(`/live/sessions/${id}/leave`);
}

export function getLiveChat(id: string) {
  return api.get<LiveChatMessage[]>(`/live/sessions/${id}/chat`);
}

export function sendLiveChat(id: string, input: { profileId: string; text: string }) {
  return api.post<LiveChatMessage>(`/live/sessions/${id}/chat`, input);
}
