import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { endCameraSession, getCameraSession } from "../../api/remoteCamera";
import type { RemoteCameraSession } from "../../types";

export default function RemoteCameraSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState<RemoteCameraSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState(false);

  const isGranter = !!activeProfile && !!session && activeProfile.id === session.granterId;

  const load = useCallback(async () => {
    if (!id) return;
    const s = await getCameraSession(id);
    setSession(s);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleEnd() {
    if (!id || !activeProfile) return;
    await endCameraSession(id, activeProfile.id);
    router.back();
  }

  if (loading || !session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textOnPrimary} />
      </View>
    );
  }

  if (session.status === "ended") {
    return (
      <View style={styles.centered}>
        <Text style={styles.endedText}>This session has ended.</Text>
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const other = isGranter ? session.requester : session.granter;

  return (
    <View style={styles.container}>
      <View style={styles.videoArea}>
        {isGranter ? (
          permission?.granted ? (
            <CameraView style={styles.camera} facing="back" />
          ) : (
            <Pressable style={styles.permissionPrompt} onPress={requestPermission}>
              <Text style={styles.permissionText}>Tap to enable your camera</Text>
            </Pressable>
          )
        ) : (
          <View style={styles.viewerPlaceholder}>
            {other?.displayPictureUrl ? (
              <Image source={{ uri: other.displayPictureUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{other?.displayName.charAt(0).toUpperCase() ?? "?"}</Text>
              </View>
            )}
            <Text style={styles.viewerPlaceholderText}>Live video streaming is coming soon</Text>
            <Text style={styles.viewerPlaceholderSub}>
              {other?.displayName} granted you access — the connection is live, video just isn&apos;t wired up yet.
            </Text>
          </View>
        )}

        <View style={styles.overlayTop}>
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>{isGranter ? "● SHARING" : "● CONNECTED"}</Text>
          </View>
        </View>

        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.infoTitle}>
          {isGranter ? `Sharing your camera with ${other?.displayName}` : `Connected to ${other?.displayName}'s camera`}
        </Text>
        <Text style={styles.infoSub}>
          {isGranter ? "You can end this at any time." : "They can end this at any time."}
        </Text>

        {!isGranter && (
          <Pressable style={styles.saveButton} onPress={() => setSaveNotice(true)}>
            <Text style={styles.saveButtonText}>Save Stream</Text>
          </Pressable>
        )}
        {saveNotice && (
          <Text style={styles.saveNotice}>Recording will be available once live video streaming is wired up.</Text>
        )}

        <Pressable style={styles.endButton} onPress={handleEnd}>
          <Text style={styles.endButtonText}>{isGranter ? "Stop Sharing" : "End Session"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark, padding: spacing.xl },
  videoArea: { width: "100%", aspectRatio: 3 / 4, backgroundColor: colors.primaryDark },
  camera: { flex: 1 },
  permissionPrompt: { flex: 1, alignItems: "center", justifyContent: "center" },
  permissionText: { ...typography.body, color: colors.primaryLight },
  viewerPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  avatar: { width: 96, height: 96, borderRadius: radii.pill, backgroundColor: colors.primaryLight, marginBottom: spacing.md },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 32 },
  viewerPlaceholderText: { ...typography.h3, color: colors.textOnPrimary, textAlign: "center" },
  viewerPlaceholderSub: { ...typography.caption, color: colors.primaryLight, textAlign: "center", marginTop: spacing.xs },
  overlayTop: { position: "absolute", top: spacing.lg, left: spacing.lg },
  liveTag: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  liveTagText: { color: colors.textOnPrimary, fontWeight: "800", fontSize: 12 },
  closeButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  infoPanel: { flex: 1, padding: spacing.xl },
  infoTitle: { ...typography.h3, color: colors.textOnPrimary },
  infoSub: { ...typography.caption, color: colors.primaryLight, marginTop: spacing.xs },
  saveButton: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  saveButtonText: { color: colors.primaryLight, fontWeight: "700" },
  saveNotice: { ...typography.caption, color: colors.warning, textAlign: "center", marginTop: spacing.sm },
  endButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  endButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  endedText: { ...typography.h3, color: colors.textOnPrimary },
  doneButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  doneButtonText: { color: colors.primaryDark, fontWeight: "700" },
});
