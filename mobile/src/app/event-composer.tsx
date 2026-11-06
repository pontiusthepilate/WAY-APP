import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { createPost } from "../api/posts";
import { uploadMedia } from "../api/uploads";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";

const DESCRIPTION_MAX_LENGTH = 2000;
const TITLE_MAX_LENGTH = 140;

// Fixed interest tags rather than freeform text — keeps event search
// (filter by category) matching cleanly instead of fragmenting across near-
// duplicate tags.
const CATEGORIES = [
  "Music",
  "Sports",
  "Business",
  "Tech",
  "Food & Drink",
  "Arts & Culture",
  "Networking",
  "Education",
  "Health & Wellness",
  "Community",
];

export default function EventComposerScreen() {
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState<Date>(() => new Date(Date.now() + 24 * 60 * 60_000));
  const [showPicker, setShowPicker] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  }

  async function handlePost() {
    if (!activeProfile) return;
    if (!title.trim() || !location.trim()) {
      setError("Add a title and a location.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const uploaded = photo ? await uploadMedia({ uri: photo, type: "image" }) : null;
      await createPost({
        profileId: activeProfile.id,
        type: "event",
        eventTitle: title.trim(),
        eventLocation: location.trim(),
        eventStartsAt: startsAt.toISOString(),
        eventCategories: categories,
        caption: description.trim() || undefined,
        mediaUrl: uploaded?.url,
      });
      safeBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that event.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: spacing.lg + insets.top, paddingBottom: spacing.xxl }}>
      <SkyOceanBackground tone="pale" />
      <View style={styles.headerRow}>
        <Pressable onPress={() => safeBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Event</Text>
        <Pressable onPress={handlePost} disabled={posting}>
          {posting ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.post}>Post</Text>}
        </Pressable>
      </View>

      <Text style={styles.label}>Title</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="What's the event called?"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX_LENGTH))}
        />
      </View>

      <Text style={styles.label}>Location</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="location-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Address, Google Maps link, venue name…"
          placeholderTextColor={colors.textSecondary}
          value={location}
          onChangeText={setLocation}
        />
      </View>

      <Text style={styles.label}>When</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateButtonText}>{startsAt.toLocaleString()}</Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={startsAt}
          mode="datetime"
          minimumDate={new Date()}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) setStartsAt(date);
          }}
        />
      )}

      <Text style={styles.label}>Interests</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.categoryPill, categories.includes(c) && styles.categoryPillActive]}
            onPress={() => toggleCategory(c)}
          >
            <Text style={[styles.categoryLabel, categories.includes(c) && styles.categoryLabelActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Description (optional)</Text>
      <View style={styles.textAreaWrap}>
        <TextInput
          style={styles.textArea}
          placeholder="Tell people what to expect…"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX_LENGTH))}
        />
      </View>
      <Text style={styles.counter}>
        {description.length}/{DESCRIPTION_MAX_LENGTH}
      </Text>

      {photo ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: photo }} style={styles.photoPreview} />
          <View style={styles.photoActionsRow}>
            <Pressable onPress={pickPhoto}>
              <Text style={styles.editPhotoText}>Crop/choose again</Text>
            </Pressable>
            <Pressable onPress={() => setPhoto(null)}>
              <Text style={styles.removePhoto}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.photoButton} onPress={pickPhoto}>
          <Ionicons name="image-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.photoButtonText}>Add cover photo</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.textSecondary },
  post: { ...typography.body, color: colors.primary, fontWeight: "700" },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.xs },
  input: { flex: 1, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  dateButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  dateButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  categoryPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  categoryLabelActive: { color: colors.textOnPrimary },
  textAreaWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(16, 42, 49, 0.08)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  textArea: { minHeight: 90, textAlignVertical: "top", paddingBottom: spacing.md, ...typography.body, color: colors.textPrimary },
  counter: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 4 },
  photoButton: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  photoButtonText: { color: colors.primaryDark, fontWeight: "600" },
  photoPreviewWrap: { marginTop: spacing.md, alignItems: "center" },
  photoPreview: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  photoActionsRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  editPhotoText: { color: colors.primaryDark, ...typography.caption, fontWeight: "600" },
  removePhoto: { color: colors.danger, ...typography.caption },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
});
