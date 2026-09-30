import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser } from "../lib/auth";

const createRequestBody = z.object({
  fromProfileId: z.string(),
  toWayId: z.string(),
  text: z.string().max(500).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

export async function wayRequestRoutes(app: FastifyInstance) {
  app.post("/way-requests", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createRequestBody.parse(req.body);

    const fromProfile = await prisma.profile.findUnique({ where: { id: body.fromProfileId } });
    if (!fromProfile || fromProfile.userId !== userId) {
      return reply.status(404).send({ error: "Sender profile not found" });
    }

    const toProfile = await prisma.profile.findUnique({ where: { wayId: body.toWayId } });
    if (!toProfile) {
      return reply.status(404).send({ error: "That WAY doesn't exist" });
    }

    const created = await prisma.wayRequest.create({
      data: {
        fromProfileId: fromProfile.id,
        toProfileId: toProfile.id,
        text: body.text,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
      },
    });
    reply.status(201).send(created);
  });

  app.get("/way-requests/received", { onRequest: [app.authenticate] }, async (req) => {
    const { profileId } = req.query as { profileId?: string };
    if (!profileId) return [];
    return prisma.wayRequest.findMany({ where: { toProfileId: profileId }, orderBy: { createdAt: "desc" } });
  });
}
