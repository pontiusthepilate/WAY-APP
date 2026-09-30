import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { sendWayRequest } from "../api/wayRequests";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";

const MAX_VIDEO_SECONDS = 5;

export default function WayRequestScreen() {
  const { toWayId, toDisplayName } = useLocalSearchParams<{ toWayId: string; toDisplayName: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();

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
      <View style={styles.container}>
        <Text style={styles.title}>WAY Request sent</Text>
        <Text style={styles.subtitle}>{toDisplayName} will see it in their requests.</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Send a WAY Request</Text>
      <Text style={styles.subtitle}>to {toDisplayName} (WAY/{toWayId})</Text>

      <TextInput
        style={styles.textArea}
        placeholder="Say hello, or add context (optional)"
        placeholderTextColor={colors.textSecondary}
        multiline
        value={text}
        onChangeText={setText}
      />

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

      <Pressable style={styles.button} onPress={handleSend} disabled={sending}>
        {sending ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Send WAY Request</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
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
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
});
