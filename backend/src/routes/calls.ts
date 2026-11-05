import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { assertParticipant } from "../lib/conversations";
import { isBlockedEitherWay } from "../lib/blocking";
import { createRoomToken, isLiveKitConfigured } from "../lib/livekit";
import { notifyIncomingCall } from "../lib/callNotify";

const startCallBody = z.object({
  profileId: z.string(),
  conversationId: z.string(),
  type: z.enum(["voice", "video"]),
});
const profileIdBody = z.object({ profileId: z.string() });

function otherParticipant(conversation: { profileAId: string; profileBId: string }, profileId: string) {
  return conversation.profileAId === profileId ? conversation.profileBId : conversation.profileAId;
}

export async function callRoutes(app: FastifyInstance) {
  app.post("/calls", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = startCallBody.parse(req.body);
    const caller = await assertOwnsProfile(userId, body.profileId);
    const conversation = await assertParticipant(body.conversationId, body.profileId);
    const calleeProfileId = otherParticipant(conversation, body.profileId);

    if (await isBlockedEitherWay(body.profileId, calleeProfileId)) {
      return reply.status(403).send({ error: "You can't call this profile" });
    }

    const call = await prisma.call.create({
      data: {
        conversationId: body.conversationId,
        callerProfileId: body.profileId,
        calleeProfileId,
        type: body.type,
        roomName: `call-${randomUUID()}`,
      },
    });

    await notifyIncomingCall(calleeProfileId, call, caller.displayName);

    const token = isLiveKitConfigured() ? await createRoomToken(call.roomName, body.profileId) : null;
    reply.status(201).send({ call, token, liveKitConfigured: isLiveKitConfigured() });
  });

  app.get("/calls/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = profileIdBody.parse(req.query);
    await assertOwnsProfile(userId, profileId);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call || (call.callerProfileId !== profileId && call.calleeProfileId !== profileId)) {
      return reply.status(404).send({ error: "Not found" });
    }
    reply.send(call);
  });

  app.post("/calls/:id/accept", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = profileIdBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call || call.calleeProfileId !== profileId) return reply.status(404).send({ error: "Not found" });
    if (call.status !== "ringing") return reply.status(400).send({ error: "This call is no longer ringing" });

    const updated = await prisma.call.update({ where: { id }, data: { status: "accepted", answeredAt: new Date() } });
    const token = isLiveKitConfigured() ? await createRoomToken(call.roomName, profileId) : null;
    reply.send({ call: updated, token, liveKitConfigured: isLiveKitConfigured() });
  });

  app.post("/calls/:id/decline", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = profileIdBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call || call.calleeProfileId !== profileId) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.call.update({ where: { id }, data: { status: "declined", endedAt: new Date() } });
    reply.send(updated);
  });

  app.post("/calls/:id/end", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const { profileId } = profileIdBody.parse(req.body);
    await assertOwnsProfile(userId, profileId);

    const call = await prisma.call.findUnique({ where: { id } });
    if (!call || (call.callerProfileId !== profileId && call.calleeProfileId !== profileId)) {
      return reply.status(404).send({ error: "Not found" });
    }
    // An unanswered call that ends was missed, not "ended" — matters for
    // how the callee's call log should read it later.
    const status = call.status === "ringing" ? "missed" : "ended";
    const updated = await prisma.call.update({ where: { id }, data: { status, endedAt: new Date() } });
    reply.send(updated);
  });
}
