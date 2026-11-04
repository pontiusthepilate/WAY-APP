import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { notifyProfiles } from "../lib/expoPush";
import { isBlockedEitherWay } from "../lib/blocking";

const createRequestBody = z.object({
  fromProfileId: z.string(),
  toWayId: z.string(),
  text: z.string().max(500).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});
const respondBody = z.object({ profileId: z.string() });

async function withSender<T extends { fromProfileId: string; toProfileId: string }>(row: T) {
  const [from, to] = await Promise.all([
    prisma.profile.findUnique({ where: { id: row.fromProfileId }, select: PROFILE_SUMMARY_SELECT }),
    prisma.profile.findUnique({ where: { id: row.toProfileId }, select: PROFILE_SUMMARY_SELECT }),
  ]);
  return { ...row, fromProfile: from, toProfile: to };
}

export async function wayRequestRoutes(app: FastifyInstance) {
  app.post("/way-requests", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createRequestBody.parse(req.body);
    const fromProfile = await assertOwnsProfile(userId, body.fromProfileId);

    const toProfile = await prisma.profile.findUnique({ where: { wayId: body.toWayId } });
    if (!toProfile) {
      return reply.status(404).send({ error: "That WAY doesn't exist" });
    }
    if (toProfile.id === fromProfile.id) {
      return reply.status(400).send({ error: "You can't send a WAY request to yourself" });
    }
    if (await isBlockedEitherWay(fromProfile.id, toProfile.id)) {
      return reply.status(403).send({ error: "You can't send a WAY request to this profile" });
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

    await notifyProfiles(
      [toProfile.id],
      `${fromProfile.displayName} sent you a WAY request`,
      body.text ?? "Tap to review",
      { wayRequestId: created.id }
    );
    await prisma.notification.create({ data: { profileId: toProfile.id, type: "way_request", actorProfileId: fromProfile.id } });

    reply.status(201).send(await withSender(created));
  });

  app.get("/way-requests/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const request = await prisma.wayRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    // Only the sender and the recipient may see this request.
    const profile = await prisma.profile.findFirst({
      where: { userId, id: { in: [request.fromProfileId, request.toProfileId] } },
    });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    reply.send(await withSender(request));
  });

  // Private inboxes — who's sent ME a WAY request, and who I've sent one to.
  app.get("/way-requests/incoming/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.wayRequest.findMany({
      where: { toProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withSender));
  });

  app.get("/way-requests/outgoing/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.wayRequest.findMany({
      where: { fromProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withSender));
  });

  app.post("/way-requests/:id/accept", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = respondBody.parse(req.body);
    const request = await prisma.wayRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const updated = await prisma.wayRequest.update({
      where: { id },
      data: { status: "accepted", respondedAt: new Date() },
    });

    await notifyProfiles([request.fromProfileId], "WAY request accepted", "They accepted your WAY request", {
      wayRequestId: updated.id,
    });

    reply.send(await withSender(updated));
  });

  app.post("/way-requests/:id/decline", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = respondBody.parse(req.body);
    const request = await prisma.wayRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const updated = await prisma.wayRequest.update({
      where: { id },
      data: { status: "declined", respondedAt: new Date() },
    });
    reply.send(await withSender(updated));
  });
}
