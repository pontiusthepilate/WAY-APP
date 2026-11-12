import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { acceptProfileAccessRequest, declineProfileAccessRequest, getProfileAccessRequest } from "../../api/profileAccessRequests";
import type { ProfileAccessRequest } from "../../types";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";
import { safeBack } from "../../lib/navigation";

export default function ProfileAccessRequestReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ProfileAccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [alsoBlock, setAlsoBlock] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getProfileAccessRequest(id);
    setRequest(r);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isRecipient = !!activeProfile && !!request && activeProfile.id === request.toProfileId;

  async function handleAccept() {
    if (!id || !activeProfile) return;
    setResponding(true);
    try {
      const updated = await acceptProfileAccessRequest(id, activeProfile.id);
      setRequest(updated);
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    if (!id || !activeProfile) return;
    setResponding(true);
    try {
      const updated = await declineProfileAccessRequest(id, activeProfile.id, alsoBlock);
      setRequest(updated);
    } finally {
      setResponding(false);
    }
  }

  if (loading || !request) {
    return (
      <View style={styles.centered}>
        <SkyOceanBackground tone="pale" />
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile Access Request</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
      <Text style={styles.subtitle}>
        {request.fromProfile?.displayName ?? "Someone"} ({request.fromProfile?.wayId}) wants full access to your
        profile
      </Text>
      <Text style={styles.time}>{formatRelativeTime(request.createdAt)}</Text>

      {request.message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{request.message}</Text>
        </View>
      )}

      {request.status === "pending" && isRecipient && (
        <>
          <View style={styles.blockRow}>
            <Text style={styles.blockRowLabel}>Also block them from requesting again</Text>
            <Switch value={alsoBlock} onValueChange={setAlsoBlock} />
          </View>
          <View style={styles.actionsRow}>
            <Pressable style={styles.declineButton} onPress={handleDecline} disabled={responding}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={handleAccept} disabled={responding}>
              {responding ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.acceptButtonText}>Accept</Text>}
            </Pressable>
          </View>
        </>
      )}

      {request.status !== "pending" && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {request.status === "accepted" ? "You accepted this request." : "This request was declined."}
          </Text>
        </View>
      )}

      {!isRecipient && request.status === "pending" && (
        <Text style={styles.notice}>Waiting for {request.toProfile?.displayName} to respond.</Text>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  messageBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  messageText: { ...typography.body, color: colors.textPrimary },
  notice: {
    ...typography.caption,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.lg,
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  blockRowLabel: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  declineButtonText: { color: colors.textSecondary, fontWeight: "700" },
  acceptButton: { flex: 2, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: "center" },
  acceptButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  statusBox: { marginTop: spacing.lg, alignItems: "center" },
  statusText: { ...typography.body, color: colors.textSecondary },
});
