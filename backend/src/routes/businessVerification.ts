import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma, BusinessVerificationRequest } from "@prisma/client";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { requireAdminSecret } from "../lib/adminAuth";
import { DOJAH_COMPANY_TYPES, isDojahConfigured, lookupCacViaDojah } from "../lib/dojah";
import { isCacScraperConfigured, lookupCacRegistration } from "../lib/cacLookup";
import { PROFILE_SUMMARY_SELECT } from "../lib/profileSummary";

const SLA_DAYS = 7;
const ESCALATE_AFTER_DAYS = 5;

const companyType = z.enum(DOJAH_COMPANY_TYPES);

const submitBody = z.object({
  profileId: z.string(),
  rcNumber: z.string().min(1),
  companyType,
  documentUrls: z.array(z.string().url()).min(1),
});
const mineQuery = z.object({ profileId: z.string() });
// Query strings are always strings — z.coerce.boolean() would treat
// "false" as truthy (Boolean("false") is true), so this maps the two
// literal values explicitly instead.
const queryBoolean = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));
const adminListQuery = z.object({
  status: z.enum(["pending", "verified", "rejected"]).optional(),
  // Lets an admin UI split the list into two tabs: first-time submissions
  // vs. a business trying again after a rejection, which warrants a
  // closer look.
  isResubmission: queryBoolean,
});
const decideBody = z
  .object({
    decision: z.enum(["verified", "rejected"]),
    rejectionReason: z.string().min(1).max(500).optional(),
  })
  .refine((b) => b.decision !== "rejected" || !!b.rejectionReason, {
    message: "rejectionReason is required when rejecting",
    path: ["rejectionReason"],
  });

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

// Adds the business-facing progress fields (and, for pending requests,
// whether it's past the day-5 reminder mark) to a raw row.
function withProgress(request: BusinessVerificationRequest) {
  const daysElapsed = daysBetween(request.submittedAt, new Date());
  return {
    ...request,
    daysElapsed: Math.round(daysElapsed * 10) / 10,
    daysRemaining: Math.max(0, Math.ceil(SLA_DAYS - daysElapsed)),
    slaDays: SLA_DAYS,
    isOverdue: request.status === "pending" && daysElapsed >= ESCALATE_AFTER_DAYS,
  };
}

// Dojah first (the real integration) — Apify's CAC scraper only as a
// fallback while Dojah's compliance review is pending, or if Dojah errors.
// Either way this only ever informs the admin's decision in /decide; it
// never sets status itself.
async function fetchCacLookup(
  rcNumber: string,
  type: (typeof DOJAH_COMPANY_TYPES)[number]
): Promise<{ source: "dojah" | "apify" | null; result: unknown }> {
  if (isDojahConfigured()) {
    try {
      return { source: "dojah", result: await lookupCacViaDojah(rcNumber, type) };
    } catch (err) {
      console.error("[WAY] Dojah lookup failed, falling back to Apify", err);
    }
  }
  if (isCacScraperConfigured()) {
    return { source: "apify", result: await lookupCacRegistration(rcNumber) };
  }
  return { source: null, result: null };
}

export async function businessVerificationRoutes(app: FastifyInstance) {
  app.post("/business-verification", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = submitBody.parse(req.body);
    const profile = await assertOwnsProfile(userId, body.profileId);
    if (profile.kind !== "business") {
      return reply.status(400).send({ error: "Only business profiles can submit verification" });
    }

    const pending = await prisma.businessVerificationRequest.findFirst({
      where: { profileId: body.profileId, status: "pending" },
    });
    if (pending) {
      return reply.status(409).send({ error: "A verification request is already pending for this profile" });
    }

    const priorRejectionCount = await prisma.businessVerificationRequest.count({
      where: { profileId: body.profileId, status: "rejected" },
    });
    const isResubmission = priorRejectionCount > 0;

    const { source, result } = await fetchCacLookup(body.rcNumber, body.companyType);

    const request = await prisma.businessVerificationRequest.create({
      data: {
        profileId: body.profileId,
        rcNumber: body.rcNumber,
        companyType: body.companyType,
        documentUrls: body.documentUrls,
        isResubmission,
        lookupSource: source,
        lookupResult: (result as Prisma.InputJsonValue | null) ?? undefined,
      },
    });

    if (isResubmission) {
      // No admin notification channel exists yet (no admin profile/role to
      // attach an in-app Notification to) — this is the same "admin
      // discovers it by checking" pattern as the day-5 escalation below,
      // just immediate since there's no time delay to wait out. The admin
      // list's isResubmission filter is what actually gets this the closer
      // look, not this log line on its own.
      console.warn(
        `[WAY][business-verification] RESUBMISSION: profile ${body.profileId} submitted request ${request.id} ` +
          `after ${priorRejectionCount} prior rejection(s) — review with extra care`
      );
    }

    reply.status(201).send(withProgress(request));
  });

  app.get("/business-verification/mine", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { profileId } = mineQuery.parse(req.query);
    await assertOwnsProfile(userId, profileId);

    const request = await prisma.businessVerificationRequest.findFirst({
      where: { profileId },
      orderBy: { submittedAt: "desc" },
    });
    if (!request) return reply.status(404).send({ error: "No verification request found" });
    reply.send(withProgress(request));
  });

  app.get("/admin/business-verification", { onRequest: [requireAdminSecret] }, async (req, reply) => {
    const q = adminListQuery.parse(req.query);
    const requests = await prisma.businessVerificationRequest.findMany({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(q.isResubmission !== undefined ? { isResubmission: q.isResubmission } : {}),
      },
      orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    });

    // Fire the day-5 admin reminder exactly once per request — logged here
    // rather than on a cron, consistent with this app's existing lazy
    // (no-scheduler) pattern for time-based state (see Status.expiresAt).
    const now = new Date();
    const toEscalate = requests.filter(
      (r) => r.status === "pending" && !r.escalatedAt && daysBetween(r.submittedAt, now) >= ESCALATE_AFTER_DAYS
    );
    if (toEscalate.length) {
      await prisma.$transaction(
        toEscalate.map((r) =>
          prisma.businessVerificationRequest.update({ where: { id: r.id }, data: { escalatedAt: now } })
        )
      );
      for (const r of toEscalate) {
        console.warn(
          `[WAY][business-verification] request ${r.id} (profile ${r.profileId}) has been pending ` +
            `${daysBetween(r.submittedAt, now).toFixed(1)} days — past the day-5 reminder threshold`
        );
        r.escalatedAt = now;
      }
    }

    const profileIds = requests.map((r) => r.profileId);
    const profiles = profileIds.length
      ? await prisma.profile.findMany({ where: { id: { in: profileIds } }, select: PROFILE_SUMMARY_SELECT })
      : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    reply.send(requests.map((r) => ({ ...withProgress(r), profile: profileById.get(r.profileId) ?? null })));
  });

  app.post("/admin/business-verification/:id/decide", { onRequest: [requireAdminSecret] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = decideBody.parse(req.body);

    const request = await prisma.businessVerificationRequest.findUnique({ where: { id } });
    if (!request) return reply.status(404).send({ error: "Not found" });
    if (request.status !== "pending") {
      return reply.status(400).send({ error: "This request has already been decided" });
    }

    const updated = await prisma.businessVerificationRequest.update({
      where: { id },
      data: {
        status: body.decision,
        decidedAt: new Date(),
        rejectionReason: body.decision === "rejected" ? body.rejectionReason : null,
      },
    });

    if (body.decision === "verified") {
      await prisma.profile.update({ where: { id: request.profileId }, data: { isVerified: true } });
    }

    reply.send(withProgress(updated));
  });
}
