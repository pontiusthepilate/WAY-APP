import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { sendProfileAccessRequest } from "../api/profileAccessRequests";
import { ApiError } from "../api/client";
import { safeBack } from "../lib/navigation";
import { SkyOceanBackground } from "../components/SkyOceanBackground";
import { DotOutline } from "../components/DotOutline";

const MESSAGE_MAX_LENGTH = 200;

export default function ProfileAccessRequestScreen() {
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
      await sendProfileAccessRequest({ fromProfileId: activeProfile.id, toWayId, message: message.trim() || undefined });
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
        <SkyOceanBackground tone="pale" />
        <View style={[styles.body, { paddingTop: spacing.xl + insets.top }]}>
          <Text style={styles.title}>Request sent</Text>
          <Text style={styles.subtitle}>
            {toDisplayName} will get a notification and can accept or decline. You&apos;ll be notified either way.
          </Text>
          <Pressable style={styles.button} onPress={() => safeBack()}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SkyOceanBackground tone="pale" />
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Request Full Profile Access</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
      <Text style={styles.subtitle}>
        to {toDisplayName} ({toWayId})
      </Text>

      <View style={styles.textAreaWrap}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} style={styles.textAreaIcon} />
        <TextInput
          style={styles.textArea}
          placeholder="Why would you like full access? (optional)"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={message}
          onChangeText={(v) => setMessage(v.slice(0, MESSAGE_MAX_LENGTH))}
        />
      </View>
      <Text style={styles.counter}>
        {message.length}/{MESSAGE_MAX_LENGTH}
      </Text>

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
    minHeight: 80,
    textAlignVertical: "top",
    paddingBottom: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  counter: { ...typography.caption, color: colors.textSecondary, textAlign: "right", marginTop: 4 },
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
