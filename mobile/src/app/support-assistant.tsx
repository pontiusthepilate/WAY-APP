import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import { useSession } from "../context/SessionContext";
import { getSupportMessages, sendSupportMessage } from "../api/supportAssistant";
import { safeBack } from "../lib/navigation";
import type { SupportMessage } from "../types";

const SUPPORT_EMAIL = "support@wwwaaayyy.com";

export default function SupportAssistantScreen() {
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const history = await getSupportMessages(activeProfile.id);
      setMessages(history);
    } catch {
      // leave whatever's already shown — no polling here to retry on
    }
  }, [activeProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSend() {
    if (!activeProfile || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, conversationId: "", role: "user", text, createdAt: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      const { reply } = await sendSupportMessage(activeProfile.id, text);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-reply`, conversationId: "", role: "assistant", text: reply, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Support assistant</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => {
          const mine = item.role === "user";
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Ask me anything about using WAY 👋</Text>}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.typingText}>Thinking…</Text>
        </View>
      )}

      <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={styles.emailLink}>
        <Text style={styles.emailLinkText}>Still need a human? {SUPPORT_EMAIL}</Text>
      </Pressable>

      <View style={[styles.composer, { paddingBottom: spacing.sm + insets.bottom }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={!draft.trim() || sending}>
          <Ionicons name="arrow-up" size={18} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  listPadding: { padding: spacing.lg, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.xs },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", borderRadius: radii.md, padding: spacing.sm },
  bubbleTheirs: { backgroundColor: colors.surfaceAlt },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.textOnPrimary },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  typingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  typingText: { ...typography.body, color: colors.textSecondary },
  emailLink: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  emailLinkText: { ...typography.body, color: colors.textSecondary, textAlign: "center", fontSize: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
