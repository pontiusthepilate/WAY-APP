interface PendingCallSession {
  token: string | null;
  liveKitConfigured: boolean;
  isCaller: boolean;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
}

let pending: PendingCallSession | null = null;

// Set right before navigating to app/call/[callId].tsx, so the LiveKit join
// token doesn't have to round-trip through router query params. The call
// screen reads this once on mount via takePendingCallSession.
export function setPendingCallSession(session: PendingCallSession) {
  pending = session;
}

export function takePendingCallSession(): PendingCallSession | null {
  const session = pending;
  pending = null;
  return session;
}
