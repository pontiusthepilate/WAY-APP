// Admin-only triage queue for automated wallet-fraud flags (see
// lib/fraudDetection.ts). Gated by requireAdminSecret, same lazy
// curl/Postman-driven pattern routes/businessVerification.ts's admin
// routes already use — there's no admin role system yet, just this one
// shared-secret check.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireAdminSecret } from "../lib/adminAuth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const listQuery = z.object({
  status: z.enum(["pending", "reviewed", "dismissed"]).optional(),
});

const decideBody = z.object({
  status: z.enum(["reviewed", "dismissed"]),
});

export async function walletFraudFlagRoutes(app: FastifyInstance) {
  app.get("/admin/wallet-fraud-flags", { onRequest: [requireAdminSecret] }, async (req, reply) => {
    const q = listQuery.parse(req.query);
    const flags = await prisma.walletFraudFlag.findMany({
      where: q.status ? { status: q.status } : {},
      orderBy: { createdAt: "desc" },
    });

    const profileIds = [...new Set(flags.flatMap((f) => [f.profileId, f.counterpartyProfileId]))];
    const profiles = profileIds.length
      ? await prisma.profile.findMany({ where: { id: { in: profileIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    reply.send(
      flags.map((f) => ({
        ...f,
        profile: profileById.get(f.profileId) ?? null,
        counterparty: profileById.get(f.counterpartyProfileId) ?? null,
      }))
    );
  });

  app.post("/admin/wallet-fraud-flags/:id/decide", { onRequest: [requireAdminSecret] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = decideBody.parse(req.body);

    const flag = await prisma.walletFraudFlag.findUnique({ where: { id } });
    if (!flag) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.walletFraudFlag.update({ where: { id }, data: { status: body.status } });
    reply.send(updated);
  });
}
