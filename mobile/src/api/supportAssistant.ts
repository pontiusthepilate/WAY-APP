import { api } from "./client";
import type { SupportMessage } from "../types";

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function getSupportMessages(profileId: string) {
  return api.get<SupportMessage[]>(`/support/messages${qs({ profileId })}`);
}

export function sendSupportMessage(profileId: string, text: string) {
  return api.post<{ reply: string }>("/support/message", { profileId, text });
}
