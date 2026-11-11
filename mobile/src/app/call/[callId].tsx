import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Device from "expo-device";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  LiveKitRoom,
  VideoTrack,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors, radii, spacing, typography } from "../../theme/theme";
import { useSession } from "../../context/SessionContext";
import { LIVEKIT_URL } from "../../api/config";
import { acceptCall, endCall, getCall } from "../../api/calls";
import { endCallKeepSession, reportCallConnected } from "../../lib/callKeep";
import { safeBack } from "../../lib/navigation";
import { takePendingCallSession, type PendingCallSession } from "../../lib/activeCallSession";
import type { Call } from "../../types";

const POLL_MS = 3000;

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { activeProfile } = useSession();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState(() => takePendingCallSession());
  const [call, setCall] = useState<Call | null>(null);
  const [ended, setEnded] = useState(false);
  const leftRef = useRef(false);
  const acceptAttemptedRef = useRef(false);

  // Reached with no pending session when this screen was opened some way
  // other than the normal in-app call-button/CallKeep-answer flow — a deep
  // link, or the app relaunching into a call already in progress. If this
  // profile is the callee of a still-ringing call, accept it here instead of
  // just showing "not set up" — this is the one transition the backend lets
  // a participant trigger after the fact.
  useEffect(() => {
    if (session || !call || !activeProfile || acceptAttemptedRef.current) return;
    if (call.calleeProfileId !== activeProfile.id || call.status !== "ringing") return;
    acceptAttemptedRef.current = true;
    acceptCall(callId, activeProfile.id)
      .then(({ token, liveKitConfigured }) => {
        const resumed: PendingCallSession = {
          token,
          liveKitConfigured,
          isCaller: false,
          otherDisplayName: "WAY",
          otherAvatarUrl: null,
        };
        setSession(resumed);
      })
      .catch(() => {});
  }, [session, call, activeProfile, callId]);

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
  // The Simulator's virtual audio device crashes LiveKit's native WebRTC
  // audio engine (AVAudioEngine/AudioToolbox abort) the moment it tries to
  // actually start capturing — join the room to exercise the real
  // connection, but never request mic/camera capture there.
  const canCapture = Device.isDevice;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {canConnect ? (
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={session!.token!}
          audio={canCapture}
          video={canCapture && isVideo}
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

  // Live captions: each participant transcribes only their OWN mic
  // on-device (expo-speech-recognition — iOS SFSpeechRecognizer / Android
  // SpeechRecognizer), then broadcasts the resulting text over LiveKit's
  // existing data channel. No backend involvement, no per-minute cost —
  // see the "Live captioning" plan for why this beats a server ASR relay.
  const [captionsOn, setCaptionsOn] = useState(false);
  const captionsOnRef = useRef(false);
  const [finalCaption, setFinalCaption] = useState("");
  const [partialCaption, setPartialCaption] = useState("");
  const [remoteCaption, setRemoteCaption] = useState("");
  const localCaption = `${finalCaption} ${partialCaption}`.trim();

  useEffect(() => {
    captionsOnRef.current = captionsOn;
  }, [captionsOn]);

  const { send: sendCaption } = useDataChannel("caption", (msg) => {
    setRemoteCaption(new TextDecoder().decode(msg.payload));
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!captionsOnRef.current) return;
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      setFinalCaption((prev) => `${prev} ${text}`.trim());
      setPartialCaption("");
    } else {
      setPartialCaption(text);
    }
  });

  // Speech recognition is a best-effort enhancement to the call, not part
  // of it — an error here (no network, unsupported locale, etc.) should
  // never surface anything mid-call; the CC button simply stays off.
  useSpeechRecognitionEvent("error", () => {});

  useEffect(() => {
    if (!captionsOn) return;
    sendCaption(new TextEncoder().encode(localCaption), {}).catch(() => {});
  }, [localCaption, captionsOn, sendCaption]);

  useEffect(() => {
    return () => {
      if (captionsOnRef.current) ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  async function toggleCaptions() {
    if (!Device.isDevice) return; // see canCapture above — needs real mic capture
    if (captionsOn) {
      ExpoSpeechRecognitionModule.stop();
      setCaptionsOn(false);
      setFinalCaption("");
      setPartialCaption("");
      sendCaption(new TextEncoder().encode(""), {}).catch(() => {});
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    setCaptionsOn(true);
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: true });
  }

  const remoteTrack = tracks.find((t) => !t.participant.isLocal);
  const localTrack = tracks.find((t) => t.participant.isLocal);

  function toggleMic() {
    if (!Device.isDevice) return; // see canCapture above — would crash the Simulator's audio engine
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => {});
  }

  function toggleCamera() {
    if (!Device.isDevice) return;
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

      {(localCaption || remoteCaption) && (
        <View style={styles.captionOverlay}>
          {localCaption ? <Text style={styles.captionText}>You: {localCaption}</Text> : null}
          {remoteCaption ? <Text style={styles.captionText}>{otherDisplayName}: {remoteCaption}</Text> : null}
        </View>
      )}

      {isVideo && isCameraEnabled && localTrack && (
        <View style={styles.pip}>
          <VideoTrack trackRef={localTrack} style={styles.pipVideo} objectFit="cover" mirror />
        </View>
      )}

      <View style={styles.controls}>
        <ControlButton icon={isMicrophoneEnabled ? "mic" : "mic-off"} active={!isMicrophoneEnabled} onPress={toggleMic} />
        <ControlButton icon="logo-closed-captioning" active={captionsOn} onPress={toggleCaptions} />
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
  captionOverlay: {
    position: "absolute",
    top: spacing.xxl + 72,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  captionText: {
    ...typography.body,
    color: colors.textOnPrimary,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    overflow: "hidden",
  },
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
