import { prisma } from "./db";
import type { Profile } from "@prisma/client";

export type ProfileAccessLevel = "full" | "restricted";

// Full access is only ever evaluated for an *accepted* connector (someone
// with an accepted WayRequest to/from the owner) — a stranger who hasn't
// connected always gets "restricted", regardless of the owner's auto-grant
// rules. Within that, access is FULL if either the connector's discovery
// source (how they found the owner) or their own profile kind matches one
// of the owner's enabled auto-grant flags (OR across both groups and across
// every accepted connection), or if the owner has separately `accepted` a
// ProfileAccessRequest from this viewer.
export async function computeProfileAccessLevel(viewerProfileId: string, owner: Profile): Promise<ProfileAccessLevel> {
  if (viewerProfileId === owner.id) return "full";

  const viewer = await prisma.profile.findUnique({ where: { id: viewerProfileId }, select: { kind: true } });
  if (!viewer) return "restricted";

  const accepted = await prisma.wayRequest.findMany({
    where: {
      status: "accepted",
      OR: [
        { fromProfileId: viewerProfileId, toProfileId: owner.id },
        { fromProfileId: owner.id, toProfileId: viewerProfileId },
      ],
    },
    select: { discoveredVia: true },
  });

  const viaGrant =
    (owner.autoGrantAccessViaNearby && accepted.some((r) => r.discoveredVia === "nearby")) ||
    (owner.autoGrantAccessViaAddress && accepted.some((r) => r.discoveredVia === "address")) ||
    (owner.autoGrantAccessViaLocation && accepted.some((r) => r.discoveredVia === "location"));

  const kindGrant =
    accepted.length > 0 &&
    ((owner.autoGrantAccessToPersonal && viewer.kind === "personal") ||
      (owner.autoGrantAccessToBusiness && viewer.kind === "business") ||
      (owner.autoGrantAccessToPodcast && viewer.kind === "podcast"));

  if (viaGrant || kindGrant) return "full";

  const approvedRequest = await prisma.profileAccessRequest.findFirst({
    where: { fromProfileId: viewerProfileId, toProfileId: owner.id, status: "accepted" },
  });
  if (approvedRequest) return "full";

  return "restricted";
}

// Looks up the accepted WayRequest connecting these two profiles (either
// direction), or null if they aren't connected via one (a ProfileAccessRequest-
// only "full" access has no such row — this feature only applies when an
// actual Connect exists). Two features key off this single row:
// discoveredVia (shown back to the viewer on the full-profile page) and
// fromSharesPhone/toSharesPhone (the per-connection phone-number reveal —
// see routes/profiles.ts's GET/PATCH .../share-phone).
export async function getConnection(profileAId: string, profileBId: string) {
  return prisma.wayRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromProfileId: profileAId, toProfileId: profileBId },
        { fromProfileId: profileBId, toProfileId: profileAId },
      ],
    },
    orderBy: { respondedAt: "desc" },
  });
}

// The fixed field subset shown when accessLevel is "restricted" — the same
// fields MiniProfileModal already shows to anyone, so the full-profile page
// never reveals less than the mini-profile card does.
export function restrictedProfileView(owner: Profile) {
  return {
    id: owner.id,
    wayId: owner.wayId,
    displayName: owner.displayName,
    displayPictureUrl: owner.displayPictureUrl,
    kind: owner.kind,
    isVerified: owner.isVerified,
    categories: owner.categories,
    whichWay: owner.whichWay,
    visibilityText: owner.visibilityText,
    visibilityImageUrl: owner.visibilityImageUrl,
    isDefault: owner.isDefault,
    defaultLabel: owner.defaultLabel,
  };
}
