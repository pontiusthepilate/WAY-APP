import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { isBlockedEitherWay } from "../lib/blocking";
import { assertParticipant } from "../lib/conversations";
import { notifyProfiles } from "../lib/expoPush";

const startConversationBody = z.object({ profileId: z.string(), withProfileId: z.string() });
const listQuery = z.object({ profileId: z.string() });
const messagesQuery = z.object({
  profileId: z.string(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});
const sendMessageBody = z
  .object({
    profileId: z.string(),
    text: z.string().min(1).max(2000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["image", "video"]).optional(),
  })
  .refine((b) => b.text || b.mediaUrl, { message: "A message needs text or media" });

// Canonical (profileAId, profileBId) ordering — lower id first — so a
// conversation between the same two profiles is never created twice under
// swapped ids.
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function messageRoutes(app: FastifyInstance) {
  app.post("/conversations", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = startConversationBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId === body.withProfileId) {
      return reply.status(400).send({ error: "Can't start a conversation with yourself" });
    }
    // Blocking is safety-critical and always re-checked, unlike the privacy
    // check below which only applies to a brand-new conversation.
    if (await isBlockedEitherWay(body.profileId, body.withProfileId)) {
      return reply.status(403).send({ error: "You can't message this profile" });
    }

    const [profileAId, profileBId] = canonicalPair(body.profileId, body.withProfileId);
    const existing = await prisma.conversation.findUnique({
      where: { profileAId_profileBId: { profileAId, profileBId } },
    });
    if (existing) return reply.status(201).send(existing);

    // Only a brand-new thread is gated by the target's messagePrivacy — an
    // existing conversation is never retroactively locked out by a later
    // privacy change.
    const target = await prisma.profile.findUnique({ where: { id: body.withProfileId } });
    if (!target) return reply.status(404).send({ error: "Not found" });
    if (target.messagePrivacy === "no_one") {
      return reply.status(403).send({ error: "This profile isn't accepting new messages" });
    }
    if (target.messagePrivacy === "following") {
      // Does the TARGET already follow the SENDER back? i.e. the target
      // chose to only hear from people they themselves follow.
      const targetFollowsSender = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: target.id, followingId: body.profileId } },
      });
      if (!targetFollowsSender) {
        return reply.status(403).send({ error: "This profile only accepts messages from people they follow" });
      }
    }

    const conversation = await prisma.conversation.create({ data: { profileAId, profileBId } });
    reply.status(201).send(conversation);
  });

  app.get("/conversations", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { profileId } = listQuery.parse(req.query);
    await assertOwnsProfile(userId, profileId);

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
      orderBy: { lastMessageAt: "desc" },
    });

    const otherIds = conversations.map((c) => (c.profileAId === profileId ? c.profileBId : c.profileAId));
    const profiles = otherIds.length
      ? await prisma.profile.findMany({ where: { id: { in: otherIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const lastMessages = conversations.length
      ? await prisma.$transaction(
          conversations.map((c) =>
            prisma.directMessage.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" } })
          )
        )
      : [];
    const lastMessageByConversation = new Map(conversations.map((c, i) => [c.id, lastMessages[i]]));

    return conversations.map((c) => ({
      ...c,
      otherProfile: profileById.get(c.profileAId === profileId ? c.profileBId : c.profileAId) ?? null,
      lastMessage: lastMessageByConversation.get(c.id) ?? null,
    }));
  });

  app.get("/conversations/:id/messages", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const q = messagesQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);
    await assertParticipant(id, q.profileId);

    const messages = await prisma.directMessage.findMany({
      where: { conversationId: id },
      take: q.limit,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });
    return {
      // Reversed to chronological order for the thread view — fetched
      // newest-first so cursor pagination can page further into the past.
      messages: messages.slice().reverse(),
      nextCursor: messages.length === q.limit ? messages[messages.length - 1].id : null,
    };
  });

  app.post("/conversations/:id/messages", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = sendMessageBody.parse(req.body);
    const sender = await assertOwnsProfile(userId, body.profileId);
    const conversation = await assertParticipant(id, body.profileId);

    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId: id,
          senderProfileId: body.profileId,
          text: body.text,
          mediaUrl: body.mediaUrl,
          mediaType: body.mediaType,
        },
      }),
      prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } }),
    ]);

    const otherId = conversation.profileAId === body.profileId ? conversation.profileBId : conversation.profileAId;
    const other = await prisma.profile.findUnique({ where: { id: otherId }, select: { notifyMessages: true } });
    if (other?.notifyMessages) {
      await notifyProfiles([otherId], sender.displayName, body.text ?? "Sent a photo", { conversationId: id });
    }

    reply.status(201).send(message);
  });
}
