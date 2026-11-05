import { api } from "./client";
import type { Profile } from "../types";

export function getProfileLinks(profileId: string) {
  return api.get<Profile[]>(`/profiles/${profileId}/links`);
}

export function setProfileLinks(profileId: string, linkedProfileIds: string[]) {
  return api.put<Profile[]>(`/profiles/${profileId}/links`, { linkedProfileIds });
}
