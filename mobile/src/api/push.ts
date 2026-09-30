import { api } from "./client";

export function registerPushToken(profileId: string, token: string) {
  return api.post<{ registered: boolean }>("/push/register", { profileId, token });
}

export function unregisterPushToken(profileId: string, token: string) {
  return api.post<{ registered: boolean }>("/push/unregister", { profileId, token });
}
