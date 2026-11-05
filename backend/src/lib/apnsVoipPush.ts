import http2 from "node:http2";
import jwt from "jsonwebtoken";

// VoIP pushes are the one notification type this app can't send through
// Expo's push service — Expo's API has no PushKit/VoIP option, so this
// talks to Apple's APNs HTTP/2 endpoint directly. Separate from
// lib/expoPush.ts on purpose: the two paths use entirely different auth
// (Expo token vs Apple .p8 key + JWT), payload shape, and endpoint, and a
// "voip" PushToken must never be sent through the Expo path (it isn't a
// valid Expo push token).
const APNS_BUNDLE_ID = "com.wayapp.way";
const APNS_VOIP_TOPIC = `${APNS_BUNDLE_ID}.voip`;
// Sandbox by default — this app has no production iOS build yet. Flip
// APNS_VOIP_PRODUCTION=1 once it does.
const APNS_HOST = process.env.APNS_VOIP_PRODUCTION ? "api.push.apple.com" : "api.development.push.apple.com";

export function isApnsVoipConfigured(): boolean {
  return !!(process.env.APNS_VOIP_KEY_ID && process.env.APNS_VOIP_TEAM_ID && process.env.APNS_VOIP_KEY_P8);
}

// Apple's own guidance: reuse the provider JWT for up to ~1h rather than
// minting one per push. A plain module-level cache is enough here — this
// is a single backend process, not a multi-instance deployment.
let cachedToken: { jwt: string; mintedAt: number } | null = null;
const TOKEN_LIFETIME_MS = 50 * 60 * 1000;

function getProviderToken(): string {
  if (cachedToken && Date.now() - cachedToken.mintedAt < TOKEN_LIFETIME_MS) {
    return cachedToken.jwt;
  }
  const signed = jwt.sign({ iss: process.env.APNS_VOIP_TEAM_ID, iat: Math.floor(Date.now() / 1000) }, process.env.APNS_VOIP_KEY_P8!, {
    algorithm: "ES256",
    keyid: process.env.APNS_VOIP_KEY_ID,
  });
  cachedToken = { jwt: signed, mintedAt: Date.now() };
  return signed;
}

// Sends a VoIP push to a single device token. The payload is data-only —
// VoIP pushes have no OS-rendered banner; receiving one is what's
// supposed to make the app show its own CallKit incoming-call UI.
export async function sendVoipPush(deviceToken: string, data: Record<string, unknown>): Promise<void> {
  if (!isApnsVoipConfigured()) {
    console.warn("[WAY][apns-voip] not configured — skipping VoIP push");
    return;
  }

  const client = http2.connect(`https://${APNS_HOST}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${getProviderToken()}`,
        "apns-topic": APNS_VOIP_TOPIC,
        "apns-push-type": "voip",
        "apns-priority": "10",
        "apns-expiration": "0",
      });
      let responseBody = "";
      req.on("response", (headers) => {
        const status = headers[":status"];
        req.on("data", (chunk) => (responseBody += chunk));
        req.on("end", () => {
          if (status === 200) {
            resolve();
          } else {
            reject(new Error(`APNs VoIP push failed (${status}): ${responseBody}`));
          }
        });
      });
      req.on("error", reject);
      req.end(JSON.stringify({ aps: { ...data } }));
    });
  } catch (err) {
    console.error("[WAY][apns-voip] push failed", err);
  } finally {
    client.close();
  }
}
