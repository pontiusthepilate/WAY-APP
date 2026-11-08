// The handle line shown under a profile's name is "WAY/{wayId}" everywhere
// in the app — wayId itself is always lowercase (enforced by the backend's
// normalizeWayId), so that's what's actually stored for every profile,
// default ones included. For LowC specifically, the "WAY/" prefix and the
// forced-lowercase "lowc" are dropped in favor of the properly-cased
// "LowC" his profile was named after — a presentational override, not a
// change to the real wayId used for lookups/routing. Only apply this where
// explicitly asked for; other default profiles (WAY Ltd, WayCast) still
// read as "WAY/wayltd" / "WAY/waycast" unless added here too.
const HANDLE_OVERRIDES: Record<string, string> = {
  lowc: "LowC",
};

export function formatProfileHandle(profile: { wayId: string; isDefault?: boolean }): string {
  if (profile.isDefault && HANDLE_OVERRIDES[profile.wayId]) {
    return HANDLE_OVERRIDES[profile.wayId];
  }
  return `WAY/${profile.wayId}`;
}
