import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import {
  endLiveSession,
  getLiveChat,
  getLiveSession,
  joinLiveSession,
  leaveLiveSession,
  sendLiveChat,
  startLiveSession,
} from "../../api/live";
import type { LiveChatMessage, LiveSession } from "../../types";

const CHAT_POLL_MS = 4000;

export default function LiveSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfile } = useSession();
  const [permission, requestPermission] = useCameraPermissions();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const hasJoinedRef = useRef(false);

  const isBroadcaster = !!activeProfile && !!session && activeProfile.id === session.profileId;

  const loadSession = useCallback(async () => {
    if (!id) return;
    const s = await getLiveSession(id);
    setSession(s);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // Fetches whenever the route's `id` changes — a legitimate
    // fetch-on-dependency-change effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  // Join/leave viewer presence once we know whether we're watching (not broadcasting).
  useEffect(() => {
    if (!id || !session || isBroadcaster || session.status !== "live" || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    joinLiveSession(id).catch(() => {});
    return () => {
      leaveLiveSession(id).catch(() => {});
    };
  }, [id, session, isBroadcaster]);

  useEffect(() => {
    if (!id || session?.status !== "live") return;
    const poll = setInterval(() => {
      getLiveChat(id).then(setMessages).catch(() => {});
      getLiveSession(id).then(setSession).catch(() => {});
    }, CHAT_POLL_MS);
    return () => clearInterval(poll);
  }, [id, session?.status]);

  async function handleStartNow() {
    if (!id) return;
    const s = await startLiveSession(id);
    setSession(s);
  }

  async function handleEnd() {
    if (!id) return;
    await endLiveSession(id);
    router.back();
  }

  async function handleSendChat() {
    if (!id || !activeProfile || !draft.trim()) return;
    const message = await sendLiveChat(id, { profileId: activeProfile.id, text: draft.trim() });
    setMessages((prev) => [...prev, message]);
    setDraft("");
  }

  if (loading || !session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textOnPrimary} />
      </View>
    );
  }

  if (session.status === "ended") {
    return (
      <View style={styles.centered}>
        <Text style={styles.endedText}>This live session has ended.</Text>
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (session.status === "scheduled") {
    return (
      <View style={styles.centered}>
        <Text style={styles.scheduledTitle}>{session.title ?? `${session.profile.displayName}'s live`}</Text>
        <Text style={styles.scheduledFor}>
          Scheduled for {session.scheduledFor ? new Date(session.scheduledFor).toLocaleString() : "soon"}
        </Text>
        {isBroadcaster ? (
          <Pressable style={styles.doneButton} onPress={handleStartNow}>
            <Text style={styles.doneButtonText}>Start Now</Text>
          </Pressable>
        ) : (
          <Text style={styles.notice}>Check back at the scheduled time.</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.videoArea}>
        {isBroadcaster ? (
          permission?.granted ? (
            <CameraView style={styles.camera} facing="front" />
          ) : (
            <Pressable style={styles.permissionPrompt} onPress={requestPermission}>
              <Text style={styles.permissionText}>Tap to enable your camera</Text>
            </Pressable>
          )
        ) : (
          <View style={styles.viewerPlaceholder}>
            {session.profile.displayPictureUrl ? (
              <Image source={{ uri: session.profile.displayPictureUrl }} style={styles.broadcasterAvatar} />
            ) : (
              <View style={[styles.broadcasterAvatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{session.profile.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.viewerPlaceholderText}>Live video streaming is coming soon</Text>
            <Text style={styles.viewerPlaceholderSub}>You&apos;re connected — chat and viewer count are live.</Text>
          </View>
        )}

        <View style={styles.overlayTop}>
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>● LIVE</Text>
          </View>
          <View style={styles.viewerCountTag}>
            <Text style={styles.viewerCountText}>{session.viewerCount} watching</Text>
          </View>
        </View>

        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>

        {isBroadcaster && (
          <Pressable style={styles.endButton} onPress={handleEnd}>
            <Text style={styles.endButtonText}>End Live</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        style={styles.chatList}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Text style={styles.chatLine}>
            <Text style={styles.chatAuthor}>{item.profile?.displayName ?? "Someone"}: </Text>
            {item.text}
          </Text>
        )}
      />

      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder="Say something…"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSendChat}
        />
        <Pressable style={styles.sendButton} onPress={handleSendChat} disabled={!draft.trim()}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark, padding: spacing.xl },
  videoArea: { width: "100%", aspectRatio: 3 / 4, backgroundColor: colors.primaryDark },
  camera: { flex: 1 },
  permissionPrompt: { flex: 1, alignItems: "center", justifyContent: "center" },
  permissionText: { ...typography.body, color: colors.primaryLight },
  viewerPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  broadcasterAvatar: { width: 96, height: 96, borderRadius: radii.pill, backgroundColor: colors.primaryLight, marginBottom: spacing.md },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primaryDark, fontWeight: "700", fontSize: 32 },
  viewerPlaceholderText: { ...typography.h3, color: colors.textOnPrimary, textAlign: "center" },
  viewerPlaceholderSub: { ...typography.caption, color: colors.primaryLight, textAlign: "center", marginTop: spacing.xs },
  overlayTop: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  liveTag: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  liveTagText: { color: colors.textOnPrimary, fontWeight: "800", fontSize: 12 },
  viewerCountTag: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  viewerCountText: { color: colors.textOnPrimary, fontWeight: "600", fontSize: 12 },
  closeButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  endButton: {
    position: "absolute",
    bottom: spacing.md,
    alignSelf: "center",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  endButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  chatList: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  chatLine: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.xs },
  chatAuthor: { fontWeight: "700", color: colors.primaryDark },
  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  sendButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.md, justifyContent: "center" },
  sendButtonText: { color: colors.textOnPrimary, fontWeight: "700" },
  scheduledTitle: { ...typography.h2, color: colors.textOnPrimary, textAlign: "center" },
  scheduledFor: { ...typography.body, color: colors.primaryLight, marginTop: spacing.sm, textAlign: "center" },
  notice: { ...typography.caption, color: colors.primaryLight, marginTop: spacing.lg, textAlign: "center" },
  endedText: { ...typography.h3, color: colors.textOnPrimary },
  doneButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  doneButtonText: { color: colors.primaryDark, fontWeight: "700" },
});
