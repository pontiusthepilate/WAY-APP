import { api } from "./client";
import type { Episode, EpisodeComment, EpisodeType } from "../types";

interface EpisodePage {
  episodes: Episode[];
  nextCursor: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function createEpisode(input: {
  profileId: string;
  title: string;
  type: EpisodeType;
  mediaUrl: string;
  coverImageUrl?: string;
}) {
  return api.post<Episode>("/episodes", input);
}

export function getEpisodesFeed(input: { cursor?: string; limit?: number; viewerProfileId?: string } = {}) {
  return api.get<EpisodePage>(`/episodes/feed${qs(input)}`);
}

export function getProfileEpisodes(
  profileId: string,
  input: { cursor?: string; limit?: number; viewerProfileId?: string } = {}
) {
  return api.get<EpisodePage>(`/profiles/${profileId}/episodes${qs(input)}`);
}

export function getEpisode(id: string, viewerProfileId?: string) {
  return api.get<Episode>(`/episodes/${id}${qs({ viewerProfileId })}`);
}

export function registerPlay(id: string) {
  return api.post<{ playsCount: number }>(`/episodes/${id}/play`);
}

export function deleteEpisode(id: string) {
  return api.del(`/episodes/${id}`);
}

export function toggleEpisodeLike(episodeId: string, profileId: string) {
  return api.post<{ liked: boolean; likesCount: number }>(`/episodes/${episodeId}/like`, { profileId });
}

export function getEpisodeComments(episodeId: string, cursor?: string) {
  return api.get<EpisodeComment[]>(`/episodes/${episodeId}/comments${qs({ cursor })}`);
}

export function addEpisodeComment(episodeId: string, input: { profileId: string; text: string }) {
  return api.post<EpisodeComment>(`/episodes/${episodeId}/comments`, input);
}

export function registerEpisodeShare(episodeId: string) {
  return api.post<{ sharesCount: number }>(`/episodes/${episodeId}/share`);
}
