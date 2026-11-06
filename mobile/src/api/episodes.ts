import { api } from "./client";
import type { Episode, EpisodeType } from "../types";

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

export function getEpisodesFeed(input: { cursor?: string; limit?: number } = {}) {
  return api.get<EpisodePage>(`/episodes/feed${qs(input)}`);
}

export function getProfileEpisodes(profileId: string, input: { cursor?: string; limit?: number } = {}) {
  return api.get<EpisodePage>(`/profiles/${profileId}/episodes${qs(input)}`);
}

export function getEpisode(id: string) {
  return api.get<Episode>(`/episodes/${id}`);
}

export function registerPlay(id: string) {
  return api.post<{ playsCount: number }>(`/episodes/${id}/play`);
}

export function deleteEpisode(id: string) {
  return api.del(`/episodes/${id}`);
}
