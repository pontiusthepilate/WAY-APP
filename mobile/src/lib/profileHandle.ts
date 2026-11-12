// The handle line shown under a profile's name is just the wayId itself
// everywhere in the app — wayId is always lowercase (enforced by the
// backend's normalizeWayId), so that's what's actually stored for every
// profile, default ones included. For LowC specifically, the forced-
// lowercase "lowc" is dropped in favor of the properly-cased "LowC" his
// profile was named after — a presentational override, not a change to
// the real wayId used for lookups/routing. Only apply this where
// explicitly asked for; other default profiles (WAY Ltd, WayCast) still
// read as "wayltd" / "waycast" unless added here too.
const HANDLE_OVERRIDES: Record<string, string> = {
  lowc: "LowC",
};

export function formatProfileHandle(profile: { wayId: string; isDefault?: boolean }): string {
  if (profile.isDefault && HANDLE_OVERRIDES[profile.wayId]) {
    return HANDLE_OVERRIDES[profile.wayId];
  }
  return profile.wayId;
}
