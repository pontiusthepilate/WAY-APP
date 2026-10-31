import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { sendCameraRequest } from "../api/remoteCamera";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { DotOutline } from "../components/DotOutline";

export default function RequestCameraScreen() {
  const { toWayId, toDisplayName } = useLocalSearchParams<{ toWayId: string; toDisplayName: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!activeProfile) return;
    setSending(true);
    setError(null);
    try {
      await sendCameraRequest({ fromProfileId: activeProfile.id, toWayId, message: message.trim() || undefined });
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
        <Text style={styles.title}>Request sent</Text>
        <Text style={styles.subtitle}>
          {toDisplayName} will get a notification. Nothing streams until they accept — you&apos;ll be notified too.
        </Text>
        <Pressable style={styles.button} onPress={() => safeBack()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.xl + insets.top }]}>
      <SkyOceanBackground tone="pale" />
      <Text style={styles.title}>Request Camera Access</Text>
      <Text style={styles.subtitle}>
        to {toDisplayName} (WAY/{toWayId})
      </Text>

      <Text style={styles.notice}>
        They&apos;ll see exactly who&apos;s asking and why, and choose whether to share their camera. They can end it
        at any time.
      </Text>

      <View style={styles.textAreaWrap}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} style={styles.textAreaIcon} />
        <TextInput
          style={styles.textArea}
          placeholder={'Why are you asking? (e.g. "Can you show me what\'s happening there?")'}
          placeholderTextColor={colors.textSecondary}
          multiline
          value={message}
          onChangeText={setMessage}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <DotOutline radius={radii.pill} tone="onDark" style={styles.buttonSpacing}>
        <Pressable style={styles.button} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Send Request</Text>
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
  notice: {
    ...typography.caption,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
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
