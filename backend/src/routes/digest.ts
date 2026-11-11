import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db";
import { requireAdminSecret } from "../lib/adminAuth";
import { buildDigest, formatDigestMessage } from "../lib/digest";
import { notifyProfiles } from "../lib/expoPush";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Triggered weekly by .github/workflows/weekly-digest.yml (a scheduler
// outside this process, since nothing in this codebase runs on a timer —
// see lib/digest.ts for why). Each profile's own lastDigestSentAt is
// claimed with a conditional update before it's processed, so a second
// overlapping trigger (a manual re-run landing next to the scheduled one)
// can't double-send: the loser's updateMany affects 0 rows and it skips.
export async function digestRoutes(app: FastifyInstance) {
  app.post("/admin/send-digests", { onRequest: [requireAdminSecret] }, async (_req, reply) => {
    const candidates = await prisma.profile.findMany({
      where: { notifyDigest: true, isDefault: false, pushTokens: { some: {} } },
      select: { id: true, lastDigestSentAt: true },
    });

    let digestsSent = 0;
    const now = new Date();

    for (const candidate of candidates) {
      const claim = await prisma.profile.updateMany({
        where: { id: candidate.id, lastDigestSentAt: candidate.lastDigestSentAt },
        data: { lastDigestSentAt: now },
      });
      if (claim.count !== 1) continue; // lost the race to another caller

      const windowStart = candidate.lastDigestSentAt ?? new Date(now.getTime() - SEVEN_DAYS_MS);
      const counts = await buildDigest(candidate.id, windowStart);
      if (!counts) continue;

      const { title, body } = formatDigestMessage(counts);
      await notifyProfiles([candidate.id], title, body, { type: "digest" });
      digestsSent++;
    }

    reply.send({ profilesChecked: candidates.length, digestsSent });
  });
}
