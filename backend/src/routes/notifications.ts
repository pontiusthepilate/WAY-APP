import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const listQuery = z.object({
  profileId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
const profileIdQuery = z.object({ profileId: z.string() });

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const q = listQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);

    const notifications = await prisma.notification.findMany({
      where: { profileId: q.profileId },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    const actorIds = [...new Set(notifications.map((n) => n.actorProfileId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await prisma.profile.findMany({ where: { id: { in: actorIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));

    return {
      notifications: notifications.map((n) => ({ ...n, actor: n.actorProfileId ? actorById.get(n.actorProfileId) ?? null : null })),
      nextCursor: notifications.length === q.limit ? notifications[notifications.length - 1].id : null,
    };
  });

  app.get("/notifications/unread-count", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const q = profileIdQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);
    const count = await prisma.notification.count({ where: { profileId: q.profileId, read: false } });
    return { count };
  });

  app.post("/notifications/:id/read", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = profileIdQuery.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.profileId !== profileId) return reply.status(404).send({ error: "Not found" });
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
    reply.send(updated);
  });

  app.post("/notifications/read-all", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = profileIdQuery.parse(req.body);
    await assertOwnsProfile(userId, profileId);
    await prisma.notification.updateMany({ where: { profileId, read: false }, data: { read: true } });
    return { ok: true };
  });
}
