import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { requireAdminSecret } from "../lib/adminAuth";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

// Matches Profile.categories' own per-tag cap (backend/src/routes/profiles.ts),
// since an approved suggestion is meant to become a category tag.
const suggestBody = z.object({ profileId: z.string(), text: z.string().min(1).max(30) });
const adminListQuery = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() });
const decideBody = z.object({ decision: z.enum(["approved", "rejected"]) });

// Lets any signed-in profile suggest a category/interest that isn't in the
// fixed list (mobile/src/lib/interests.ts) yet — reviewed by the admin
// inbox below, same bare-bones single-owner pattern as business
// verification (see requireAdminSecret).
export async function categorySuggestionRoutes(app: FastifyInstance) {
  app.post("/category-suggestions", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = suggestBody.parse(req.body);
    await assertOwnsProfile(userId, body.profileId);

    const suggestion = await prisma.categorySuggestion.create({
      data: { text: body.text.trim(), suggestedById: body.profileId },
    });
    reply.status(201).send(suggestion);
  });

  app.get("/admin/category-suggestions", { onRequest: [requireAdminSecret] }, async (req) => {
    const q = adminListQuery.parse(req.query);
    const suggestions = await prisma.categorySuggestion.findMany({
      where: q.status ? { status: q.status } : undefined,
      orderBy: { createdAt: "asc" },
    });

    const profileIds = [...new Set(suggestions.map((s) => s.suggestedById))];
    const profiles = profileIds.length
      ? await prisma.profile.findMany({ where: { id: { in: profileIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));

    return suggestions.map((s) => ({ ...s, suggestedBy: byId.get(s.suggestedById) ?? null }));
  });

  app.post("/admin/category-suggestions/:id/decide", { onRequest: [requireAdminSecret] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = decideBody.parse(req.body);

    const suggestion = await prisma.categorySuggestion.findUnique({ where: { id } });
    if (!suggestion) return reply.status(404).send({ error: "Not found" });
    if (suggestion.status !== "pending") {
      return reply.status(400).send({ error: "This suggestion has already been decided" });
    }

    const updated = await prisma.categorySuggestion.update({
      where: { id },
      data: { status: body.decision, decidedAt: new Date() },
    });
    reply.send(updated);
  });
}
