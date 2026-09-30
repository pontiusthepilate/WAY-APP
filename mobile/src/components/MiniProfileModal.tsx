import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { NearbyResult } from "../types";
import { formatDistance } from "../lib/formatDistance";
import { FollowButton } from "./FollowButton";

interface Props {
  result: NearbyResult | null;
  onClose: () => void;
  onSendRequest: (result: NearbyResult) => void;
  onRequestCamera: (result: NearbyResult) => void;
}

export function MiniProfileModal({ result, onClose, onSendRequest, onRequestCamera }: Props) {
  return (
    <Modal visible={!!result} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {result && (
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.avatarRing}>
            {result.displayPictureUrl ? (
              <Image source={{ uri: result.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.fallbackText}>{result.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{result.displayName}</Text>
          <Text style={styles.way}>WAY/{result.wayId}</Text>

          <View style={styles.followRow}>
            <FollowButton targetProfileId={result.id} />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Distance" value={formatDistance(result.distanceMeters)} />
            <Stat label="Category" value={result.categories[0] ?? "—"} />
            {result.isLocationOverridden && <Stat label="Location" value="Set remotely" warn />}
          </View>

          {result.visibilityText && (
            <View style={styles.visibilityBox}>
              <Text style={styles.visibilityText}>{result.visibilityText}</Text>
            </View>
          )}

          {result.isLocationOverridden && (
            <Text style={styles.notice}>
              This profile has set its location remotely. You can request their real location after connecting.
            </Text>
          )}

          <Pressable style={styles.requestButton} onPress={() => onSendRequest(result)}>
            <Text style={styles.requestButtonText}>Send WAY Request</Text>
          </Pressable>
          <Pressable style={styles.cameraButton} onPress={() => onRequestCamera(result)}>
            <Text style={styles.cameraButtonText}>Request Camera Access</Text>
          </Pressable>
        </View>
      )}
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: "rgba(20,40,30,0.35)" },
  sheet: {
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
