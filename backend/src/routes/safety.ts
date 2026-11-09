import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const blockType = z.enum(["block", "mute", "access_request"]);

const createBlockBody = z.object({ profileId: z.string(), targetProfileId: z.string(), type: blockType });
const removeBlockQuery = z.object({ profileId: z.string(), type: blockType });
const listBlocksQuery = z.object({ profileId: z.string(), type: blockType });

const createReportBody = z.object({
  profileId: z.string(),
  targetType: z.enum(["profile", "post", "comment"]),
  targetId: z.string(),
  reason: z.string().min(1).max(500),
});

export async function safetyRoutes(app: FastifyInstance) {
  app.post("/blocks", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createBlockBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId === body.targetProfileId) {
      return reply.status(400).send({ error: "Can't block or mute yourself" });
    }

    const block = await prisma.block.upsert({
      where: {
        actorProfileId_targetProfileId_type: {
          actorProfileId: body.profileId,
          targetProfileId: body.targetProfileId,
          type: body.type,
        },
      },
      update: {},
      create: { actorProfileId: body.profileId, targetProfileId: body.targetProfileId, type: body.type },
    });
    reply.status(201).send(block);
  });

  app.delete("/blocks/:targetProfileId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { targetProfileId } = req.params as { targetProfileId: string };
    const q = removeBlockQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);

    await prisma.block
      .delete({
        where: { actorProfileId_targetProfileId_type: { actorProfileId: q.profileId, targetProfileId, type: q.type } },
      })
      .catch(() => {});
    reply.status(204).send();
  });

  app.get("/blocks/mine", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const q = listBlocksQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);
    const blocks = await prisma.block.findMany({ where: { actorProfileId: q.profileId, type: q.type } });

    const targetIds = blocks.map((b) => b.targetProfileId);
    const targets = targetIds.length
      ? await prisma.profile.findMany({ where: { id: { in: targetIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const targetById = new Map(targets.map((p) => [p.id, p]));

    return blocks.map((b) => ({ ...b, targetProfile: targetById.get(b.targetProfileId) ?? null }));
  });

  app.post("/reports", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createReportBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    const report = await prisma.report.create({
      data: {
        reporterProfileId: body.profileId,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
      },
    });
    reply.status(201).send(report);
  });
}
