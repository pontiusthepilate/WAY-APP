import { api } from "./client";
import type { NearbyResult, ParsedSearchIntent, UnifiedSearchResults } from "../types";

export function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function searchNearby(input: {
  profileId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  category?: string;
  describe?: string;
}) {
  return api.get<NearbyResult[]>(`/search/nearby${qs(input)}`);
}

export function searchAddress(input: {
  profileId: string;
  lat?: number;
  lng?: number;
  address?: string;
  radiusMeters: number;
  category?: string;
  describe?: string;
  language?: string;
}) {
  return api.get<NearbyResult[]>(`/search/address${qs(input)}`);
}

export function searchLocation(input: {
  profileId: string;
  lat?: number;
  lng?: number;
  query?: string;
  radiusMeters: number;
  category?: string;
  describe?: string;
  language?: string;
}) {
  return api.get<NearbyResult[]>(`/search/location${qs(input)}`);
}

// Exact lookup by WAY ID (username) or phone number — no distance/bearing.
export function searchByWayId(input: { profileId: string; query: string }) {
  return api.get<NearbyResult[]>(`/search/way-id${qs(input)}`);
}

// Unified multi-entity search — one free-text query matched by name/handle
// across every profile kind at once, with no distance filtering.
export function searchAll(input: { profileId: string; query: string; language?: string }) {
  return api.get<UnifiedSearchResults>(`/search/all${qs(input)}`);
}

// Parses a natural-language query into the same structured fields the
// manual search UI already produces — see search.tsx's handling of it.
export function parseSearchQuery(query: string) {
  return api.post<ParsedSearchIntent>("/search/parse-query", { query });
}
