import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { textViolatesPolicy, REJECTED_CONTENT_ERROR } from "../lib/moderation";
import { isTranscriptionConfigured, transcribeAudio } from "../lib/transcription";
import { generateShowNotes } from "../lib/episodeShowNotes";

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
  viewerProfileId: z.string().optional(),
});

const likeBody = z.object({ profileId: z.string() });
const commentBody = z.object({ profileId: z.string(), text: z.string().min(1).max(1000) });

const EPISODE_INCLUDE = { profile: { select: PROFILE_SUMMARY_SELECT } } as const;

// Mirrors posts.ts's withViewerLiked, against EpisodeLike instead of Like —
// a plain liked/not-liked flag, no reaction type (see EpisodeLike's schema
// comment for why this is a toggle, not Post's 6-reaction system).
async function withViewerLiked<T extends { id: string }>(episodes: T[], viewerProfileId?: string) {
  if (!viewerProfileId || episodes.length === 0) {
    return episodes.map((e) => ({ ...e, viewerLiked: false }));
  }
  const likes = await prisma.episodeLike.findMany({
    where: { profileId: viewerProfileId, episodeId: { in: episodes.map((e) => e.id) } },
    select: { episodeId: true },
  });
  const likedIds = new Set(likes.map((l) => l.episodeId));
  return episodes.map((e) => ({ ...e, viewerLiked: likedIds.has(e.id) }));
}

// Runs transcription (Deepgram, lib/transcription.ts) then show-notes
// generation (Claude, lib/episodeShowNotes.ts) for one episode, and
// writes the result back. Always fire-and-forget from its callers —
// never awaited by a request handler, since Deepgram's own pre-recorded
// endpoint can take real time for a full episode. Exported so both
// POST /episodes (below) and the backfill script can call it directly.
export async function processEpisodeTranscription(episodeId: string, mediaUrl: string) {
  const transcript = await transcribeAudio(mediaUrl);
  if (!transcript) {
    await prisma.episode.update({ where: { id: episodeId }, data: { transcriptStatus: "failed" } });
    return;
  }
  const showNotes = await generateShowNotes(transcript);
  await prisma.episode.update({
    where: { id: episodeId },
    data: { transcript, showNotes, transcriptStatus: "ready" },
  });
}

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

    const transcriptionConfigured = isTranscriptionConfigured();
    const episode = await prisma.episode.create({
      data: { ...body, transcriptStatus: transcriptionConfigured ? "pending" : "none" },
      include: EPISODE_INCLUDE,
    });
    reply.status(201).send(episode);

    if (transcriptionConfigured) {
      processEpisodeTranscription(episode.id, episode.mediaUrl).catch((err) =>
        app.log.error({ err, episodeId: episode.id }, "episode transcription pipeline failed")
      );
    }
  });

  // Owner-only retry for a "failed" episode (or a re-run on any status) —
  // also the mechanism scripts/backfill-episode-transcripts.ts uses.
  app.post("/episodes/:id/transcribe", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const episode = await prisma.episode.findUnique({ where: { id } });
    if (!episode) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, episode.profileId);
    if (!isTranscriptionConfigured()) {
      return reply.status(422).send({ error: "Transcription isn't configured" });
    }

    await prisma.episode.update({ where: { id }, data: { transcriptStatus: "pending" } });
    reply.status(202).send({ transcriptStatus: "pending" });
    processEpisodeTranscription(id, episode.mediaUrl).catch((err) =>
      app.log.error({ err, episodeId: id }, "episode transcription retry failed")
    );
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
    const withLikes = await withViewerLiked(episodes, q.viewerProfileId);
    return { episodes: withLikes, nextCursor: episodes.length === q.limit ? episodes[episodes.length - 1].id : null };
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
    const withLikes = await withViewerLiked(episodes, q.viewerProfileId);
    return { episodes: withLikes, nextCursor: episodes.length === q.limit ? episodes[episodes.length - 1].id : null };
  });

  app.get("/episodes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { viewerProfileId } = z.object({ viewerProfileId: z.string().optional() }).parse(req.query);
    const episode = await prisma.episode.findUnique({ where: { id }, include: EPISODE_INCLUDE });
    if (!episode) return reply.status(404).send({ error: "Not found" });
    const [withLikes] = await withViewerLiked([episode], viewerProfileId);
    reply.send(withLikes);
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

  // Plain like/unlike toggle (no reaction types — see EpisodeLike's schema
  // comment). Mirrors posts.ts's /posts/:id/like.
  app.post("/episodes/:id/like", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = likeBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const existing = await prisma.episodeLike.findUnique({
      where: { episodeId_profileId: { episodeId: id, profileId } },
    });

    if (existing) {
      const [, episode] = await prisma.$transaction([
        prisma.episodeLike.delete({ where: { id: existing.id } }),
        prisma.episode.update({ where: { id }, data: { likesCount: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false, likesCount: episode.likesCount });
    }

    const [, episode] = await prisma.$transaction([
      prisma.episodeLike.create({ data: { episodeId: id, profileId } }),
      prisma.episode.update({ where: { id }, data: { likesCount: { increment: 1 } } }),
    ]);
    if (episode.profileId !== profileId) {
      const owner = await prisma.profile.findUnique({ where: { id: episode.profileId }, select: { notifyLikes: true } });
      if (owner?.notifyLikes) {
        await prisma.notification.create({
          data: { profileId: episode.profileId, type: "like", actorProfileId: profileId, episodeId: id },
        });
      }
    }
    reply.send({ liked: true, likesCount: episode.likesCount });
  });

  app.get("/episodes/:id/comments", async (req) => {
    const { id } = req.params as { id: string };
    const q = feedQuery.parse(req.query);
    const comments = await prisma.episodeComment.findMany({
      where: { episodeId: id },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "asc" },
    });
    const profileIds = [...new Set(comments.map((c) => c.profileId))];
    const profiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: PROFILE_SUMMARY_SELECT,
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return comments.map((c) => ({ ...c, profile: byId.get(c.profileId) ?? null }));
  });

  app.post("/episodes/:id/comments", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = commentBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    if (await textViolatesPolicy(body.text)) {
      return reply.status(422).send(REJECTED_CONTENT_ERROR);
    }

    const [comment, episode] = await prisma.$transaction([
      prisma.episodeComment.create({ data: { episodeId: id, profileId: body.profileId, text: body.text } }),
      prisma.episode.update({ where: { id }, data: { commentsCount: { increment: 1 } } }),
    ]);
    if (episode.profileId !== body.profileId) {
      const owner = await prisma.profile.findUnique({ where: { id: episode.profileId }, select: { notifyComments: true } });
      if (owner?.notifyComments) {
        await prisma.notification.create({
          data: { profileId: episode.profileId, type: "comment", actorProfileId: body.profileId, episodeId: id },
        });
      }
    }
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId }, select: PROFILE_SUMMARY_SELECT });
    reply.status(201).send({ ...comment, profile });
  });

  app.post("/episodes/:id/share", async (req, reply) => {
    const { id } = req.params as { id: string };
    const episode = await prisma.episode.update({ where: { id }, data: { sharesCount: { increment: 1 } } }).catch(() => null);
    if (!episode) return reply.status(404).send({ error: "Not found" });
    reply.send({ sharesCount: episode.sharesCount });
  });
}
