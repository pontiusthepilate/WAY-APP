import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { notifyProfiles } from "../lib/expoPush";

const createSessionBody = z.object({
  profileId: z.string(),
  title: z.string().max(100).optional(),
  scheduledFor: z.coerce.date().optional(),
});
const chatBody = z.object({ profileId: z.string(), text: z.string().min(1).max(500) });

// Fans a notification out to everyone who follows `broadcasterProfileId`.
async function notifyFollowers(broadcasterProfileId: string, title: string, body: string, data: Record<string, unknown>) {
  const followers = await prisma.follow.findMany({ where: { followingId: broadcasterProfileId }, select: { followerId: true } });
  await notifyProfiles(followers.map((f) => f.followerId), title, body, data);
}

export async function liveRoutes(app: FastifyInstance) {
  app.post("/live/sessions", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createSessionBody.parse(req.body);
    const broadcaster = await assertOwnsProfile(userId, body.profileId);

    const isScheduledForFuture = body.scheduledFor && body.scheduledFor.getTime() > Date.now();
    const session = await prisma.liveSession.create({
      data: {
        profileId: body.profileId,
        title: body.title,
        status: isScheduledForFuture ? "scheduled" : "live",
        scheduledFor: body.scheduledFor,
        startedAt: isScheduledForFuture ? null : new Date(),
      },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });

    const name = broadcaster.displayName;
    if (isScheduledForFuture) {
      await notifyFollowers(
        body.profileId,
        `${name} scheduled a live`,
        body.title ? `"${body.title}" — ${body.scheduledFor!.toLocaleString()}` : `Coming up ${body.scheduledFor!.toLocaleString()}`,
        { liveSessionId: session.id }
      );
    } else {
      await notifyFollowers(body.profileId, `${name} is live now`, body.title ?? "Tap to join", { liveSessionId: session.id });
    }

    reply.status(201).send(session);
  });

  app.post("/live/sessions/:id/start", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const session = await prisma.liveSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    const broadcaster = await assertOwnsProfile(userId, session.profileId);
    if (session.status !== "scheduled") return reply.status(400).send({ error: "Session is not scheduled" });

    const updated = await prisma.liveSession.update({
      where: { id },
      data: { status: "live", startedAt: new Date() },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });
    await notifyFollowers(session.profileId, `${broadcaster.displayName} is live now`, session.title ?? "Tap to join", {
      liveSessionId: id,
    });
    reply.send(updated);
  });

  app.post("/live/sessions/:id/end", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const session = await prisma.liveSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, session.profileId);

    const updated = await prisma.liveSession.update({ where: { id }, data: { status: "ended", endedAt: new Date() } });
    reply.send(updated);
  });

  app.get("/live/sessions/active", { onRequest: [app.authenticate] }, async () => {
    return prisma.liveSession.findMany({
      where: { status: "live" },
      orderBy: { startedAt: "desc" },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });
  });

  // Private to the owner — this backs the "Upcoming" section on your own
  // profile, not a public listing of someone else's draft broadcasts.
  app.get("/live/sessions/scheduled", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = z.object({ profileId: z.string() }).parse(req.query);
    await assertOwnsProfile(userId, profileId);
    return prisma.liveSession.findMany({
      where: { profileId, status: "scheduled" },
      orderBy: { scheduledFor: "asc" },
    });
  });

  app.get("/live/sessions/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: { profile: { select: PROFILE_SUMMARY_SELECT } },
    });
    if (!session) return reply.status(404).send({ error: "Not found" });
    reply.send(session);
  });

  // Viewer presence is a simulated counter (feature: video transport is
  // stubbed) — no real connection is being tracked, just join/leave taps.
  app.post("/live/sessions/:id/join", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await prisma.liveSession.update({ where: { id }, data: { viewerCount: { increment: 1 } } }).catch(() => null);
    if (!session) return reply.status(404).send({ error: "Not found" });
    reply.send({ viewerCount: session.viewerCount });
  });

  app.post("/live/sessions/:id/leave", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.liveSession.updateMany({ where: { id, viewerCount: { gt: 0 } }, data: { viewerCount: { decrement: 1 } } });
    const session = await prisma.liveSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    reply.send({ viewerCount: session.viewerCount });
  });

  app.get("/live/sessions/:id/chat", { onRequest: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const messages = await prisma.liveChatMessage.findMany({
      where: { liveSessionId: id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    const profileIds = [...new Set(messages.map((m) => m.profileId))];
    const profiles = profileIds.length
      ? await prisma.profile.findMany({ where: { id: { in: profileIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return messages.map((m) => ({ ...m, profile: byId.get(m.profileId) ?? null }));
  });

  app.post("/live/sessions/:id/chat", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = chatBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    const session = await prisma.liveSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    if (session.status !== "live") return reply.status(400).send({ error: "This live session has ended" });

    const message = await prisma.liveChatMessage.create({
      data: { liveSessionId: id, profileId: body.profileId, text: body.text },
    });
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId }, select: PROFILE_SUMMARY_SELECT });
    reply.status(201).send({ ...message, profile });
  });
}
