import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { notifyProfiles } from "../lib/expoPush";

const createRequestBody = z.object({
  fromProfileId: z.string(),
  toWayId: z.string(),
  message: z.string().max(280).optional(),
});
const respondBody = z.object({ profileId: z.string() });
const endBody = z.object({ profileId: z.string() });

async function withRequester<T extends { fromProfileId: string; toProfileId: string }>(row: T) {
  const [from, to] = await Promise.all([
    prisma.profile.findUnique({ where: { id: row.fromProfileId }, select: PROFILE_SUMMARY_SELECT }),
    prisma.profile.findUnique({ where: { id: row.toProfileId }, select: PROFILE_SUMMARY_SELECT }),
  ]);
  return { ...row, fromProfile: from, toProfile: to };
}

export async function remoteCameraRoutes(app: FastifyInstance) {
  // Asks another profile to remotely activate their camera/mic (feature 16).
  // Nothing is granted here — this just creates a pending ask and notifies them.
  app.post("/remote-camera/requests", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createRequestBody.parse(req.body);
    const requester = await assertOwnsProfile(userId, body.fromProfileId);

    const target = await prisma.profile.findUnique({ where: { wayId: body.toWayId } });
    if (!target) return reply.status(404).send({ error: "That WAY doesn't exist" });
    if (target.id === requester.id) return reply.status(400).send({ error: "You can't request your own camera" });

    const request = await prisma.remoteCameraRequest.create({
      data: { fromProfileId: requester.id, toProfileId: target.id, message: body.message },
    });

    await notifyProfiles(
      [target.id],
      `${requester.displayName} wants to see your camera`,
      body.message ?? "Tap to review the request",
      { remoteCameraRequestId: request.id }
    );

    reply.status(201).send(await withRequester(request));
  });

  app.get("/remote-camera/requests/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const request = await prisma.remoteCameraRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    // Only the requester and the camera owner may see this — the message
    // and both identities aren't public.
    const profile = await prisma.profile.findFirst({
      where: { userId, id: { in: [request.fromProfileId, request.toProfileId] } },
    });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    reply.send(await withRequester(request));
  });

  // Private inboxes — who asked to see MY camera, and who I've asked.
  app.get("/remote-camera/requests/incoming/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.remoteCameraRequest.findMany({
      where: { toProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withRequester));
  });

  app.get("/remote-camera/requests/outgoing/:profileId", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = req.params as { profileId: string };
    await assertOwnsProfile(userId, profileId);
    const requests = await prisma.remoteCameraRequest.findMany({
      where: { fromProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(requests.map(withRequester));
  });

  // Accepting is the one moment real consent is given — it's the only thing
  // that creates a session, and only the camera owner can call it.
  app.post("/remote-camera/requests/:id/accept", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = respondBody.parse(req.body);
    const request = await prisma.remoteCameraRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const [, session] = await prisma.$transaction([
      prisma.remoteCameraRequest.update({ where: { id }, data: { status: "accepted", respondedAt: new Date() } }),
      prisma.remoteCameraSession.create({
        data: { requestId: id, granterId: request.toProfileId, requesterId: request.fromProfileId },
      }),
    ]);

    await notifyProfiles([request.fromProfileId], "Camera access granted", "Tap to view the stream", {
      remoteCameraSessionId: session.id,
    });

    reply.status(201).send(session);
  });

  app.post("/remote-camera/requests/:id/decline", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = respondBody.parse(req.body);
    const request = await prisma.remoteCameraRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== request.toProfileId) return reply.status(403).send({ error: "This request isn't addressed to you" });
    if (request.status !== "pending") return reply.status(400).send({ error: "This request was already answered" });

    const updated = await prisma.remoteCameraRequest.update({
      where: { id },
      data: { status: "declined", respondedAt: new Date() },
    });
    reply.send(await withRequester(updated));
  });

  app.get("/remote-camera/sessions/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const session = await prisma.remoteCameraSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    // Only the two parties involved may view this session.
    const profile = await prisma.profile.findFirst({
      where: { userId, id: { in: [session.granterId, session.requesterId] } },
    });
    if (!profile) return reply.status(404).send({ error: "Not found" });

    const [granter, requester] = await Promise.all([
      prisma.profile.findUnique({ where: { id: session.granterId }, select: PROFILE_SUMMARY_SELECT }),
      prisma.profile.findUnique({ where: { id: session.requesterId }, select: PROFILE_SUMMARY_SELECT }),
    ]);
    reply.send({ ...session, granter, requester });
  });

  // Either party can end it — the camera owner isn't stuck broadcasting,
  // and the viewer isn't stuck waiting on someone who walked away.
  app.post("/remote-camera/sessions/:id/end", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = endBody.parse(req.body);
    const session = await prisma.remoteCameraSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId !== session.granterId && body.profileId !== session.requesterId) {
      return reply.status(403).send({ error: "You're not part of this session" });
    }

    const updated = await prisma.remoteCameraSession.update({
      where: { id },
      data: { status: "ended", endedAt: new Date() },
    });
    reply.send(updated);
  });
}
