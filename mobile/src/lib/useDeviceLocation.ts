import { useCallback, useState } from "react";
import * as Location from "expo-location";

export function useDeviceLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get your location");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, error, loading, refresh };
}
