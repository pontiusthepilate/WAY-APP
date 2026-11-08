// One-off, idempotent: creates the 3 permanent default profiles (if they
// don't already exist) and backfills the auto-follow for every profile
// that was created before this script ran. Safe to re-run in any
// environment — every step checks "does this already exist" first.
//
// Run with: npx tsx scripts/create-default-profiles.ts
import { prisma } from "../src/lib/db";
import { autoFollowDefaultProfile, DEFAULT_WAY_ID_BY_KIND } from "../src/lib/defaultProfiles";

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:4000";

interface DefaultProfileSpec {
  wayId: string;
  kind: "personal" | "business" | "podcast";
  displayName: string;
  defaultLabel: string;
  email: string;
  displayPictureUrl?: string;
}

const DEFAULTS: DefaultProfileSpec[] = [
  {
    wayId: DEFAULT_WAY_ID_BY_KIND.personal,
    kind: "personal",
    displayName: "M I A",
    defaultLabel: "RQ001",
    email: "legacy-lowc@internal.way.app",
    displayPictureUrl: `${PUBLIC_BASE_URL}/public-assets/lowc.jpg`,
  },
  {
    wayId: DEFAULT_WAY_ID_BY_KIND.business,
    kind: "business",
    displayName: "WAY Ltd",
    defaultLabel: "Official WAY Account",
    email: "legacy-wayltd@internal.way.app",
  },
  {
    wayId: DEFAULT_WAY_ID_BY_KIND.podcast,
    kind: "podcast",
    displayName: "WayCast",
    defaultLabel: "Official WAY Podcast",
    email: "legacy-waycast@internal.way.app",
  },
];

async function ensureDefaultProfile(spec: DefaultProfileSpec) {
  const existing = await prisma.profile.findUnique({ where: { wayId: spec.wayId } });
  if (existing) {
    console.log(`[default-profiles] ${spec.wayId} already exists (${existing.id}) — skipping creation`);
    return existing;
  }

  const user = await prisma.user.create({ data: { email: spec.email } });
  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
      wayId: spec.wayId,
      displayName: spec.displayName,
      displayPictureUrl: spec.displayPictureUrl,
      kind: spec.kind,
      isDefault: true,
      defaultLabel: spec.defaultLabel,
      isVerified: true,
      isPrimary: true,
      notifyFollows: false, // nobody will ever check this account's notifications
    },
  });
  console.log(`[default-profiles] created ${spec.wayId} (${profile.id})`);
  return profile;
}

async function backfillAutoFollows(kind: string) {
  const defaultWayId = DEFAULT_WAY_ID_BY_KIND[kind];
  const defaultProfile = await prisma.profile.findUnique({ where: { wayId: defaultWayId } });
  if (!defaultProfile) return;

  const candidates = await prisma.profile.findMany({
    where: { kind, isDefault: false },
    select: { id: true, kind: true },
  });

  let backfilled = 0;
  for (const profile of candidates) {
    const alreadyFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: profile.id, followingId: defaultProfile.id } },
    });
    if (alreadyFollowing) continue;

    await prisma.$transaction(async (tx) => {
      await autoFollowDefaultProfile(tx, profile);
    });
    backfilled++;
  }
  console.log(`[default-profiles] backfilled ${backfilled} ${kind} profile(s) onto ${defaultWayId}`);
}

async function main() {
  for (const spec of DEFAULTS) {
    await ensureDefaultProfile(spec);
  }
  for (const kind of Object.keys(DEFAULT_WAY_ID_BY_KIND)) {
    await backfillAutoFollows(kind);
  }
}

main()
  .catch((err) => {
    console.error("[default-profiles] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
