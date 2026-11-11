import { api } from "./client";
import type { Profile, ProfileViewResult } from "../types";

export function myProfiles() {
  return api.get<Profile[]>("/profiles/me");
}

export function getProfileByWayId(wayId: string) {
  return api.get<Profile>(`/profiles/way/${encodeURIComponent(wayId)}`);
}

export function createProfile(input: {
  wayId: string;
  displayName: string;
  categories?: string[];
  kind?: "personal" | "business" | "podcast";
  bio?: string;
}) {
  return api.post<Profile>("/profiles", input);
}

export function updateProfile(
  id: string,
  input: Partial<Pick<Profile, "displayName" | "displayPictureUrl" | "bio" | "whichWay" | "categories">>
) {
  return api.patch<Profile>(`/profiles/${id}`, input);
}

// Stateless — generates a Which Way teaser from bio text, doesn't touch
// any saved profile. Category suggestion from the same bio happens
// entirely client-side via lib/categoryMatch.ts's matchCategories.
export function suggestWhichWay(bio: string) {
  return api.post<{ whichWay: string | null }>("/profiles/suggest-which-way", { bio });
}

// The gated full-profile fetch (feature: profile access) — distinct from
// getProfileByWayId above, which stays public/unrestricted for the
// existing mini-profile modal. Returns either the full row or a restricted
// subset depending on the viewer's computed access level.
export function getProfileView(id: string, viewerProfileId: string) {
  return api.get<ProfileViewResult>(`/profiles/${id}?viewerProfileId=${encodeURIComponent(viewerProfileId)}`);
}

export function updateAccessGrants(
  id: string,
  input: Partial<
    Pick<
      Profile,
      | "autoGrantAccessViaNearby"
      | "autoGrantAccessViaAddress"
      | "autoGrantAccessViaLocation"
      | "autoGrantAccessToPersonal"
      | "autoGrantAccessToBusiness"
      | "autoGrantAccessToPodcast"
    >
  >
) {
  return api.patch<Profile>(`/profiles/${id}/access-grants`, input);
}

export function setPrimaryProfile(id: string) {
  return api.patch<Profile>(`/profiles/${id}/primary`, {});
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

export function updateNotificationPrefs(
  id: string,
  input: Partial<
    Pick<
      Profile,
      | "notifyLikes"
      | "notifyComments"
      | "notifyFollows"
      | "notifyMessages"
      | "notifyCalls"
      | "notifyLive"
      | "notifyWayRequests"
      | "notifyCameraRequests"
      | "notifyDigest"
    >
  >
) {
  return api.patch<Profile>(`/profiles/${id}/notification-prefs`, input);
}

export function updatePrivacy(id: string, input: Pick<Profile, "messagePrivacy">) {
  return api.patch<Profile>(`/profiles/${id}/privacy`, input);
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
