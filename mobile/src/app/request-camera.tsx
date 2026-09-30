import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { sendCameraRequest } from "../api/remoteCamera";
import { ApiError } from "../api/client";

export default function RequestCameraScreen() {
  const { toWayId, toDisplayName } = useLocalSearchParams<{ toWayId: string; toDisplayName: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();

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
      <View style={styles.container}>
        <Text style={styles.title}>Request sent</Text>
        <Text style={styles.subtitle}>
          {toDisplayName} will get a notification. Nothing streams until they accept — you&apos;ll be notified too.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Request Camera Access</Text>
      <Text style={styles.subtitle}>
        to {toDisplayName} (WAY/{toWayId})
      </Text>

      <Text style={styles.notice}>
        They&apos;ll see exactly who&apos;s asking and why, and choose whether to share their camera. They can end it
        at any time.
      </Text>

      <TextInput
        style={styles.textArea}
        placeholder={'Why are you asking? (e.g. "Can you show me what\'s happening there?")'}
        placeholderTextColor={colors.textSecondary}
        multiline
        value={message}
        onChangeText={setMessage}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSend} disabled={sending}>
        {sending ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Send Request</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
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
