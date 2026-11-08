import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";

const followBody = z.object({ followerProfileId: z.string() });
const listQuery = z.object({ limit: z.coerce.number().int().positive().max(50).default(20) });

const profileSummarySelect = {
  id: true,
  wayId: true,
  displayName: true,
  displayPictureUrl: true,
  kind: true,
  isDefault: true,
  defaultLabel: true,
} as const;

export async function followRoutes(app: FastifyInstance) {
  app.post("/profiles/:id/follow", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id: followingId } = req.params as { id: string };
    const { followerProfileId } = followBody.parse(req.body);
    await assertOwnsProfile(userId, followerProfileId);

    if (followerProfileId === followingId) {
      return reply.status(400).send({ error: "You can't follow yourself" });
    }

    const target = await prisma.profile.findUnique({ where: { id: followingId }, select: { isDefault: true, notifyFollows: true } });
    if (target?.isDefault) {
      // LowC/WAY Ltd/WayCast are auto-followed once at signup and never
      // otherwise — not a toggle anyone (including a direct API call) can
      // trigger manually. The mobile Follow button never renders for
      // these, but this guard is what actually enforces it.
      return reply.status(400).send({ error: "This profile can't be followed or unfollowed directly" });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: followerProfileId, followingId } },
    });
    if (existing) return reply.send({ following: true });

    await prisma.$transaction([
      prisma.follow.create({ data: { followerId: followerProfileId, followingId } }),
      prisma.profile.update({ where: { id: followerProfileId }, data: { followingCount: { increment: 1 } } }),
      prisma.profile.update({ where: { id: followingId }, data: { followersCount: { increment: 1 } } }),
    ]);
    if (target?.notifyFollows) {
      await prisma.notification.create({ data: { profileId: followingId, type: "follow", actorProfileId: followerProfileId } });
    }
    reply.status(201).send({ following: true });
  });

  app.delete("/profiles/:id/follow", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id: followingId } = req.params as { id: string };
    const { followerProfileId } = followBody.parse(req.body);
    await assertOwnsProfile(userId, followerProfileId);

    const target = await prisma.profile.findUnique({ where: { id: followingId }, select: { isDefault: true } });
    if (target?.isDefault) {
      return reply.status(400).send({ error: "This profile can't be followed or unfollowed directly" });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: followerProfileId, followingId } },
    });
    if (!existing) return reply.send({ following: false });

    // isAutoFollow rows should be unreachable here now (the guard above
    // rejects any default-profile target before this point), but mirror
    // creation's asymmetry anyway rather than assume — if a follow row
    // was ever created without incrementing the follower's own
    // followingCount, decrementing it unconditionally on delete would
    // drift that count negative relative to reality.
    const updates = [
      prisma.follow.delete({ where: { id: existing.id } }),
      prisma.profile.update({ where: { id: followingId }, data: { followersCount: { decrement: 1 } } }),
    ];
    if (!existing.isAutoFollow) {
      updates.splice(1, 0, prisma.profile.update({ where: { id: followerProfileId }, data: { followingCount: { decrement: 1 } } }));
    }
    await prisma.$transaction(updates);
    reply.send({ following: false });
  });

  app.get("/profiles/:id/follow-status", { onRequest: [app.authenticate] }, async (req) => {
    const { id: followingId } = req.params as { id: string };
    const { followerProfileId } = z.object({ followerProfileId: z.string() }).parse(req.query);
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: followerProfileId, followingId } },
    });
    return { following: !!existing };
  });

  // Follow has no Prisma @relation to Profile (plain string FKs, by
  // existing design — see the model's comments), so the other side has to
  // be fetched and joined by hand rather than via `include`.
  async function resolveProfileList(rows: { otherId: string; isAutoFollow: boolean }[]) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: rows.map((r) => r.otherId) } },
      select: profileSummarySelect,
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows
      .map((r) => {
        const profile = byId.get(r.otherId);
        return profile ? { ...profile, isAutoFollow: r.isAutoFollow } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  // Public: a profile's followers, the default/legacy one (if any) always
  // first so it reads as pinned rather than buried by recency.
  app.get("/profiles/:id/followers", async (req) => {
    const { id } = req.params as { id: string };
    const { limit } = listQuery.parse(req.query);
    const rows = await prisma.follow.findMany({
      where: { followingId: id },
      orderBy: [{ isAutoFollow: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { isAutoFollow: true, followerId: true },
    });
    return resolveProfileList(rows.map((r) => ({ otherId: r.followerId, isAutoFollow: r.isAutoFollow })));
  });

  // Public: who a profile follows, same pinned-first ordering — this is
  // where a brand-new user sees LowC/WAY Ltd/WayCast pinned at the top of
  // their own "Following" list despite their numeric count excluding it.
  app.get("/profiles/:id/following", async (req) => {
    const { id } = req.params as { id: string };
    const { limit } = listQuery.parse(req.query);
    const rows = await prisma.follow.findMany({
      where: { followerId: id },
      orderBy: [{ isAutoFollow: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { isAutoFollow: true, followingId: true },
    });
    return resolveProfileList(rows.map((r) => ({ otherId: r.followingId, isAutoFollow: r.isAutoFollow })));
  });
}
