import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { createLiveSession } from "../api/live";
import { ApiError } from "../api/client";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { DotOutline } from "../components/DotOutline";
import { safeBack } from "../lib/navigation";

export default function GoLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [title, setTitle] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date>(() => new Date(Date.now() + 30 * 60_000));
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const session = await createLiveSession({
        profileId: activeProfile.id,
        title: title.trim() || undefined,
        scheduledFor: scheduling ? scheduledFor.toISOString() : undefined,
      });
      router.replace(`/live/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start your live session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Go Live</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
      <View style={styles.previewWrap}>
        {permission?.granted ? (
          <CameraView style={styles.preview} facing="front" />
        ) : (
          <Pressable style={styles.permissionPrompt} onPress={requestPermission}>
            <Text style={styles.permissionText}>Tap to enable camera preview</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.label}>Title (optional)</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="create-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="What are you going live about?"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <Pressable style={styles.scheduleToggle} onPress={() => setScheduling((v) => !v)}>
        <View style={[styles.checkbox, scheduling && styles.checkboxChecked]} />
        <Text style={styles.scheduleLabel}>Schedule for later instead of going live now</Text>
      </Pressable>

      {scheduling && (
        <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateButtonText}>{scheduledFor.toLocaleString()}</Text>
        </Pressable>
      )}
      {showPicker && (
        <DateTimePicker
          value={scheduledFor}
          mode="datetime"
          minimumDate={new Date()}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) setScheduledFor(date);
          }}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <DotOutline radius={radii.pill} tone="onLight" style={styles.buttonSpacing}>
        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>{scheduling ? "Schedule Live" : "Go Live Now"}</Text>
              <Ionicons name={scheduling ? "calendar-outline" : "videocam-outline"} size={18} color={colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </DotOutline>

      <Text style={styles.footnote}>
        Your followers will get a notification{scheduling ? " when you schedule this" : " that you're live"}. Video
        streaming to viewers is coming soon — this preview is local to your device for now.
      </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  previewWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.primaryDark,
    marginBottom: spacing.lg,
  },
  preview: { flex: 1 },
  permissionPrompt: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  permissionText: { ...typography.body, color: colors.primaryLight, textAlign: "center" },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
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
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  scheduleToggle: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  scheduleLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  dateButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  dateButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md, ...typography.caption },
  buttonSpacing: { marginTop: spacing.xl },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: "700", fontSize: 16 },
  footnote: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
});
