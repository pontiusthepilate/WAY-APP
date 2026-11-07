import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { PageBackground } from "../components/PageBackground";
import { useSession } from "../context/SessionContext";
import { createStatus } from "../api/status";
import { uploadMedia } from "../api/uploads";
import { safeBack } from "../lib/navigation";

const BACKGROUND_SWATCHES = [colors.primaryDark, colors.primary, colors.horizon, colors.danger, colors.warning];

export default function StatusComposerScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [media, setMedia] = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [caption, setCaption] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_SWATCHES[0]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickMedia(type: "image" | "video") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    // allowsEditing gives the native picker's own basic crop/trim tool — the
    // same simple-not-complex approach already used for the profile picture.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "image" ? ["images"] : ["videos"],
      quality: type === "image" ? 0.85 : 0.7,
      videoMaxDuration: type === "video" ? 15 : undefined,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri, type });
  }

  async function handlePost() {
    if (!activeProfile) return;
    if (!media && !caption.trim()) {
      setError("Add a photo/video or write something.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      if (media) {
        const uploaded = await uploadMedia(media);
        await createStatus({
          profileId: activeProfile.id,
          mediaUrl: uploaded.url,
          mediaType: uploaded.mediaType,
          caption: caption.trim() || undefined,
        });
      } else {
        await createStatus({ profileId: activeProfile.id, caption: caption.trim(), backgroundColor });
      }
      safeBack();
    } catch {
      setError("Couldn't post that status. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg + insets.top }]}>
      <PageBackground />
      <View style={styles.header}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Status</Text>
        <Pressable onPress={handlePost} disabled={posting} hitSlop={12}>
          {posting ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.postText}>Post</Text>}
        </Pressable>
      </View>

      {media ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
          <Pressable style={styles.removeMedia} onPress={() => setMedia(null)}>
            <Ionicons name="close-circle" size={28} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.textPreview, { backgroundColor }]}>
          <Text style={styles.textPreviewCaption}>{caption || "Type something…"}</Text>
        </View>
      )}

      <TextInput
        style={styles.captionInput}
        placeholder={media ? "Add a caption (optional)" : "What's on your mind?"}
        placeholderTextColor={colors.textSecondary}
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      {!media && (
        <View style={styles.swatchRow}>
          {BACKGROUND_SWATCHES.map((color) => (
            <Pressable
              key={color}
              style={[styles.swatch, { backgroundColor: color }, color === backgroundColor && styles.swatchActive]}
              onPress={() => setBackgroundColor(color)}
            />
          ))}
        </View>
      )}

      <View style={styles.mediaButtonsRow}>
        <Pressable style={styles.mediaButton} onPress={() => pickMedia("image")}>
          <Ionicons name="image-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.mediaButtonText}>Photo</Text>
        </Pressable>
        <Pressable style={styles.mediaButton} onPress={() => pickMedia("video")}>
          <Ionicons name="videocam-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.mediaButtonText}>Video</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  postText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  previewWrap: { borderRadius: radii.lg, overflow: "hidden", aspectRatio: 9 / 14 },
  preview: { width: "100%", height: "100%" },
  removeMedia: { position: "absolute", top: spacing.sm, right: spacing.sm },
  textPreview: { borderRadius: radii.lg, aspectRatio: 9 / 14, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  textPreviewCaption: { ...typography.h2, color: colors.textOnPrimary, textAlign: "center" },
  captionInput: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 60,
  },
  swatchRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.textPrimary },
  mediaButtonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mediaButtonText: { ...typography.body, color: colors.primaryDark, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.sm, ...typography.caption, textAlign: "center" },
});
