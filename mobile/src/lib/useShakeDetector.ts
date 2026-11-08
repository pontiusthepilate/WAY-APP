import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Accelerometer } from "expo-sensors";

const UPDATE_INTERVAL_MS = 100;
// Acceleration-magnitude jump (in g) between consecutive samples that counts
// as a shake — the threshold react-native-shake and similar libraries use.
const SHAKE_THRESHOLD = 1.7;
// Ignore further shakes for a moment after one fires, so a single shaking
// motion (several jolts in a row) only toggles once.
const COOLDOWN_MS = 1000;

// Calls `onShake` when the device is shaken. Self-contained — mounts its own
// Accelerometer subscription and tears it down on unmount, so a component
// can just call this and not think about sensor lifecycle.
export function useShakeDetector(onShake: () => void) {
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    // No device to shake on a desktop/laptop browser, and expo-sensors'
    // web shim needs a DeviceMotion permission flow this app doesn't ask
    // for — shake-to-reveal just doesn't apply on web.
    if (Platform.OS === "web") return;

    let lastMagnitude = 0;
    let lastShakeAt = 0;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const delta = Math.abs(magnitude - lastMagnitude);
      lastMagnitude = magnitude;

      const now = Date.now();
      if (delta > SHAKE_THRESHOLD && now - lastShakeAt > COOLDOWN_MS) {
        lastShakeAt = now;
        onShakeRef.current();
      }
    });

    return () => subscription.remove();
  }, []);
}
