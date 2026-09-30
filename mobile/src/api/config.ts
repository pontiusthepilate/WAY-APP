// Point this at your backend. localhost works for iOS Simulator; for a
// physical device or Android emulator, swap in your machine's LAN IP
// (e.g. "http://192.168.1.20:4000") or an EXPO_PUBLIC_API_URL env var.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
