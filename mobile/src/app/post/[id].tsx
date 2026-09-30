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
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { PostCard } from "../../components/PostCard";
import { useSession } from "../../context/SessionContext";
import { addComment, getComments, getPost } from "../../api/posts";
import type { Comment, Post } from "../../types";
import { formatRelativeTime } from "../../lib/formatRelativeTime";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();

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
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centered}>
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
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
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
        <TextInput
          style={styles.input}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
          {sending ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.sendButtonText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
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
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
});
