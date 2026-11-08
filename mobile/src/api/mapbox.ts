import { MAPBOX_TOKEN } from "./config";
import { qs } from "./search";

// Talks directly to Mapbox (not our own backend) for the live, as-you-type
// suggestion step — the embedded token is a Mapbox *public* token, designed
// by Mapbox to be safely shipped inside a client app, unlike a typical API
// key. Keeping this off our own backend avoids a round-trip per keystroke.
// The backend's own geocodeAddress (lib/geocode.ts) still handles the
// one-shot fallback for free text submitted without picking a suggestion.

export interface PlaceSuggestion {
  mapboxId: string;
  name: string;
  placeFormatted?: string;
  fullAddress?: string;
}

interface SuggestResponse {
  suggestions: { mapbox_id: string; name: string; place_formatted?: string; full_address?: string }[];
}

interface RetrieveResponse {
  features: {
    geometry: { coordinates: [number, number] }; // [lng, lat] — GeoJSON order
    properties: { full_address?: string; name?: string };
  }[];
}

// A session token must be one UUIDv4 reused across a whole suggest→retrieve
// sequence (Mapbox batches billing by session) — never reused across
// separate typing sessions, never regenerated per keystroke.
export function newSessionToken(): string {
  // crypto.randomUUID() isn't available in Hermes; this is a standard
  // RFC4122-shaped v4 fallback, good enough for an opaque session key.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function suggestPlaces(
  query: string,
  opts: { sessionToken: string; language?: string }
): Promise<PlaceSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];
  const url = `https://api.mapbox.com/search/searchbox/v1/suggest${qs({
    q: query,
    session_token: opts.sessionToken,
    access_token: MAPBOX_TOKEN,
    language: opts.language,
  })}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as SuggestResponse;
  return (data.suggestions ?? []).map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name,
    placeFormatted: s.place_formatted,
    fullAddress: s.full_address,
  }));
}

export async function retrievePlace(
  mapboxId: string,
  opts: { sessionToken: string; language?: string }
): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}${qs({
    session_token: opts.sessionToken,
    access_token: MAPBOX_TOKEN,
    language: opts.language,
  })}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as RetrieveResponse;
  const feature = data.features[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  const label = feature.properties.full_address ?? feature.properties.name ?? "";
  return { lat, lng, label };
}
