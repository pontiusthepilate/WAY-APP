import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
// Deferred to a require() inside pickAudio() instead of a static import —
// expo-document-picker is a brand-new native module (not yet in whatever
// dev-client build is currently installed), and Expo Router eagerly
// requires every file under app/ to build its route table. A top-level
// import here would crash the WHOLE app at startup, not just this screen,
// until the next native rebuild. A deferred require only touches the
// native module when this screen's picker button is actually pressed.
import type * as DocumentPickerType from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { createEpisode } from "../api/episodes";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import type { EpisodeType } from "../types";

type PickedAudio = { uri: string; name: string; mimeType?: string };
type PickedVideo = { uri: string };

export default function EpisodeComposerScreen() {
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EpisodeType>("audio");
  const [audio, setAudio] = useState<PickedAudio | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAudio() {
    const DocumentPicker: typeof DocumentPickerType = require("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAudio({ uri: a.uri, name: a.name, mimeType: a.mimeType });
    }
  }

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setVideo({ uri: result.assets[0].uri });
  }

  async function pickCoverImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setCoverImage(result.assets[0].uri);
  }

  async function handlePublish() {
    if (!activeProfile) return;
    if (!title.trim()) {
      setError("Give the episode a title.");
      return;
    }
    if (type === "audio" && !audio) {
      setError("Attach an audio file.");
      return;
    }
    if (type === "video" && !video) {
      setError("Attach a video file.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const uploadedCover = coverImage ? await uploadMedia({ uri: coverImage, type: "image" }) : null;
      const uploadedMedia =
        type === "audio"
          ? await uploadMedia({ uri: audio!.uri, type: "audio", mimeType: audio!.mimeType })
          : await uploadMedia({ uri: video!.uri, type: "video" });

      await createEpisode({
        profileId: activeProfile.id,
        title: title.trim(),
        type,
        mediaUrl: uploadedMedia.url,
        coverImageUrl: uploadedCover?.url,
      });
      safeBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish that episode.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <SkyOceanBackground tone="pale" />
      <View style={styles.headerRow}>
        <Pressable onPress={() => safeBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Episode</Text>
        <Pressable onPress={handlePublish} disabled={publishing}>
          {publishing ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.post}>Publish</Text>}
        </Pressable>
      </View>

      <TextInput
        style={styles.titleInput}
        placeholder="Episode title"
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
        maxLength={140}
      />

      <View style={styles.typeRow}>
        {(["audio", "video"] as const).map((t) => (
          <Pressable key={t} style={[styles.typePill, type === t && styles.typePillActive]} onPress={() => setType(t)}>
            <Ionicons
              name={t === "audio" ? "mic-outline" : "videocam-outline"}
              size={16}
              color={type === t ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text style={[styles.typePillText, type === t && styles.typePillTextActive]}>
              {t === "audio" ? "Audio" : "Video"}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === "audio" ? (
        <>
          <Pressable style={styles.mediaButton} onPress={pickAudio}>
            <Ionicons name="musical-notes-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.mediaButtonText}>{audio ? audio.name : "Choose audio file"}</Text>
          </Pressable>

          <Pressable style={styles.coverButton} onPress={pickCoverImage}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverPreview} />
            ) : (
              <View style={[styles.coverPreview, styles.coverPlaceholder]}>
                <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
              </View>
            )}
            <Text style={styles.coverButtonText}>{coverImage ? "Change cover art" : "Add cover art (optional)"}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.mediaButton} onPress={pickVideo}>
          <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.mediaButtonText}>{video ? "Video attached" : "Choose video file"}</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.textSecondary },
  post: { ...typography.body, color: colors.primary, fontWeight: "700" },
  titleInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  typeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { ...typography.body, color: colors.textSecondary, fontWeight: "600" },
  typePillTextActive: { color: colors.textOnPrimary },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  mediaButtonText: { color: colors.primaryDark, fontWeight: "600", flexShrink: 1 },
  coverButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coverPreview: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  coverButtonText: { ...typography.body, color: colors.textSecondary },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
});
