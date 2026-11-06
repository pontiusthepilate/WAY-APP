import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser } from "../lib/auth";
import { verifyAndConsumeOtp } from "../lib/otp";

// Deliberately narrower than auth.ts's either-or identifierSchema — each
// endpoint below only accepts the shape it's actually changing, so a caller
// can't silently save an email into `phone` or vice versa.
const phoneBody = z.object({
  identifier: z.string().regex(/^\+?[0-9]{7,15}$/, "Must be a valid phone number (E.164, e.g. +15551234567)"),
  code: z.string().length(6),
});
const emailBody = z.object({
  identifier: z.string().email(),
  code: z.string().length(6),
});

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, phone: true, email: true, createdAt: true },
    });
    return user;
  });

  app.post("/users/me/change-phone", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { identifier, code } = phoneBody.parse(req.body);
    const verified = await verifyAndConsumeOtp(identifier, code);
    if (!verified) return reply.status(400).send({ error: "Invalid or expired code" });

    const existing = await prisma.user.findFirst({ where: { phone: identifier, id: { not: userId } } });
    if (existing) return reply.status(409).send({ error: "That phone number is already in use" });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { phone: identifier },
      select: { id: true, phone: true, email: true, createdAt: true },
    });
    reply.send(user);
  });

  app.post("/users/me/change-email", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { identifier, code } = emailBody.parse(req.body);
    const verified = await verifyAndConsumeOtp(identifier, code);
    if (!verified) return reply.status(400).send({ error: "Invalid or expired code" });

    const existing = await prisma.user.findFirst({ where: { email: identifier, id: { not: userId } } });
    if (existing) return reply.status(409).send({ error: "That email is already in use" });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { email: identifier },
      select: { id: true, phone: true, email: true, createdAt: true },
    });
    reply.send(user);
  });

  // Deactivation, not a hard delete — see the plan notes for why a full
  // cascading purge isn't attempted here. Marks the account unable to log
  // back in and hides every one of the user's profiles from search.
  app.delete("/users/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
      prisma.profile.updateMany({
        where: { userId },
        data: { isVisible: false, visibleToNearby: false, visibleToAddress: false, visibleToLocation: false },
      }),
    ]);
    reply.status(204).send();
  });
}
