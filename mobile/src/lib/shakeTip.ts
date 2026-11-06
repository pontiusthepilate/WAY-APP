import AsyncStorage from "@react-native-async-storage/async-storage";

// Same one-time-flag pattern as onboarding.ts — tracks whether the shake-
// to-reveal-auto-scroll-controls tip toast has already been shown, so it
// only appears once per install.
const SEEN_KEY = "way.shakeTip.seen";
let cachedSeen: boolean | null = null;

export async function getHasSeenShakeTip(): Promise<boolean> {
  if (cachedSeen !== null) return cachedSeen;
  cachedSeen = (await AsyncStorage.getItem(SEEN_KEY)) === "true";
  return cachedSeen;
}

export async function markShakeTipSeen(): Promise<void> {
  cachedSeen = true;
  await AsyncStorage.setItem(SEEN_KEY, "true");
}
