import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { reverseGeocode } from "../api/mapbox";

// A full-screen "drop a pin" picker — unlike CountryPickerSheet's 75% slide-
// up sheet, a map needs the whole screen to be usable. The pin itself never
// moves: it's a fixed glyph over the map's exact center, and the user drags
// the MAP underneath it (the same pattern most map pickers use), so there's
// no marker-drag gesture to wire up separately from the map's own pan.
const PIN_SIZE = 40;
// A neutral mid-ocean default center/zoom for when the caller has no device
// location yet — shows the whole world rather than snapping anywhere
// specific, since this app's whole premise is "works anywhere on earth."
const WORLD_CENTER: [number, number] = [0, 20];
const WORLD_ZOOM = 0.8;
const LOCAL_ZOOM = 14;

interface Props {
  open: boolean;
  initialCenter: { lat: number; lng: number } | null;
  language?: string;
  onClose: () => void;
  onConfirm: (point: { lat: number; lng: number; label: string }) => void;
}

export function MapPickerModal({ open, initialCenter, language, onClose, onConfirm }: Props) {
  const [center, setCenter] = useState<[number, number]>(WORLD_CENTER);
  const [confirming, setConfirming] = useState(false);

  // Re-centers on the caller's starting point every time the sheet opens
  // (not just on first mount) — mirrors CountryPickerSheet resetting its own
  // query on close, so a stale pin position from a previous open never shows.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setCenter(initialCenter ? [initialCenter.lng, initialCenter.lat] : WORLD_CENTER);
  }, [open, initialCenter]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const [lng, lat] = center;
      const label = (await reverseGeocode({ lat, lng }, { language })) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      onConfirm({ lat, lng, label });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton} accessibilityLabel="Close map picker">
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Drop a pin</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.mapWrap}>
          <Mapbox.MapView
            style={StyleSheet.absoluteFill}
            styleURL={Mapbox.StyleURL.Street}
            onRegionDidChange={(feature) => setCenter(feature.geometry.coordinates as [number, number])}
          >
            <Mapbox.Camera
              defaultSettings={{ centerCoordinate: center, zoomLevel: initialCenter ? LOCAL_ZOOM : WORLD_ZOOM }}
            />
          </Mapbox.MapView>
          <View style={styles.pin} pointerEvents="none">
            <Ionicons name="location" size={PIN_SIZE} color={colors.danger} />
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
            {confirming ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.confirmText}>Use this location</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: { width: 32, alignItems: "center" },
  title: { ...typography.h3, color: colors.textPrimary },
  mapWrap: { flex: 1 },
  // The pin's own bottom tip — not its bounding-box center — is the point
  // that should land exactly on the map's center, so the offset is a full
  // PIN_SIZE upward, not half of it.
  pin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -PIN_SIZE / 2,
    marginTop: -PIN_SIZE,
  },
  footer: { padding: spacing.md, paddingBottom: spacing.lg },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { ...typography.body, color: colors.textOnPrimary, fontWeight: "700" },
});
