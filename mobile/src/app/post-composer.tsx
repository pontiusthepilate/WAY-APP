import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { createPost } from "../api/posts";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";

export default function PostComposerScreen() {
  const router = useRouter();
  const { activeProfile } = useSession();
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri, type: "image" });
  }

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7, videoMaxDuration: 60 });
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri, type: "video" });
  }

  async function handlePost() {
    if (!activeProfile) return;
    if (!media && !caption.trim()) {
      setError("Add a caption or attach a photo/video.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      if (media) {
        const uploaded = await uploadMedia(media);
        await createPost({
          profileId: activeProfile.id,
          type: uploaded.mediaType,
          mediaUrl: uploaded.url,
          caption: caption.trim() || undefined,
        });
      } else {
        await createPost({ profileId: activeProfile.id, type: "text", caption: caption.trim() });
      }
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that post.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Post</Text>
        <Pressable onPress={handlePost} disabled={posting}>
          {posting ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.post}>Post</Text>}
        </Pressable>
      </View>

      <TextInput
        style={styles.textArea}
        placeholder={`What's on your mind, ${activeProfile?.displayName ?? ""}?`}
        placeholderTextColor={colors.textSecondary}
        multiline
        value={caption}
        onChangeText={setCaption}
      />

      {media && (
        <View style={styles.mediaPreviewWrap}>
          {media.type === "image" ? (
            <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
          ) : (
            <View style={[styles.mediaPreview, styles.videoBadgeWrap]}>
              <Text style={styles.videoBadge}>Video attached</Text>
            </View>
          )}
          <Pressable onPress={() => setMedia(null)}>
            <Text style={styles.removeMedia}>Remove</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!media && (
        <View style={styles.mediaRow}>
          <Pressable style={styles.mediaButton} onPress={pickPhoto}>
            <Text style={styles.mediaButtonText}>Add Photo</Text>
          </Pressable>
          <Pressable style={styles.mediaButton} onPress={pickVideo}>
            <Text style={styles.mediaButtonText}>Add Video</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.textSecondary },
  post: { ...typography.body, color: colors.primary, fontWeight: "700" },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 120,
    textAlignVertical: "top",
    ...typography.body,
    color: colors.textPrimary,
  },
  mediaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  mediaButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
  },
  mediaButtonText: { color: colors.primaryDark, fontWeight: "600" },
  mediaPreviewWrap: { marginTop: spacing.md, alignItems: "center" },
  mediaPreview: { width: "100%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  videoBadgeWrap: { alignItems: "center", justifyContent: "center" },
  videoBadge: { color: colors.primaryDark, fontWeight: "600" },
  removeMedia: { color: colors.danger, marginTop: spacing.xs, ...typography.caption },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
});
