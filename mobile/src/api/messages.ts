import { api } from "./client";
import type { Conversation, DirectMessage } from "../types";

interface MessagesPage {
  messages: DirectMessage[];
  nextCursor: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function startConversation(profileId: string, withProfileId: string) {
  return api.post<Conversation>("/conversations", { profileId, withProfileId });
}

export function getConversations(profileId: string) {
  return api.get<Conversation[]>(`/conversations${qs({ profileId })}`);
}

export function getMessages(conversationId: string, input: { profileId: string; cursor?: string; limit?: number }) {
  return api.get<MessagesPage>(`/conversations/${conversationId}/messages${qs(input)}`);
}

export function sendMessage(
  conversationId: string,
  input: { profileId: string; text?: string; mediaUrl?: string; mediaType?: "image" | "video" }
) {
  return api.post<DirectMessage>(`/conversations/${conversationId}/messages`, input);
}
