import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { PostCard } from "../../components/PostCard";
import { useSession } from "../../context/SessionContext";
import { addComment, getComments, getPost } from "../../api/posts";
import { safeBack } from "../../lib/navigation";
import type { Comment, Post } from "../../types";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { SkyOceanBackground } from "../../components/SkyOceanBackground";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [postResult, commentsResult] = await Promise.all([
        getPost(id, activeProfile?.id),
        getComments(id),
      ]);
      setPost(postResult);
      setComments(commentsResult);
    } finally {
      setLoading(false);
    }
  }, [id, activeProfile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!activeProfile || !id || !draft.trim()) return;
    setSending(true);
    try {
      const comment = await addComment(id, { profileId: activeProfile.id, text: draft.trim() });
      setComments((prev) => [...prev, comment]);
      setDraft("");
      setPost((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <SkyOceanBackground tone="pale" />
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        <SkyOceanBackground tone="pale" />
        <Text style={styles.empty}>Post not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <SkyOceanBackground tone="pale" />
      <View style={[styles.headerRow, { paddingTop: spacing.lg + insets.top }]}>
        <Pressable onPress={() => safeBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Post</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={<PostCard post={post} onChange={setPost} onOpenComments={() => {}} />}
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentAuthor}>{item.profile?.displayName ?? "Someone"}</Text>
            <Text style={styles.commentText}>{item.text}</Text>
            <Text style={styles.commentTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No comments yet.</Text>}
      />

      <View style={styles.composerRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Add a comment…"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
          />
        </View>
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
          {sending ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.sendButtonText}>Send</Text>
              <Ionicons name="paper-plane-outline" size={16} color={colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { ...typography.body, color: colors.primary },
  title: { ...typography.h3, color: colors.textPrimary },
  commentRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  commentAuthor: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  commentText: { ...typography.body, color: colors.textPrimary, marginTop: 2 },
  commentTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center", padding: spacing.lg },
  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
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
  sendButton: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
});
