import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { getMessages, sendMessage } from "../../api/messages";
import { uploadMedia } from "../../api/uploads";
import { safeBack } from "../../lib/navigation";
import type { DirectMessage } from "../../types";

const POLL_MS = 4000;

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId || !activeProfile) return;
    try {
      const page = await getMessages(conversationId, { profileId: activeProfile.id, limit: 50 });
      setMessages(page.messages);
    } catch {
      // next poll will retry
    }
  }, [conversationId, activeProfile]);

  useEffect(() => {
    // Fetch once immediately so the thread isn't blank for up to POLL_MS,
    // then keep polling.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const poll = setInterval(load, POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  async function handleSend() {
    if (!conversationId || !activeProfile || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const message = await sendMessage(conversationId, { profileId: activeProfile.id, text });
    setMessages((prev) => [...prev, message]);
  }

  async function handleAttachPhoto() {
    if (!conversationId || !activeProfile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    setSending(true);
    try {
      const uploaded = await uploadMedia({ uri: result.assets[0].uri, type: "image" });
      const message = await sendMessage(conversationId, {
        profileId: activeProfile.id,
        mediaUrl: uploaded.url,
        mediaType: uploaded.mediaType,
      });
      setMessages((prev) => [...prev, message]);
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
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => {
          const mine = item.senderProfileId === activeProfile?.id;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.mediaUrl && <Image source={{ uri: item.mediaUrl }} style={styles.bubbleImage} />}
                {item.text && (
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Say hello 👋</Text>}
      />

      <View style={[styles.composer, { paddingBottom: spacing.sm + insets.bottom }]}>
        <Pressable onPress={handleAttachPhoto} hitSlop={8} disabled={sending}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={!draft.trim()}>
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
  bubbleImage: { width: 180, height: 180, borderRadius: radii.sm, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
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
