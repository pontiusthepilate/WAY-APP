import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";
import { isBlockedEitherWay } from "../lib/blocking";

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

// Every route below first checks the given profileId is one of the
// conversation's two participants — there's no existing analog for this in
// the codebase (live chat has no concept of a private audience), so this is
// the one check specific to this feature rather than a shared helper.
async function assertParticipant(conversationId: string, profileId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.profileAId !== profileId && conversation.profileBId !== profileId)) {
    const err = new Error("Conversation not found");
    (err as any).statusCode = 404;
    throw err;
  }
  return conversation;
}

export async function messageRoutes(app: FastifyInstance) {
  app.post("/conversations", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = startConversationBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);
    if (body.profileId === body.withProfileId) {
      return reply.status(400).send({ error: "Can't start a conversation with yourself" });
    }
    if (await isBlockedEitherWay(body.profileId, body.withProfileId)) {
      return reply.status(403).send({ error: "You can't message this profile" });
    }

    const [profileAId, profileBId] = canonicalPair(body.profileId, body.withProfileId);
    const conversation = await prisma.conversation.upsert({
      where: { profileAId_profileBId: { profileAId, profileBId } },
      update: {},
      create: { profileAId, profileBId },
    });
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
    await assertOwnsProfile(userId, body.profileId);
    await assertParticipant(id, body.profileId);

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
    reply.status(201).send(message);
  });
}
