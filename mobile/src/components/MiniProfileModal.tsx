import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, BackHandler, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult, Profile } from "../types";
import { formatDistance } from "../lib/formatDistance";
import { FollowButton } from "./FollowButton";
import { useSession } from "../context/SessionContext";
import { createBlock, createReport } from "../api/safety";
import { getProfileLinks } from "../api/profileLinks";

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  business: "shield-checkmark-outline",
  podcast: "mic-outline",
};

interface Props {
  result: NearbyResult | null;
  onClose: () => void;
  onSendRequest: (result: NearbyResult) => void;
  onRequestCamera: (result: NearbyResult) => void;
  onMessage: (result: NearbyResult) => void;
  // Lets a viewer jump to another of this profile's owner's profiles via the
  // "Also on WAY" row below — the parent just swaps its own selected/found
  // state, same as picking any other search result (profile-kind
  // cross-linking, feature phase 2).
  onOpenProfile?: (profile: NearbyResult) => void;
}

const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate content", "Other"];

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
export function MiniProfileModal({ result, onClose, onSendRequest, onRequestCamera, onMessage, onOpenProfile }: Props) {
  // Kept mounted past `result` going null so the sheet can finish sliding
  // down before it disappears, instead of vanishing mid-animation. Set
  // directly during render (React's own pattern for state derived from a
  // prop change) rather than in the effect below, which only drives the
  // animation itself.
  const [mountedResult, setMountedResult] = useState(result);
  if (result && result !== mountedResult) setMountedResult(result);

  const { activeProfile } = useSession();
  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [links, setLinks] = useState<Profile[]>([]);

  useEffect(() => {
    if (!result) return;
    getProfileLinks(result.id)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [result]);

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
        setMenuOpen(false);
        setReportMenuOpen(false);
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

  async function handleBlock() {
    if (!activeProfile) return;
    setMenuOpen(false);
    try {
      await createBlock(activeProfile.id, shown.id, "block");
      onClose();
      Alert.alert("Blocked", `You won't see ${shown.displayName} anymore, and they can't message or request you.`);
    } catch {
      Alert.alert("Couldn't block", "Something went wrong. Try again.");
    }
  }

  async function handleMute() {
    if (!activeProfile) return;
    setMenuOpen(false);
    try {
      await createBlock(activeProfile.id, shown.id, "mute");
      onClose();
      Alert.alert("Muted", `You won't see ${shown.displayName}'s posts in your feed.`);
    } catch {
      Alert.alert("Couldn't mute", "Something went wrong. Try again.");
    }
  }

  async function handleReport(reason: string) {
    if (!activeProfile) return;
    setReportMenuOpen(false);
    setMenuOpen(false);
    try {
      await createReport(activeProfile.id, "profile", shown.id, reason);
      onClose();
      Alert.alert("Reported", "Thanks — we'll review this.");
    } catch {
      Alert.alert("Couldn't report", "Something went wrong. Try again.");
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <Pressable
          style={styles.kebabButton}
          onPress={() => {
            setReportMenuOpen(false);
            setMenuOpen((open) => !open);
          }}
          hitSlop={8}
        >
          <Text style={styles.kebabText}>⋯</Text>
        </Pressable>

        {menuOpen && !reportMenuOpen && (
          <View style={styles.dropdown}>
            <Pressable style={styles.dropdownItem} onPress={handleMute}>
              <Text style={styles.dropdownItemText}>Mute</Text>
            </Pressable>
            <Pressable style={styles.dropdownItem} onPress={handleBlock}>
              <Text style={[styles.dropdownItemText, styles.dropdownItemDanger]}>Block</Text>
            </Pressable>
            <Pressable style={styles.dropdownItem} onPress={() => setReportMenuOpen(true)}>
              <Text style={[styles.dropdownItemText, styles.dropdownItemDanger]}>Report</Text>
            </Pressable>
          </View>
        )}

        {reportMenuOpen && (
          <View style={styles.dropdown}>
            {REPORT_REASONS.map((reason) => (
              <Pressable key={reason} style={styles.dropdownItem} onPress={() => handleReport(reason)}>
                <Text style={styles.dropdownItemText}>{reason}</Text>
              </Pressable>
            ))}
          </View>
        )}

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

        {links.length > 0 && (
          <View style={styles.linksBox}>
            <Text style={styles.linksLabel}>Also on WAY</Text>
            <View style={styles.linksRow}>
              {links.map((link) => (
                <Pressable
                  key={link.id}
                  style={styles.linkChip}
                  onPress={() => onOpenProfile?.(link)}
                >
                  {KIND_ICON[link.kind] && (
                    <Ionicons name={KIND_ICON[link.kind]} size={12} color={colors.primaryDark} style={styles.linkChipIcon} />
                  )}
                  <Text style={styles.linkChipText}>WAY/{link.wayId}</Text>
                </Pressable>
              ))}
            </View>
          </View>
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
  kebabButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  kebabText: { fontSize: 22, color: colors.textSecondary, fontWeight: "700" },
  dropdown: {
    position: "absolute",
    top: spacing.sm + 32,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    minWidth: 160,
    zIndex: 10,
    elevation: 10,
  },
  dropdownItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  dropdownItemText: { ...typography.body, color: colors.textPrimary },
  dropdownItemDanger: { color: colors.danger },
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
  linksBox: { marginTop: spacing.md, width: "100%" },
  linksLabel: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xs },
  linksRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs },
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  linkChipIcon: { marginRight: 4 },
  linkChipText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
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
