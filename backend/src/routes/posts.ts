import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { getSuppressedProfileIds } from "../lib/blocking";

const createPostBody = z.object({
  profileId: z.string(),
  type: z.enum(["text", "image", "video", "event"]),
  mediaUrl: z.string().url().optional(),
  caption: z.string().max(2000).optional(),
  // Event-only fields (type: "event"). eventLocation is deliberately free
  // text — an address, a Google Maps link, a landmark, "online" — rather
  // than a structured place lookup.
  eventTitle: z.string().min(1).max(140).optional(),
  eventLocation: z.string().min(1).max(300).optional(),
  eventStartsAt: z.coerce.date().optional(),
  eventCategories: z.array(z.string().min(1).max(30)).max(10).default([]),
  eventMediaType: z.enum(["image", "video"]).optional(),
});

const eventsSearchQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(30).optional(),
  profileId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const feedQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  viewerProfileId: z.string().optional(),
});

const discoverQuery = z.object({
  profileId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
const DISCOVER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const REACTION_TYPES = ["like", "love", "haha", "wow", "sad", "angry"] as const;
const likeBody = z.object({ profileId: z.string(), type: z.enum(REACTION_TYPES).default("like") });
const commentBody = z.object({ profileId: z.string(), text: z.string().min(1).max(1000) });
const shareToProfileBody = z.object({ targetProfileId: z.string() });

// Every post listing/read includes the original it reposts (one level —
// `sharedFromPost` is never itself a repost, see the share-to-profile route
// below), so the client can render "Reposted from WAY/x" + the original's
// own content without a second round trip.
const POST_INCLUDE = {
  profile: { select: PROFILE_SUMMARY_SELECT },
  sharedFromPost: { include: { profile: { select: PROFILE_SUMMARY_SELECT } } },
} as const;


async function withViewerLiked<T extends { id: string }>(posts: T[], viewerProfileId?: string) {
  if (!viewerProfileId || posts.length === 0) {
    return posts.map((p) => ({ ...p, viewerLiked: false, viewerReactionType: null as string | null }));
  }
  const reactions = await prisma.like.findMany({
    where: { profileId: viewerProfileId, postId: { in: posts.map((p) => p.id) } },
    select: { postId: true, type: true },
  });
  const byPostId = new Map(reactions.map((r) => [r.postId, r.type]));
  return posts.map((p) => ({ ...p, viewerLiked: byPostId.has(p.id), viewerReactionType: byPostId.get(p.id) ?? null }));
}

export async function postRoutes(app: FastifyInstance) {
  app.post("/posts", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createPostBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    if (body.type === "image" || body.type === "video") {
      if (!body.mediaUrl) return reply.status(400).send({ error: "mediaUrl is required for image/video posts" });
    } else if (body.type === "event") {
      if (!body.eventTitle || !body.eventLocation) {
        return reply.status(400).send({ error: "eventTitle and eventLocation are required for event posts" });
      }
      if (!!body.mediaUrl !== !!body.eventMediaType) {
        return reply.status(400).send({ error: "mediaUrl and eventMediaType must be given together" });
      }
    }

    const post = await prisma.post.create({
      data: body,
      include: POST_INCLUDE,
    });
    reply.status(201).send({ ...post, viewerLiked: false, viewerReactionType: null });
  });

  // Global reverse-chronological feed (no follow-graph yet — see README).
  app.get("/posts/feed", { onRequest: [app.authenticate] }, async (req) => {
    const q = feedQuery.parse(req.query);
    const suppressed = q.viewerProfileId ? await getSuppressedProfileIds(q.viewerProfileId) : [];

    const posts = await prisma.post.findMany({
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      where: suppressed.length ? { profileId: { notIn: suppressed } } : undefined,
      orderBy: { createdAt: "desc" },
      include: POST_INCLUDE,
    });

    const withLikes = await withViewerLiked(posts, q.viewerProfileId);
    return { posts: withLikes, nextCursor: posts.length === q.limit ? posts[posts.length - 1].id : null };
  });

  // Posts from profiles the viewer doesn't follow — a simple recent-popularity
  // heuristic, not a ranking model. Excludes the viewer's own posts, anyone
  // they already follow, and anyone blocked/muted (getSuppressedProfileIds).
  app.get("/posts/discover", { onRequest: [app.authenticate] }, async (req) => {
    const q = discoverQuery.parse(req.query);
    const [followed, suppressed] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: q.profileId }, select: { followingId: true } }),
      getSuppressedProfileIds(q.profileId),
    ]);
    const excludeIds = [...new Set([q.profileId, ...followed.map((f) => f.followingId), ...suppressed])];

    const posts = await prisma.post.findMany({
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      where: {
        profileId: { notIn: excludeIds },
        createdAt: { gte: new Date(Date.now() - DISCOVER_WINDOW_MS) },
        profile: { isVisible: true },
      },
      orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
      include: POST_INCLUDE,
    });

    const withLikes = await withViewerLiked(posts, q.profileId);
    return { posts: withLikes, nextCursor: posts.length === q.limit ? posts[posts.length - 1].id : null };
  });

  // Event posts, searchable by free-text (title/location) and/or interest
  // category — the dedicated events search surface, separate from the
  // profile-search screen's nearby/address/wayid modes since this searches
  // posts, not profiles. Upcoming events sort first; undated ones (no
  // eventStartsAt) sort last, newest first.
  app.get("/posts/events/search", { onRequest: [app.authenticate] }, async (req) => {
    const q = eventsSearchQuery.parse(req.query);
    const suppressed = q.profileId ? await getSuppressedProfileIds(q.profileId) : [];

    const posts = await prisma.post.findMany({
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      where: {
        type: "event",
        profile: { isVisible: true },
        ...(suppressed.length ? { profileId: { notIn: suppressed } } : {}),
        ...(q.category ? { eventCategories: { has: q.category } } : {}),
        ...(q.q
          ? {
              OR: [
                { eventTitle: { contains: q.q, mode: "insensitive" } },
                { eventLocation: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ eventStartsAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: POST_INCLUDE,
    });

    const withLikes = await withViewerLiked(posts, q.profileId);
    return { posts: withLikes, nextCursor: posts.length === q.limit ? posts[posts.length - 1].id : null };
  });

  app.get("/posts/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { viewerProfileId } = z.object({ viewerProfileId: z.string().optional() }).parse(req.query);
    const post = await prisma.post.findUnique({ where: { id }, include: POST_INCLUDE });
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
      include: POST_INCLUDE,
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

  // Toggles (or switches) a reaction from the given profile. Tapping the
  // same type again removes it; picking a different type switches the
  // existing row in place (no counter change, still one reaction per
  // profile per post); no prior reaction creates one.
  app.post("/posts/:id/like", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId, type } = likeBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const existing = await prisma.like.findUnique({
      where: { postId_profileId: { postId: id, profileId } },
    });

    if (existing && existing.type === type) {
      const [, post] = await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id }, data: { likesCount: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false, reactionType: null, likesCount: post.likesCount });
    }

    if (existing) {
      // Switching type doesn't change the count, so no transaction needed.
      await prisma.like.update({ where: { id: existing.id }, data: { type } });
      const post = await prisma.post.findUniqueOrThrow({ where: { id } });
      return reply.send({ liked: true, reactionType: type, likesCount: post.likesCount });
    }

    const [, post] = await prisma.$transaction([
      prisma.like.create({ data: { postId: id, profileId, type } }),
      prisma.post.update({ where: { id }, data: { likesCount: { increment: 1 } } }),
    ]);
    if (post.profileId !== profileId) {
      const owner = await prisma.profile.findUnique({ where: { id: post.profileId }, select: { notifyLikes: true } });
      if (owner?.notifyLikes) {
        await prisma.notification.create({
          data: { profileId: post.profileId, type: "like", actorProfileId: profileId, postId: id },
        });
      }
    }
    reply.send({ liked: true, reactionType: type, likesCount: post.likesCount });
  });

  // Reaction breakdown by type — fetched on demand (e.g. tapping the count),
  // not included in every feed load.
  app.get("/posts/:id/reactions", { onRequest: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const groups = await prisma.like.groupBy({ by: ["type"], where: { postId: id }, _count: { type: true } });
    return Object.fromEntries(groups.map((g) => [g.type, g._count.type]));
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

  // Cross-profile content sharing (profile-kind feature phase 3): reposts a
  // post from one of the caller's own profiles onto another of their own
  // profiles. Both ends must belong to the caller — this is not a general
  // repost-anyone's-post feature, same ownership framing as profile links.
  app.post("/posts/:id/share-to-profile", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { targetProfileId } = shareToProfileBody.parse(req.body);
    await assertOwnsProfile(userId, targetProfileId);

    const source = await prisma.post.findUnique({ where: { id }, include: { profile: true } });
    if (!source) return reply.status(404).send({ error: "Not found" });
    if (source.profile.userId !== userId) {
      return reply.status(403).send({ error: "You can only share your own posts to another of your profiles" });
    }
    if (source.profileId === targetProfileId) {
      return reply.status(400).send({ error: "This post is already on that profile" });
    }

    // Always point at the original, even when sharing an existing repost —
    // no repost-of-a-repost chains.
    const originalId = source.sharedFromPostId ?? source.id;

    const existing = await prisma.post.findFirst({
      where: { profileId: targetProfileId, sharedFromPostId: originalId },
      include: POST_INCLUDE,
    });
    if (existing) {
      const [withLikes] = await withViewerLiked([existing]);
      return reply.send(withLikes);
    }

    const [repost] = await prisma.$transaction([
      prisma.post.create({
        data: { profileId: targetProfileId, type: "repost", sharedFromPostId: originalId },
        include: POST_INCLUDE,
      }),
      prisma.post.update({ where: { id: originalId }, data: { sharesCount: { increment: 1 } } }),
    ]);
    const [withLikes] = await withViewerLiked([repost]);
    reply.status(201).send(withLikes);
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

    const [comment, post] = await prisma.$transaction([
      prisma.comment.create({ data: { postId: id, profileId: body.profileId, text: body.text } }),
      prisma.post.update({ where: { id }, data: { commentsCount: { increment: 1 } } }),
    ]);
    if (post.profileId !== body.profileId) {
      const owner = await prisma.profile.findUnique({ where: { id: post.profileId }, select: { notifyComments: true } });
      if (owner?.notifyComments) {
        await prisma.notification.create({
          data: { profileId: post.profileId, type: "comment", actorProfileId: body.profileId, postId: id },
        });
      }
    }
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId }, select: PROFILE_SUMMARY_SELECT });
    reply.status(201).send({ ...comment, profile });
  });
}
