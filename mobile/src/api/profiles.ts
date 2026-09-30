import { api } from "./client";
import type { Profile } from "../types";

export function myProfiles() {
  return api.get<Profile[]>("/profiles/me");
}

export function createProfile(input: {
  wayId: string;
  displayName: string;
  categories?: string[];
  kind?: "personal" | "business";
  bio?: string;
}) {
  return api.post<Profile>("/profiles", input);
}

export function updateProfile(id: string, input: Partial<Pick<Profile, "displayName" | "displayPictureUrl" | "bio" | "categories">>) {
  return api.patch<Profile>(`/profiles/${id}`, input);
}

export function updateVisibility(
  id: string,
  input: Partial<
    Pick<
      Profile,
      "isVisible" | "visibleToNearby" | "visibleToAddress" | "visibleToLocation" | "visibilityText" | "visibilityImageUrl"
    >
  >
) {
  return api.patch<Profile>(`/profiles/${id}/visibility`, input);
}

export function updateLocation(
  id: string,
  input: { actualLat: number; actualLng: number; overrideLat?: number; overrideLng?: number }
) {
  return api.patch<Profile>(`/profiles/${id}/location`, input);
}

export function getProfileByWay(wayId: string) {
  return api.get<Profile>(`/profiles/way/${encodeURIComponent(wayId)}`);
}
