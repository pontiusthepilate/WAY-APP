import { api } from "./client";
import type { NearbyResult } from "../types";

function qs(params: Record<string, string | number | undefined>): string {
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
}) {
  return api.get<NearbyResult[]>(`/search/nearby${qs(input)}`);
}

export function searchAddress(input: {
  profileId: string;
  address: string;
  radiusMeters: number;
  category?: string;
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
}) {
  return api.get<NearbyResult[]>(`/search/location${qs(input)}`);
}
