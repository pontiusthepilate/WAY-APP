import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { LIVEKIT_URL } from "../../api/config";
import { endCall, getCall } from "../../api/calls";
import { endCallKeepSession, reportCallConnected } from "../../lib/callKeep";
import { safeBack } from "../../lib/navigation";
import { takePendingCallSession } from "../../lib/activeCallSession";
import type { Call } from "../../types";

const POLL_MS = 3000;

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [session] = useState(() => takePendingCallSession());
  const [call, setCall] = useState<Call | null>(null);
  const [ended, setEnded] = useState(false);
  const leftRef = useRef(false);

  const leave = useCallback(() => {
    if (leftRef.current || !callId || !activeProfile) return;
    leftRef.current = true;
    endCallKeepSession(callId);
    endCall(callId, activeProfile.id).catch(() => {});
    safeBack();
  }, [callId, activeProfile]);

  useEffect(() => {
    if (!callId || !activeProfile) return;
    getCall(callId, activeProfile.id).then(setCall).catch(() => {});
    const poll = setInterval(() => {
      getCall(callId, activeProfile.id)
        .then((c) => {
          setCall(c);
          if (c.status === "declined" || c.status === "ended" || c.status === "missed") {
            setEnded(true);
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [callId, activeProfile]);

  useEffect(() => {
    if (ended) leave();
  }, [ended, leave]);

  if (!callId || !activeProfile) return null;

  const isVideo = call?.type === "video";
  const canConnect = !!session?.token && session.liveKitConfigured && !!LIVEKIT_URL;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {canConnect ? (
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={session!.token!}
          audio
          video={isVideo}
          connect
          onConnected={() => reportCallConnected(callId)}
          onDisconnected={leave}
        >
          <CallRoomContent
            callId={callId}
            isVideo={isVideo}
            otherDisplayName={session?.otherDisplayName ?? "WAY"}
            otherAvatarUrl={session?.otherAvatarUrl ?? null}
            onEnd={leave}
          />
        </LiveKitRoom>
      ) : (
        <NotReadyContent
          isVideo={isVideo}
          otherDisplayName={session?.otherDisplayName ?? "WAY"}
          otherAvatarUrl={session?.otherAvatarUrl ?? null}
          configured={!!session?.liveKitConfigured && !!LIVEKIT_URL}
          onEnd={leave}
        />
      )}
    </View>
  );
}

function CallRoomContent({
  callId,
  isVideo,
  otherDisplayName,
  otherAvatarUrl,
  onEnd,
}: {
  callId: string;
  isVideo: boolean;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const { isMicrophoneEnabled, isCameraEnabled, cameraTrack, localParticipant } = useLocalParticipant();

  const [seconds, setSeconds] = useState(0);
  const remoteJoined = participants.some((p) => !p.isLocal);

  useEffect(() => {
    if (!remoteJoined) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [remoteJoined]);

  const remoteTrack = tracks.find((t) => !t.participant.isLocal);
  const localTrack = tracks.find((t) => t.participant.isLocal);

  function toggleMic() {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => {});
  }

  function toggleCamera() {
    localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => {});
  }

  function flipCamera() {
    try {
      const mediaTrack = cameraTrack?.track?.mediaStreamTrack as unknown as { _switchCamera?: () => void } | undefined;
      mediaTrack?._switchCamera?.();
    } catch {
      // Best-effort — not critical to the call itself.
    }
  }

  function handleEnd() {
    room.disconnect().catch(() => {});
    onEnd();
  }

  return (
    <View style={styles.roomFill}>
      {isVideo && remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <AvatarFallback displayName={otherDisplayName} avatarUrl={otherAvatarUrl} />
      )}

      <View style={styles.statusOverlay}>
        <Text style={styles.nameText}>{otherDisplayName}</Text>
        <Text style={styles.statusText}>{remoteJoined ? formatDuration(seconds) : "Ringing…"}</Text>
      </View>

      {isVideo && isCameraEnabled && localTrack && (
        <View style={styles.pip}>
          <VideoTrack trackRef={localTrack} style={styles.pipVideo} objectFit="cover" mirror />
        </View>
      )}

      <View style={styles.controls}>
        <ControlButton icon={isMicrophoneEnabled ? "mic" : "mic-off"} active={!isMicrophoneEnabled} onPress={toggleMic} />
        {isVideo && (
          <>
            <ControlButton icon={isCameraEnabled ? "videocam" : "videocam-off"} active={!isCameraEnabled} onPress={toggleCamera} />
            <ControlButton icon="camera-reverse" onPress={flipCamera} />
          </>
        )}
        <ControlButton icon="call" danger onPress={handleEnd} />
      </View>
    </View>
  );
}

function NotReadyContent({
  isVideo,
  otherDisplayName,
  otherAvatarUrl,
  configured,
  onEnd,
}: {
  isVideo: boolean;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  configured: boolean;
  onEnd: () => void;
}) {
  return (
    <View style={styles.roomFill}>
      <AvatarFallback displayName={otherDisplayName} avatarUrl={otherAvatarUrl} />
      <View style={styles.statusOverlay}>
        <Text style={styles.nameText}>{otherDisplayName}</Text>
        <Text style={styles.statusText}>
          {configured ? "Connecting…" : "Calling isn't fully set up yet — add a LiveKit project to enable audio/video"}
        </Text>
      </View>
      <View style={styles.controls}>
        <ControlButton icon="call" danger onPress={onEnd} />
      </View>
    </View>
  );
}

function AvatarFallback({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  return (
    <View style={styles.avatarFallback}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarImage, styles.avatarInitialWrap]}>
          <Text style={styles.avatarInitialText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

function ControlButton({
  icon,
  onPress,
  active,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.controlButton, active && styles.controlButtonActive, danger && styles.controlButtonDanger]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={26} color={colors.textOnPrimary} />
    </Pressable>
  );
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
  roomFill: { flex: 1 },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 120, height: 120, borderRadius: radii.pill, backgroundColor: colors.primaryLight },
  avatarInitialWrap: { alignItems: "center", justifyContent: "center" },
  avatarInitialText: { color: colors.primaryDark, fontWeight: "700", fontSize: 40 },
  remoteVideo: { flex: 1, width: "100%" },
  statusOverlay: {
    position: "absolute",
    top: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  nameText: { ...typography.h2, color: colors.textOnPrimary, textAlign: "center" },
  statusText: { ...typography.body, color: colors.primaryLight, marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.xl },
  pip: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 96,
    height: 128,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pipVideo: { flex: 1 },
  controls: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? spacing.xxl : spacing.xl,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonActive: { backgroundColor: "rgba(255,255,255,0.4)" },
  controlButtonDanger: { backgroundColor: colors.danger },
});
