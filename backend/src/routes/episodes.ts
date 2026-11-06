import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const createEpisodeBody = z.object({
  profileId: z.string(),
  title: z.string().min(1).max(140),
  type: z.enum(["audio", "video"]),
  mediaUrl: z.string().url(),
  coverImageUrl: z.string().url().optional(),
});

const feedQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const EPISODE_INCLUDE = { profile: { select: PROFILE_SUMMARY_SELECT } } as const;

// Podcast-profile content (profile-kind feature phase 4) — a separate model
// from Post, never going through the regular post composer/feed.
export async function episodeRoutes(app: FastifyInstance) {
  app.post("/episodes", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createEpisodeBody.parse(req.body);
    const profile = await assertOwnsProfile(userId, body.profileId);
    if (profile.kind !== "podcast") {
      return reply.status(403).send({ error: "Only podcast profiles can publish episodes" });
    }

    const episode = await prisma.episode.create({ data: body, include: EPISODE_INCLUDE });
    reply.status(201).send(episode);
  });

  // Cross-podcast reverse-chronological feed — the "podcast-focused feed"
  // half of this phase. No follow-graph/discover split like posts have yet;
  // every podcast profile's episodes are public by default.
  app.get("/episodes/feed", async (req) => {
    const q = feedQuery.parse(req.query);
    const episodes = await prisma.episode.findMany({
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: EPISODE_INCLUDE,
    });
    return { episodes, nextCursor: episodes.length === q.limit ? episodes[episodes.length - 1].id : null };
  });

  app.get("/profiles/:id/episodes", async (req) => {
    const { id } = req.params as { id: string };
    const q = feedQuery.parse(req.query);
    const episodes = await prisma.episode.findMany({
      where: { profileId: id },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: EPISODE_INCLUDE,
    });
    return { episodes, nextCursor: episodes.length === q.limit ? episodes[episodes.length - 1].id : null };
  });

  app.get("/episodes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const episode = await prisma.episode.findUnique({ where: { id }, include: EPISODE_INCLUDE });
    if (!episode) return reply.status(404).send({ error: "Not found" });
    reply.send(episode);
  });

  app.post("/episodes/:id/play", async (req, reply) => {
    const { id } = req.params as { id: string };
    const episode = await prisma.episode.update({ where: { id }, data: { playsCount: { increment: 1 } } }).catch(() => null);
    if (!episode) return reply.status(404).send({ error: "Not found" });
    reply.send({ playsCount: episode.playsCount });
  });

  app.delete("/episodes/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const episode = await prisma.episode.findUnique({ where: { id } });
    if (!episode) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, episode.profileId);
    await prisma.episode.delete({ where: { id } });
    reply.status(204).send();
  });
}
