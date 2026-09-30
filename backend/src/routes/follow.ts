import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";

const followBody = z.object({ followerProfileId: z.string() });

export async function followRoutes(app: FastifyInstance) {
  app.post("/profiles/:id/follow", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id: followingId } = req.params as { id: string };
    const { followerProfileId } = followBody.parse(req.body);
    await assertOwnsProfile(userId, followerProfileId);

    if (followerProfileId === followingId) {
      return reply.status(400).send({ error: "You can't follow yourself" });
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
    reply.status(201).send({ following: true });
  });

  app.delete("/profiles/:id/follow", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id: followingId } = req.params as { id: string };
    const { followerProfileId } = followBody.parse(req.body);
    await assertOwnsProfile(userId, followerProfileId);

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: followerProfileId, followingId } },
    });
    if (!existing) return reply.send({ following: false });

    await prisma.$transaction([
      prisma.follow.delete({ where: { id: existing.id } }),
      prisma.profile.update({ where: { id: followerProfileId }, data: { followingCount: { decrement: 1 } } }),
      prisma.profile.update({ where: { id: followingId }, data: { followersCount: { decrement: 1 } } }),
    ]);
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
}
