import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";

const registerBody = z.object({
  profileId: z.string(),
  token: z.string().min(1),
  type: z.enum(["expo", "voip"]).default("expo"),
});

export async function pushRoutes(app: FastifyInstance) {
  app.post("/push/register", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = registerBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    await prisma.pushToken.upsert({
      where: { profileId_token_type: { profileId: body.profileId, token: body.token, type: body.type } },
      create: { profileId: body.profileId, token: body.token, type: body.type },
      update: {},
    });
    reply.status(201).send({ registered: true });
  });

  app.post("/push/unregister", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = registerBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    await prisma.pushToken
      .delete({ where: { profileId_token_type: { profileId: body.profileId, token: body.token, type: body.type } } })
      .catch(() => {});
    reply.send({ registered: false });
  });
}
