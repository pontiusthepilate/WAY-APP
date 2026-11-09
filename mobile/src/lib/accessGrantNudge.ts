import AsyncStorage from "@react-native-async-storage/async-storage";

// Same one-time-flag pattern as shakeTip.ts — tracks whether the "set up
// who gets full profile access" nudge (shown once, the first time
// visibility is switched on) has already been shown, so it only appears
// once per install.
const SEEN_KEY = "way.accessGrantNudge.seen";
let cachedSeen: boolean | null = null;

export async function getHasSeenAccessGrantNudge(): Promise<boolean> {
  if (cachedSeen !== null) return cachedSeen;
  cachedSeen = (await AsyncStorage.getItem(SEEN_KEY)) === "true";
  return cachedSeen;
}

export async function markAccessGrantNudgeSeen(): Promise<void> {
  cachedSeen = true;
  await AsyncStorage.setItem(SEEN_KEY, "true");
}
