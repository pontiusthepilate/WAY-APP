import { api } from "./client";
import type { AppNotification } from "../types";

interface NotificationsPage {
  notifications: AppNotification[];
  nextCursor: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function getNotifications(input: { profileId: string; cursor?: string; limit?: number }) {
  return api.get<NotificationsPage>(`/notifications${qs(input)}`);
}

export function getUnreadNotificationCount(profileId: string) {
  return api.get<{ count: number }>(`/notifications/unread-count${qs({ profileId })}`);
}

export function markNotificationRead(id: string, profileId: string) {
  return api.post<AppNotification>(`/notifications/${id}/read`, { profileId });
}

export function markAllNotificationsRead(profileId: string) {
  return api.post<{ ok: boolean }>("/notifications/read-all", { profileId });
}
