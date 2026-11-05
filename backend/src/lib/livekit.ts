import { AccessToken } from "livekit-server-sdk";

export function isLiveKitConfigured(): boolean {
  return !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

// A short-lived join token scoped to exactly one room, for exactly one
// participant identity. Minted fresh per call per participant — never
// shared or reused across calls.
export async function createRoomToken(roomName: string, participantIdentity: string): Promise<string> {
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    ttl: "10m",
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
  return token.toJwt();
}
