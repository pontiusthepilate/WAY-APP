import React, { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme/theme";
import type { Post } from "../types";

const VIDEO_HOLD_MS = 30000;
const STILL_HOLD_MS = 10000;

interface Props {
  post: Post;
  onDismiss: () => void;
}

// What auto-scroll shows when it reaches a video, image, or text post: the
// full post takes over the screen (muted if it's a video) and holds there —
// 30s for video, 10s for a still (image/text) — then eases back out and
// auto-scroll continues. Tapping to unmute, or any other interaction with
// the spotlighted post, cancels the auto-revert so it stays up until the
// viewer closes it themselves.
export function AutoScrollSpotlight({ post, onDismiss }: Props) {
  const content = post.type === "repost" && post.sharedFromPost ? post.sharedFromPost : post;
  const [interacted, setInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelAutoRevert() {
    if (interacted) return;
    setInteracted(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(() => {
    const holdMs = content.type === "video" ? VIDEO_HOLD_MS : STILL_HOLD_MS;
    timerRef.current = setTimeout(onDismiss, holdMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Only ever run once per spotlighted post — `interacted` clearing the
    // timer is handled directly in cancelAutoRevert, not by re-running this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.id]);

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.wrap}>
        {content.type === "video" && content.mediaUrl ? (
          <SpotlightVideo uri={content.mediaUrl} onInteract={cancelAutoRevert} />
        ) : (
          <Pressable style={styles.fill} onPress={cancelAutoRevert}>
            {content.type === "image" && content.mediaUrl ? (
              <Image source={{ uri: content.mediaUrl }} style={styles.fill} resizeMode="contain" />
            ) : (
              <View style={styles.textWrap}>
                <Text style={styles.textBody}>{content.caption}</Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable style={styles.closeButton} onPress={onDismiss} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </Modal>
  );
}

function SpotlightVideo({ uri, onInteract }: { uri: string; onInteract: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.play();
  });
  const { muted } = useEvent(player, "mutedChange", { muted: player.muted });

  return (
    <Pressable style={styles.fill} onPress={onInteract}>
      <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls />
      <Pressable
        style={styles.muteButton}
        onPress={() => {
          // expo-video's player is an imperative mutable handle, not a pure
          // value — mutating it post-construction (e.g. a mute toggle) is
          // its documented usage, so this isn't the unsafe case the rule
          // otherwise guards against.
          // eslint-disable-next-line react-hooks/immutability
          player.muted = !player.muted;
          onInteract();
        }}
        hitSlop={10}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={20} color={colors.textOnPrimary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  textWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  textBody: { ...typography.h2, color: colors.textOnPrimary, textAlign: "center" },
  closeButton: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  muteButton: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
