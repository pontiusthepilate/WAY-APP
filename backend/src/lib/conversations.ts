import { prisma } from "./db";

// Every conversation-scoped route (messages, calls) first checks the given
// profileId is one of the conversation's two participants — shared here
// since it's now used by both features.
export async function assertParticipant(conversationId: string, profileId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.profileAId !== profileId && conversation.profileBId !== profileId)) {
    const err = new Error("Conversation not found");
    (err as any).statusCode = 404;
    throw err;
  }
  return conversation;
}
