import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { askAssistant, HISTORY_LIMIT, type SupportHistoryTurn } from "../lib/supportAssistant";

const FALLBACK_REPLY =
  "Sorry, I'm having trouble answering right now — you can reach us directly at support@wwwaaayyy.com.";

const sendBody = z.object({ profileId: z.string(), text: z.string().min(1).max(1000) });
const messagesQuery = z.object({ profileId: z.string() });

export async function supportAssistantRoutes(app: FastifyInstance) {
  // Always 200 with a reply string, even on failure — there's no
  // user-facing error shape for this route by design, so the chat
  // screen never shows a broken state (see lib/supportAssistant.ts).
  app.post("/support/message", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = sendBody.parse(req.body);
    const profile = await assertOwnsProfile(userId, body.profileId);

    const conversation = await prisma.supportConversation.upsert({
      where: { profileId: body.profileId },
      create: { profileId: body.profileId },
      update: {},
    });

    await prisma.supportMessage.create({
      data: { conversationId: conversation.id, role: "user", text: body.text },
    });

    const historyRows = await prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    const history: SupportHistoryTurn[] = historyRows
      .slice()
      .reverse()
      .slice(0, -1) // drop the just-saved user message — passed separately below
      .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

    const replyText = (await askAssistant(profile, history, body.text)) ?? FALLBACK_REPLY;

    await prisma.supportMessage.create({
      data: { conversationId: conversation.id, role: "assistant", text: replyText },
    });
    await prisma.supportConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    reply.send({ reply: replyText });
  });

  app.get("/support/messages", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const q = messagesQuery.parse(req.query);
    await assertOwnsProfile(userId, q.profileId);

    const conversation = await prisma.supportConversation.findUnique({ where: { profileId: q.profileId } });
    if (!conversation) return [];

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return messages;
  });
}
