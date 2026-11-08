import type { Prisma } from "@prisma/client";

// The three permanent, non-interactive profiles every new profile of a
// matching kind auto-follows at signup (see routes/profiles.ts). Keys are
// Profile.kind values; values are the fixed wayId each default profile is
// created with (see scripts/create-default-profiles.ts) — looked up by
// wayId rather than a hardcoded id, since the id is only known after that
// script creates the row.
export const DEFAULT_WAY_ID_BY_KIND: Record<string, string> = {
  personal: "lowc",
  business: "wayltd",
  podcast: "waycast",
};

// Creates the auto-follow relationship for a freshly-created profile,
// inside the caller's transaction. Deliberately asymmetric: the default
// profile's followersCount is incremented normally (so it genuinely
// reflects every signup — the whole point), but the new profile's own
// followingCount is NOT incremented, so a brand-new profile still reads
// "0 Following" despite this relationship existing. Silently does nothing
// if no default profile exists yet for this kind (e.g. the one-off
// creation script hasn't run in this environment) — profile creation
// itself must never fail over this.
export async function autoFollowDefaultProfile(tx: Prisma.TransactionClient, newProfile: { id: string; kind: string }) {
  const defaultWayId = DEFAULT_WAY_ID_BY_KIND[newProfile.kind];
  if (!defaultWayId) return;

  const defaultProfile = await tx.profile.findUnique({ where: { wayId: defaultWayId } });
  if (!defaultProfile || defaultProfile.id === newProfile.id) return;

  const alreadyFollowing = await tx.follow.findUnique({
    where: { followerId_followingId: { followerId: newProfile.id, followingId: defaultProfile.id } },
  });
  if (alreadyFollowing) return;

  await tx.follow.create({
    data: { followerId: newProfile.id, followingId: defaultProfile.id, isAutoFollow: true },
  });
  await tx.profile.update({ where: { id: defaultProfile.id }, data: { followersCount: { increment: 1 } } });
}
