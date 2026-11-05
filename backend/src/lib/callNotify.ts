import { prisma } from "./db";
import { sendPushNotifications } from "./expoPush";
import { sendVoipPush } from "./apnsVoipPush";
import type { Call } from "@prisma/client";

// Rings a callee on every device they've registered. Android has no VoIP
// push concept — a high-priority Expo/FCM data push is what wakes the app
// and triggers ConnectionService there. iOS needs the real VoIP push
// (lib/apnsVoipPush.ts) to reliably show CallKit when backgrounded/killed;
// the regular push is sent there too since it's harmless and covers the
// case where the app is already foregrounded.
export async function notifyIncomingCall(calleeProfileId: string, call: Call, callerDisplayName: string): Promise<void> {
  const tokens = await prisma.pushToken.findMany({ where: { profileId: calleeProfileId } });
  const data = { type: "incoming_call", callId: call.id, conversationId: call.conversationId, callType: call.type };

  const expoTokens = tokens.filter((t) => t.type === "expo");
  await sendPushNotifications(
    expoTokens.map((t) => ({
      to: t.token,
      title: `${callerDisplayName} is calling`,
      body: call.type === "video" ? "Incoming video call" : "Incoming voice call",
      data,
      priority: "high",
    }))
  );

  const voipTokens = tokens.filter((t) => t.type === "voip");
  await Promise.all(voipTokens.map((t) => sendVoipPush(t.token, data)));
}
