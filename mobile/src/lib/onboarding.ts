import AsyncStorage from "@react-native-async-storage/async-storage";

// Same persistence pattern as the auth token in api/client.ts — a single
// AsyncStorage flag, cached in memory after the first read so repeated
// checks (e.g. on every cold start) don't hit storage each time.
const SEEN_KEY = "way.onboarding.seen";
let cachedSeen: boolean | null = null;

export async function getHasSeenOnboarding(): Promise<boolean> {
  if (cachedSeen !== null) return cachedSeen;
  cachedSeen = (await AsyncStorage.getItem(SEEN_KEY)) === "true";
  return cachedSeen;
}

export async function markOnboardingSeen(): Promise<void> {
  cachedSeen = true;
  await AsyncStorage.setItem(SEEN_KEY, "true");
}
