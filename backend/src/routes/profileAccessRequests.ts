import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { notifyProfiles } from "../lib/expoPush";
import { isBlockedEitherWay, isAccessRequestBlocked } from "../lib/blocking";

// Distinct from WayRequest ("Connect") — this is the escalation a viewer
// sends when the mini-profile/restricted view isn't enough and they want
// the owner to grant them full profile access directly (see
// lib/profileAccess.ts). Structured identically to wayRequests.ts.
const createRequestBody = z.object({
  fromProfileId: z.string(),
  toWayId: z.string(),
  message: z.string().max(200).optional(),
});
const respondBody = z.object({ profileId: z.string() });
const declineBody = z.object({ profileId: z.string(), block: z.boolean().optional() });

async function withSender<T extends { fromProfileId: string; toProfileId: string }>(row: T) {
  const [from, to] = await Promise.all([
    prisma.profile.findUnique({ where: { id: row.fromProfileId }, select: PROFILE_SUMMARY_SELECT }),
    prisma.profile.findUnique({ where: { id: row.toProfileId }, select: PROFILE_SUMMARY_SELECT }),
  ]);
  return { ...row, fromProfile: from, toProfile: to };
}

export async function profileAccessRequestRoutes(app: FastifyInstance) {
  app.post("/profile-access-requests", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createRequestBody.parse(req.body);
    const fromProfile = await assertOwnsProfile(userId, body.fromProfileId);

    const toProfile = await prisma.profile.findUnique({ where: { wayId: body.toWayId } });
    if (!toProfile) {
      return reply.status(404).send({ error: "That WAY doesn't exist" });
    }
    if (toProfile.id === fromProfile.id) {
      return reply.status(400).send({ error: "You can't request access to your own profile" });
    }
    if (await isBlockedEitherWay(fromProfile.id, toProfile.id)) {
      return reply.status(403).send({ error: "You can't request access to this profile" });
    }
    if (await isAccessRequestBlocked(toProfile.id, fromProfile.id)) {
      return reply.status(403).send({ error: "You can't request access to this profile" });
    }

    const created = await prisma.profileAccessRequest.create({
      data: { fromProfileId: fromProfile.id, toProfileId: toProfile.id, message: body.message },
    });

    if (toProfile.notifyProfileAccessRequests) {
      await notifyProfiles(
        [toProfile.id],
        `${fromProfile.displayName} requested access to your full profile`,
        body.message ?? "Tap to review",
        { profileAccessRequestId: created.id }
      );
      await prisma.notification.create({
        data: {
          profileId: toProfile.id,
          type: "profile_access_request",
          actorProfileId: fromProfile.id,
          profileAccessRequestId: created.id,
        },
      });
    }

    reply.status(201).send(await withSender(created));
  });

  app.get("/profile-access-requests/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const request = await prisma.profileAccessRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    const profile = await prisma.profile.findFirst({
      where: { userId, id: { in: [request.fromProfileId, request.toProfileId] } },
    });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    reply.send(await withSender(request));
  });

  app.get("/profile-access-requests/incoming/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.profileAccessRequest.findMany({
      where: { toProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withSender));
  });

  app.get("/profile-access-requests/outgoing/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.profileAccessRequest.findMany({
      where: { fromProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withSender));
  });

  app.post("/profile-access-requests/:id/accept", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = respondBody.parse(req.body);
    const request = await prisma.profileAccessRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const updated = await prisma.profileAccessRequest.update({
      where: { id },
      data: { status: "accepted", respondedAt: new Date() },
    });

    await notifyProfiles([request.fromProfileId], "Profile access granted", "They accepted your request for full profile access", {
      profileAccessRequestId: updated.id,
    });
    await prisma.notification.create({
      data: {
        profileId: request.fromProfileId,
        type: "profile_access_response",
        actorProfileId: request.toProfileId,
        profileAccessRequestId: updated.id,
      },
    });

    reply.send(await withSender(updated));
  });

  // Declining may optionally also block the requester from sending another
  // ProfileAccessRequest (a narrow, one-directional Block, see
  // lib/blocking.ts's isAccessRequestBlocked) — never revealed in the
  // notification copy either way, just a plain "responded" message.
  app.post("/profile-access-requests/:id/decline", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = declineBody.parse(req.body);
    const request = await prisma.profileAccessRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const updated = await prisma.profileAccessRequest.update({
      where: { id },
      data: { status: "declined", respondedAt: new Date() },
    });

    if (body.block) {
      await prisma.block.upsert({
        where: {
          actorProfileId_targetProfileId_type: {
            actorProfileId: request.toProfileId,
            targetProfileId: request.fromProfileId,
            type: "access_request",
          },
        },
        update: {},
        create: { actorProfileId: request.toProfileId, targetProfileId: request.fromProfileId, type: "access_request" },
      });
    }

    await notifyProfiles([request.fromProfileId], "Profile access request", "They responded to your request for full profile access", {
      profileAccessRequestId: updated.id,
    });
    await prisma.notification.create({
      data: {
        profileId: request.fromProfileId,
        type: "profile_access_response",
        actorProfileId: request.toProfileId,
        profileAccessRequestId: updated.id,
      },
    });

    reply.send(await withSender(updated));
  });
}
