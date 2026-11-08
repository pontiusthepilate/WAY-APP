import { api } from "./client";
import { qs } from "./search";
import type { FollowListEntry } from "../types";

export function follow(profileId: string, followerProfileId: string) {
  return api.post<{ following: boolean }>(`/profiles/${profileId}/follow`, { followerProfileId });
}

export function unfollow(profileId: string, followerProfileId: string) {
  return api.del<{ following: boolean }>(`/profiles/${profileId}/follow`, { followerProfileId });
}

export function getFollowStatus(profileId: string, followerProfileId: string) {
  return api.get<{ following: boolean }>(`/profiles/${profileId}/follow-status?followerProfileId=${encodeURIComponent(followerProfileId)}`);
}

export function getFollowers(profileId: string, limit?: number) {
  return api.get<FollowListEntry[]>(`/profiles/${profileId}/followers${qs({ limit })}`);
}

export function getFollowing(profileId: string, limit?: number) {
  return api.get<FollowListEntry[]>(`/profiles/${profileId}/following${qs({ limit })}`);
}
