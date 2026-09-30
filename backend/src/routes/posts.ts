import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const createPostBody = z.object({
  profileId: z.string(),
  type: z.enum(["text", "image", "video"]),
  mediaUrl: z.string().url().optional(),
  caption: z.string().max(2000).optional(),
});

const feedQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  viewerProfileId: z.string().optional(),
});

const likeBody = z.object({ profileId: z.string() });
const commentBody = z.object({ profileId: z.string(), text: z.string().min(1).max(1000) });


async function withViewerLiked<T extends { id: string }>(posts: T[], viewerProfileId?: string) {
  if (!viewerProfileId || posts.length === 0) {
    return posts.map((p) => ({ ...p, viewerLiked: false }));
  }
  const liked = await prisma.like.findMany({
    where: { profileId: viewerProfileId, postId: { in: posts.map((p) => p.id) } },
    select: { postId: true },
  });
  const likedSet = new Set(liked.map((l) => l.postId));
  return posts.map((p) => ({ ...p, viewerLiked: likedSet.has(p.id) }));
}

export async function postRoutes(app: FastifyInstance) {
  app.post("/posts", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createPostBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    if (body.type !== "text" && !body.mediaUrl) {
      return reply.status(400).send({ error: "mediaUrl is required for image/video posts" });
    }

    const post = await prisma.post.create({
      data: body,
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });
    reply.status(201).send({ ...post, viewerLiked: false });
  });

  // Global reverse-chronological feed (no follow-graph yet — see README).
  app.get("/posts/feed", { onRequest: [app.authenticate] }, async (req) => {
    const q = feedQuery.parse(req.query);

    const posts = await prisma.post.findMany({
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });

    const withLikes = await withViewerLiked(posts, q.viewerProfileId);
    return { posts: withLikes, nextCursor: posts.length === q.limit ? posts[posts.length - 1].id : null };
  });

  app.get("/posts/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { viewerProfileId } = z.object({ viewerProfileId: z.string().optional() }).parse(req.query);
    const post = await prisma.post.findUnique({ where: { id }, include: { profile: { select: PROFILE_SUMMARY_SELECT } } });
    if (!post) return reply.status(404).send({ error: "Not found" });
    const [withLikes] = await withViewerLiked([post], viewerProfileId);
    return withLikes;
  });

  app.get("/profiles/:id/posts", { onRequest: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const q = feedQuery.parse(req.query);

    const posts = await prisma.post.findMany({
      where: { profileId: id },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });

    const withLikes = await withViewerLiked(posts, q.viewerProfileId);
    return { posts: withLikes, nextCursor: posts.length === q.limit ? posts[posts.length - 1].id : null };
  });

  app.delete("/posts/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, post.profileId);
    await prisma.post.delete({ where: { id } });
    reply.status(204).send();
  });

  // Toggles a like from the given profile; returns the resulting state.
  app.post("/posts/:id/like", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = likeBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const existing = await prisma.like.findUnique({
      where: { postId_profileId: { postId: id, profileId } },
    });

    if (existing) {
      const [, post] = await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id }, data: { likesCount: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false, likesCount: post.likesCount });
    }

    const [, post] = await prisma.$transaction([
      prisma.like.create({ data: { postId: id, profileId } }),
      prisma.post.update({ where: { id }, data: { likesCount: { increment: 1 } } }),
    ]);
    reply.send({ liked: true, likesCount: post.likesCount });
  });

  app.post("/posts/:id/view", async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.update({ where: { id }, data: { viewsCount: { increment: 1 } } }).catch(() => null);
    if (!post) return reply.status(404).send({ error: "Not found" });
    reply.send({ viewsCount: post.viewsCount });
  });

  app.post("/posts/:id/share", async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.update({ where: { id }, data: { sharesCount: { increment: 1 } } }).catch(() => null);
    if (!post) return reply.status(404).send({ error: "Not found" });
    reply.send({ sharesCount: post.sharesCount });
  });

  app.get("/posts/:id/comments", { onRequest: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const q = feedQuery.parse(req.query);
    const comments = await prisma.comment.findMany({
      where: { postId: id },
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

  app.post("/posts/:id/comments", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = commentBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    const [comment] = await prisma.$transaction([
      prisma.comment.create({ data: { postId: id, profileId: body.profileId, text: body.text } }),
      prisma.post.update({ where: { id }, data: { commentsCount: { increment: 1 } } }),
    ]);
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId }, select: PROFILE_SUMMARY_SELECT });
    reply.status(201).send({ ...comment, profile });
  });
}
