// Thrown for operational problems (missing access token, upstream outage)
// that are never safe to show verbatim to an end user — callers should log
// the real message server-side and reply with something generic instead.
export class GeocodeConfigError extends Error {}

interface MapboxFeatureCollection {
  features: {
    geometry: { coordinates: [number, number] }; // [lng, lat] — GeoJSON order, not {lat,lng}
    properties: { full_address?: string; name?: string };
  }[];
}

// Resolves a free-text address or place name into coordinates — used for
// both ADDRESS search (a street address) and LOCATION search (a city,
// state, county, country, or landmark name), and for the free-text
// "does this also look like a place?" side-channel in unified search.
// Requires MAPBOX_ACCESS_TOKEN to be set. `language` is an optional BCP-47
// language subtag (e.g. "fr", "ja") so results come back in the searcher's
// own language rather than always English — Mapbox's Geocoding API already
// covers addresses worldwide in any script, this just asks it to localize
// the response text.
export async function geocodeAddress(
  address: string,
  language?: string
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    throw new GeocodeConfigError("MAPBOX_ACCESS_TOKEN is not configured on the server");
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", address);
  url.searchParams.set("access_token", accessToken);
  // This is a one-shot "resolve this exact string" lookup, not a type-ahead
  // suggestion — autocomplete=false and limit=1 ask Mapbox for its single
  // best match rather than a list of partial-match guesses.
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("limit", "1");
  if (language) url.searchParams.set("language", language);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new GeocodeConfigError(`Geocoding request failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as MapboxFeatureCollection;

  const feature = data.features[0];
  if (!feature) {
    throw new Error("We couldn't find that address. Try adding a city or country.");
  }

  const [lng, lat] = feature.geometry.coordinates;
  const formattedAddress = feature.properties.full_address ?? feature.properties.name ?? address;
  return { lat, lng, formattedAddress };
}
