import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { sendWayRequest } from "../api/wayRequests";
import type { DiscoveredVia } from "../types";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { DotOutline } from "../components/DotOutline";

const MAX_VIDEO_SECONDS = 5;

export default function WayRequestScreen() {
  const { toWayId, toDisplayName, discoveredVia } = useLocalSearchParams<{
    toWayId: string;
    toDisplayName: string;
    discoveredVia?: DiscoveredVia;
  }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "image" });
    }
  }

  async function recordShortVideo() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    // videoMaxDuration caps the recording at MAX_VIDEO_SECONDS, doubling as
    // the "5 sec video crop" — the camera simply won't record past it.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: MAX_VIDEO_SECONDS,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "video" });
    }
  }

  async function handleSend() {
    if (!activeProfile) return;
    setSending(true);
    setError(null);
    try {
      const uploaded = media ? await uploadMedia(media) : null;
      await sendWayRequest({
        fromProfileId: activeProfile.id,
        toWayId,
        text: text.trim() || undefined,
        mediaUrl: uploaded?.url,
        mediaType: uploaded?.mediaType,
        discoveredVia,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that request.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View style={[styles.container, { paddingTop: spacing.xl + insets.top }]}>
        <SkyOceanBackground tone="pale" />
        <Text style={styles.title}>WAY Request sent</Text>
        <Text style={styles.subtitle}>{toDisplayName} will see it in their requests.</Text>
        <Pressable style={styles.button} onPress={() => safeBack()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.xl + insets.top }]}>
      <SkyOceanBackground tone="pale" />
      <Text style={styles.title}>Send a WAY Request</Text>
      <Text style={styles.subtitle}>to {toDisplayName} ({toWayId})</Text>

      <View style={styles.textAreaWrap}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} style={styles.textAreaIcon} />
        <TextInput
          style={styles.textArea}
          placeholder="Say hello, or add context (optional)"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={text}
          onChangeText={setText}
        />
      </View>

      {media && (
        <View style={styles.mediaPreviewWrap}>
          {media.type === "image" ? (
            <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
          ) : (
            <View style={[styles.mediaPreview, styles.videoBadgeWrap]}>
              <Text style={styles.videoBadge}>5s video attached</Text>
            </View>
          )}
          <Pressable onPress={() => setMedia(null)}>
            <Text style={styles.removeMedia}>Remove</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.mediaRow}>
        <Pressable style={styles.mediaButton} onPress={pickPhoto}>
          <Text style={styles.mediaButtonText}>Add Photo</Text>
        </Pressable>
        <Pressable style={styles.mediaButton} onPress={recordShortVideo}>
          <Text style={styles.mediaButtonText}>Record 5s Video</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <DotOutline radius={radii.pill} tone="onDark" style={styles.buttonSpacing}>
        <Pressable style={styles.button} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Send WAY Request</Text>
              <Ionicons name="paper-plane-outline" size={18} color={colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </DotOutline>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  textAreaWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  textAreaIcon: { marginRight: spacing.xs, marginTop: 2 },
  textArea: {
    flex: 1,
    minHeight: 100,
    textAlignVertical: "top",
    paddingBottom: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  mediaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  mediaButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  mediaButtonText: { color: colors.primaryDark, fontWeight: "600" },
  mediaPreviewWrap: { marginTop: spacing.md, alignItems: "center" },
  mediaPreview: { width: 160, height: 160, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  videoBadgeWrap: { alignItems: "center", justifyContent: "center" },
  videoBadge: { color: colors.primaryDark, fontWeight: "600" },
  removeMedia: { color: colors.danger, marginTop: spacing.xs, ...typography.caption },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
  buttonSpacing: { marginTop: spacing.xl },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
