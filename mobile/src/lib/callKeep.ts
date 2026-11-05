import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import RNCallKeep from "react-native-callkeep";
import * as Notifications from "expo-notifications";
import { acceptCall, declineCall } from "../api/calls";
import { setPendingCallSession } from "./activeCallSession";

const uuidToCallId = new Map<string, string>();
const callIdToUuid = new Map<string, string>();

// CallKit strictly requires an RFC4122 UUID for a call identifier — our
// backend's call ids are cuids, a different format, so each call gets its
// own generated UUID here, mapped back to the real call id locally.
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function uuidForCall(callId: string): string {
  let uuid = callIdToUuid.get(callId);
  if (!uuid) {
    uuid = uuidv4();
    callIdToUuid.set(callId, uuid);
    uuidToCallId.set(uuid, callId);
  }
  return uuid;
}

function forgetCall(callId: string | undefined, uuid: string) {
  uuidToCallId.delete(uuid);
  if (callId) callIdToUuid.delete(callId);
}

let didSetup = false;

function setupCallKeep() {
  if (didSetup) return;
  didSetup = true;
  RNCallKeep.setup({
    ios: {
      appName: "WAY",
      supportsVideo: true,
      includesCallsInRecents: false,
    },
    android: {
      alertTitle: "Phone account required",
      alertDescription: "WAY needs a phone account registered on this device to show incoming calls.",
      cancelButton: "Cancel",
      okButton: "OK",
      additionalPermissions: [],
      foregroundService: {
        channelId: "com.wayapp.way.calls",
        channelName: "WAY calls",
        notificationTitle: "WAY call in progress",
      },
    },
  }).catch((err: unknown) => console.warn("[WAY] callkeep setup failed:", err instanceof Error ? err.message : err));
  RNCallKeep.setAvailable(true);
}

// Wires CallKeep's native call UI to the backend's /calls signaling API.
// Incoming calls are triggered from the regular Expo push (lib/callNotify.ts
// on the backend also tries a VoIP/PushKit push, but this build doesn't
// register for one yet — see the mobile calling plan notes — so a killed app
// on iOS won't ring from that path until that's added).
export function useCallKeep(profileId: string | undefined) {
  const router = useRouter();
  const profileIdRef = useRef(profileId);

  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);

  useEffect(() => {
    setupCallKeep();
  }, []);

  useEffect(() => {
    const onAnswer = ({ callUUID }: { callUUID: string }) => {
      const callId = uuidToCallId.get(callUUID);
      const activeProfileId = profileIdRef.current;
      if (!callId || !activeProfileId) return;
      acceptCall(callId, activeProfileId)
        .then(({ token, liveKitConfigured }) => {
          setPendingCallSession({
            token,
            liveKitConfigured,
            isCaller: false,
            otherDisplayName: "WAY",
            otherAvatarUrl: null,
          });
          router.push(`/call/${callId}`);
        })
        .catch((err) => {
          console.warn("[WAY] accept call failed:", err instanceof Error ? err.message : err);
          RNCallKeep.endCall(callUUID);
        });
    };

    const onEnd = ({ callUUID }: { callUUID: string }) => {
      const callId = uuidToCallId.get(callUUID);
      const activeProfileId = profileIdRef.current;
      if (callId && activeProfileId) {
        declineCall(callId, activeProfileId).catch(() => {});
      }
      forgetCall(callId, callUUID);
    };

    const answerSub = RNCallKeep.addEventListener("answerCall", onAnswer);
    const endSub = RNCallKeep.addEventListener("endCall", onEnd);

    // The callee's push: wake CallKeep's native incoming-call UI the moment
    // the push arrives, rather than waiting for the user to tap a banner —
    // a call is time-sensitive in a way other notifications aren't.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string | undefined> | undefined;
      if (data?.type !== "incoming_call" || !data.callId) return;
      const uuid = uuidForCall(data.callId);
      RNCallKeep.displayIncomingCall(
        uuid,
        data.conversationId ?? data.callId,
        data.callerDisplayName ?? "WAY",
        "generic",
        data.callType === "video"
      );
    });

    return () => {
      answerSub.remove();
      endSub.remove();
      receivedSub.remove();
    };
  }, [router]);
}

// Called from the caller's side right after POST /calls succeeds, to show
// CallKit/ConnectionService's native "calling…" UI.
export function startOutgoingCallUI(callId: string, calleeDisplayName: string, isVideo: boolean) {
  const uuid = uuidForCall(callId);
  RNCallKeep.startCall(uuid, callId, calleeDisplayName, "generic", isVideo);
}

export function reportCallConnected(callId: string) {
  const uuid = callIdToUuid.get(callId);
  if (uuid) RNCallKeep.reportConnectedOutgoingCallWithUUID(uuid);
}

export function endCallKeepSession(callId: string) {
  const uuid = callIdToUuid.get(callId);
  if (uuid) {
    RNCallKeep.endCall(uuid);
    forgetCall(callId, uuid);
  }
}
