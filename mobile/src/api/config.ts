// Point this at your backend. localhost works for iOS Simulator; for a
// physical device or Android emulator, swap in your machine's LAN IP
// (e.g. "http://192.168.1.20:4000") or an EXPO_PUBLIC_API_URL env var.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

// Your LiveKit Cloud project's WebSocket URL (e.g. "wss://your-project.livekit.cloud").
// Blank until the project exists — the call screen shows a clear "not set up
// yet" state instead of attempting to connect when this is empty.
export const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

// Mapbox's *public* token — deliberately safe to ship inside the client
// bundle (unlike the backend's own API-style secrets), used for the live
// place-suggestion autocomplete calls in search.ts. The backend has its own
// MAPBOX_ACCESS_TOKEN for one-shot geocoding fallback.
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
