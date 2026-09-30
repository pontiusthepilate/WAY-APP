import { api } from "./client";

export function follow(profileId: string, followerProfileId: string) {
  return api.post<{ following: boolean }>(`/profiles/${profileId}/follow`, { followerProfileId });
}

export function unfollow(profileId: string, followerProfileId: string) {
  return api.del<{ following: boolean }>(`/profiles/${profileId}/follow`, { followerProfileId });
}

export function getFollowStatus(profileId: string, followerProfileId: string) {
  return api.get<{ following: boolean }>(`/profiles/${profileId}/follow-status?followerProfileId=${encodeURIComponent(followerProfileId)}`);
}
