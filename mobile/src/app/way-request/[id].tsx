import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { acceptWayRequest, declineWayRequest, getWayRequest } from "../../api/wayRequests";
import type { WayRequest } from "../../types";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";

export default function WayRequestReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfile } = useSession();
  const [request, setRequest] = useState<WayRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getWayRequest(id);
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
      const updated = await acceptWayRequest(id, activeProfile.id);
      setRequest(updated);
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    if (!id || !activeProfile) return;
    setResponding(true);
    try {
      const updated = await declineWayRequest(id, activeProfile.id);
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
      <Text style={styles.title}>WAY Request</Text>
      <Text style={styles.subtitle}>
        {request.fromProfile?.displayName ?? "Someone"} (WAY/{request.fromProfile?.wayId}) wants to connect
      </Text>
      <Text style={styles.time}>{formatRelativeTime(request.createdAt)}</Text>

      {request.text && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{request.text}</Text>
        </View>
      )}

      {request.mediaType === "image" && request.mediaUrl && (
        <Image source={{ uri: request.mediaUrl }} style={styles.media} resizeMode="cover" />
      )}
      {request.mediaType === "video" && request.mediaUrl && <VideoAttachment uri={request.mediaUrl} />}

      {request.status === "pending" && isRecipient && (
        <View style={styles.actionsRow}>
          <Pressable style={styles.declineButton} onPress={handleDecline} disabled={responding}>
            <Text style={styles.declineButtonText}>Decline</Text>
          </Pressable>
          <Pressable style={styles.acceptButton} onPress={handleAccept} disabled={responding}>
            {responding ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.acceptButtonText}>Accept</Text>}
          </Pressable>
        </View>
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

function VideoAttachment({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={styles.media} nativeControls />;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  messageBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  messageText: { ...typography.body, color: colors.textPrimary },
  media: { width: "100%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, marginTop: spacing.lg },
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
  acceptButton: { flex: 2, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: "center" },
  acceptButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  statusBox: { marginTop: spacing.lg, alignItems: "center" },
  statusText: { ...typography.body, color: colors.textSecondary },
});
