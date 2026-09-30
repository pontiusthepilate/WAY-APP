import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { acceptCameraRequest, declineCameraRequest, getCameraRequest } from "../../api/remoteCamera";
import type { RemoteCameraRequest } from "../../types";
import { formatRelativeTime } from "../../lib/formatRelativeTime";

export default function CameraRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [request, setRequest] = useState<RemoteCameraRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getCameraRequest(id);
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
      const session = await acceptCameraRequest(id, activeProfile.id);
      router.replace(`/remote-camera/${session.id}`);
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    if (!id || !activeProfile) return;
    setResponding(true);
    try {
      const updated = await declineCameraRequest(id, activeProfile.id);
      setRequest(updated);
    } finally {
      setResponding(false);
    }
  }

  if (loading || !request) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Access Request</Text>
      <Text style={styles.subtitle}>
        {request.fromProfile?.displayName ?? "Someone"} (WAY/{request.fromProfile?.wayId}) wants to see your camera
      </Text>
      <Text style={styles.time}>{formatRelativeTime(request.createdAt)}</Text>

      {request.message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{request.message}</Text>
        </View>
      )}

      {request.status === "pending" && isRecipient && (
        <>
          <Text style={styles.notice}>
            Accepting shares your camera live with {request.fromProfile?.displayName}. You can end it at any time.
          </Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.declineButton} onPress={handleDecline} disabled={responding}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={handleAccept} disabled={responding}>
              {responding ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.acceptButtonText}>Accept &amp; Share Camera</Text>}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
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
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  declineButtonText: { color: colors.textSecondary, fontWeight: "700" },
  acceptButton: { flex: 2, backgroundColor: colors.danger, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: "center" },
  acceptButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  statusBox: { marginTop: spacing.lg, alignItems: "center" },
  statusText: { ...typography.body, color: colors.textSecondary },
});
