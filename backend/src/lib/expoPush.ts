import { prisma } from "./db";

// Sends push notifications via Expo's push service — a plain HTTPS endpoint,
// no API key needed. Delivery still ultimately depends on the receiving
// device having a real token, which needs an EAS project id configured on
// the mobile app (see mobile README) and, for iOS, a physical device.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo's endpoint accepts up to 100 messages per request.
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error(`[WAY][push] Expo push API returned ${res.status}`);
      }
    } catch (err) {
      console.error("[WAY][push] failed to reach Expo push API", err);
    }
  }
}

// Sends the same notification to every device registered against any of
// the given profiles (used both for "notify followers" and single-target
// requests like a remote camera ask).
export async function notifyProfiles(
  profileIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (profileIds.length === 0) return;
  const tokens = await prisma.pushToken.findMany({ where: { profileId: { in: profileIds } }, select: { token: true } });
  await sendPushNotifications(tokens.map((t) => ({ to: t.token, title, body, data })));
}
