import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;

const createStatusBody = z
  .object({
    profileId: z.string(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["image", "video"]).optional(),
    caption: z.string().max(280).optional(),
    backgroundColor: z.string().max(20).optional(),
  })
  .refine((b) => b.mediaUrl || b.caption, { message: "A status needs media or a caption" });

const activeIdsQuery = z.object({ profileIds: z.string() }); // comma-separated

export async function statusRoutes(app: FastifyInstance) {
  app.post("/statuses", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createStatusBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    const status = await prisma.status.create({
      data: { ...body, expiresAt: new Date(Date.now() + STATUS_LIFETIME_MS) },
    });
    reply.status(201).send(status);
  });

  app.get("/statuses/by-profile/:profileId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { profileId } = req.params as { profileId: string };
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || !profile.isVisible) return reply.status(404).send({ error: "Not found" });

    const statuses = await prisma.status.findMany({
      where: { profileId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" },
    });
    return statuses;
  });

  // Batched "which of these profiles currently have an active status"
  // check — every list screen (feed, search, connections) calls this once
  // per page rather than per-row, to decide whether to draw a ring.
  app.get("/statuses/active-ids", { onRequest: [app.authenticate] }, async (req) => {
    const q = activeIdsQuery.parse(req.query);
    const profileIds = q.profileIds.split(",").filter(Boolean);
    if (!profileIds.length) return [];

    const rows = await prisma.status.findMany({
      where: { profileId: { in: profileIds }, expiresAt: { gt: new Date() } },
      select: { profileId: true },
      distinct: ["profileId"],
    });
    return rows.map((r) => r.profileId);
  });

  app.delete("/statuses/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const status = await prisma.status.findUnique({ where: { id } });
    if (!status) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, status.profileId);
    await prisma.status.delete({ where: { id } });
    reply.status(204).send();
  });
}
