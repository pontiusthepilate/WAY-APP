// Resolves a free-text street address into coordinates for ADDRESS search.
// Requires GOOGLE_MAPS_API_KEY (Geocoding API) to be set; the mobile app's
// LOCATION search instead uses the Google Map picker directly and sends
// lat/lng straight through, so it doesn't need this.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured on the server");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    status: string;
    results: { geometry: { location: { lat: number; lng: number } } }[];
  };

  if (data.status !== "OK" || !data.results[0]) {
    throw new Error(`Could not resolve address (${data.status})`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}
