import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";
import { FollowButton } from "./FollowButton";

interface Props {
  result: NearbyResult | null;
  onClose: () => void;
  onSendRequest: (result: NearbyResult) => void;
  onRequestCamera: (result: NearbyResult) => void;
  onMessage: (result: NearbyResult) => void;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ANIM_MS = 260;

// Renders the sheet as a plain in-tree overlay rather than React Native's
// <Modal>. Two bugs showed up with <Modal> here: firing navigation in the
// same tick as closing it raced the modal's native dismiss on iOS (the
// pushed screen could end up mounted behind a modal that never finished
// tearing down), and separately, the three action Pressables stopped
// receiving touches entirely once the sheet grew past a certain point —
// confirmed by moving one of them higher in the tree, with nothing else
// changed, and watching it start responding again. Both point at <Modal>'s
// own content-dispatch path on this RN version rather than anything in this
// component's layout. A plain overlay has no native view-controller
// boundary for either problem to occur across.
export function MiniProfileModal({ result, onClose, onSendRequest, onRequestCamera, onMessage }: Props) {
  // Kept mounted past `result` going null so the sheet can finish sliding
  // down before it disappears, instead of vanishing mid-animation. Set
  // directly during render (React's own pattern for state derived from a
  // prop change) rather than in the effect below, which only drives the
  // animation itself.
  const [mountedResult, setMountedResult] = useState(result);
  if (result && result !== mountedResult) setMountedResult(result);

  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (result) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: ANIM_MS, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
      ]).start(() => {
        setMountedResult(null);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [result, onClose]);

  function closeThen(action: () => void) {
    pendingActionRef.current = action;
    onClose();
  }

  if (!mountedResult) return null;
  const shown = mountedResult;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <View style={styles.avatarRing}>
          {shown.displayPictureUrl ? (
            <Image source={{ uri: shown.displayPictureUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.fallback]}>
              <Text style={styles.fallbackText}>{shown.displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{shown.displayName}</Text>
        <Text style={styles.way}>WAY/{shown.wayId}</Text>

        <View style={styles.followRow}>
          <FollowButton targetProfileId={shown.id} />
        </View>

        <View style={styles.statsRow}>
          {shown.distanceMeters != null && <Stat label="Distance" value={formatDistance(shown.distanceMeters)} />}
          <Stat label="Category" value={shown.categories[0] ?? "—"} />
          {shown.isLocationOverridden && <Stat label="Location" value="Set remotely" warn />}
        </View>

        {shown.visibilityText && (
          <View style={styles.visibilityBox}>
            <Text style={styles.visibilityText}>{shown.visibilityText}</Text>
          </View>
        )}

        {shown.isLocationOverridden && (
          <Text style={styles.notice}>
            This profile has set its location remotely. You can request their real location after connecting.
          </Text>
        )}

        <Pressable style={styles.requestButton} onPress={() => closeThen(() => onSendRequest(shown))}>
          <Text style={styles.requestButtonText}>Send WAY Request</Text>
        </Pressable>
        <Pressable style={styles.cameraButton} onPress={() => closeThen(() => onMessage(shown))}>
          <Text style={styles.cameraButtonText}>Message</Text>
        </Pressable>
        <Pressable style={styles.cameraButton} onPress={() => closeThen(() => onRequestCamera(shown))}>
          <Text style={styles.cameraButtonText}>Request Camera Access</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && { color: colors.warning }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(20,40,30,0.35)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatar: { width: 80, height: 80, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  fallback: { alignItems: "center", justifyContent: "center" },
  fallbackText: { color: colors.primaryDark, fontWeight: "700", fontSize: 28 },
  name: { ...typography.h2, color: colors.textPrimary },
  way: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  followRow: { marginTop: spacing.sm },
  statsRow: { flexDirection: "row", marginTop: spacing.md, gap: spacing.lg },
  stat: { alignItems: "center" },
  statValue: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  visibilityBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.sm,
    width: "100%",
  },
  visibilityText: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  notice: {
    ...typography.caption,
    color: colors.warning,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  requestButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  requestButtonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
  cameraButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  cameraButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 16 },
});
