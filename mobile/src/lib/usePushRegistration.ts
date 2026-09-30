import { useEffect } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "../api/push";

// Registers this device's Expo push token against the active profile so
// "notify my followers" (going live) can reach it. Fails silently and
// non-fatally when push isn't available — Expo Go (SDK 53+) no longer
// supports remote push, and simulators/emulators have no real token, so a
// development build on a physical device is needed to actually receive one.
export function usePushRegistration(profileId: string | undefined) {
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) return;

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== "granted" || cancelled) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        if (!cancelled) await registerPushToken(profileId, tokenResponse.data);
      } catch (err) {
        console.warn("[WAY] push registration skipped:", err instanceof Error ? err.message : err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);
}
