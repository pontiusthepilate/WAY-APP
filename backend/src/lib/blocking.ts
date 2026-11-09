import { prisma } from "./db";

// The set of profile ids that `profileId` should not see content from.
// `includeMuted` (default true) controls whether a one-directional mute
// counts: feed queries want it (muting hides their posts from your feed),
// but search/discoverability queries should pass `includeMuted: false` —
// muting is silent and shouldn't make someone harder to find, only block
// does that (and block is always mutual here, both directions suppressed).
export async function getSuppressedProfileIds(
  profileId: string,
  options?: { includeMuted?: boolean }
): Promise<string[]> {
  const includeMuted = options?.includeMuted ?? true;
  const edges = await prisma.block.findMany({
    where: {
      OR: [
        { actorProfileId: profileId, ...(includeMuted ? {} : { type: "block" as const }) }, // profiles I blocked (or muted, if included)
        { actorProfileId: { not: profileId }, targetProfileId: profileId, type: "block" }, // profiles who blocked me
      ],
    },
    select: { actorProfileId: true, targetProfileId: true },
  });
  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(edge.actorProfileId === profileId ? edge.targetProfileId : edge.actorProfileId);
  }
  return [...ids];
}

// True if either profile has blocked the other (not muted — mute doesn't
// prevent contact, only hides posts). Used to reject new conversations and
// WayRequests between blocked pairs.
export async function isBlockedEitherWay(profileAId: string, profileBId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      type: "block",
      OR: [
        { actorProfileId: profileAId, targetProfileId: profileBId },
        { actorProfileId: profileBId, targetProfileId: profileAId },
      ],
    },
  });
  return !!block;
}

// Narrow and one-directional, unlike isBlockedEitherWay: true only if OWNER
// has specifically blocked REQUESTER from sending another
// ProfileAccessRequest (Block.type "access_request"). A requester blocked
// this way can still message/WayRequest/be found in search as normal — this
// only gates new access-request creation (routes/profileAccessRequests.ts).
export async function isAccessRequestBlocked(ownerProfileId: string, requesterProfileId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: { actorProfileId: ownerProfileId, targetProfileId: requesterProfileId, type: "access_request" },
  });
  return !!block;
}
