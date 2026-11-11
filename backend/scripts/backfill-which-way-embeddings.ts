// One-off, idempotent: embeds Profile.whichWay for every profile that has
// one set but no whichWayEmbedding yet (new signups/edits get embedded
// live via routes/profiles.ts — this just closes the gap for anyone
// whose whichWay was saved before VOYAGE_API_KEY existed, or whose
// live embed call failed at the time). Safe to re-run anywhere.
//
// Run with: npx tsx scripts/backfill-which-way-embeddings.ts
import { prisma } from "../src/lib/db";
import { embedTexts, isVoyageConfigured } from "../src/lib/voyage";

const BATCH_SIZE = 100;

async function main() {
  if (!isVoyageConfigured()) {
    console.error("[backfill-embeddings] VOYAGE_API_KEY not set — nothing to do");
    process.exitCode = 1;
    return;
  }

  const candidates = await prisma.profile.findMany({
    where: { whichWay: { not: null }, whichWayEmbedding: { equals: [] } },
    select: { id: true, whichWay: true },
  });
  console.log(`[backfill-embeddings] ${candidates.length} profile(s) to embed`);

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTexts(
      batch.map((p) => p.whichWay!),
      "document"
    );
    for (let j = 0; j < batch.length; j++) {
      const embedding = embeddings[j];
      if (!embedding) {
        console.warn(`[backfill-embeddings] failed to embed profile ${batch[j].id} — left for a later run`);
        failed++;
        continue;
      }
      await prisma.profile.update({ where: { id: batch[j].id }, data: { whichWayEmbedding: embedding } });
      embedded++;
    }
  }
  console.log(`[backfill-embeddings] done — embedded ${embedded}, failed ${failed}`);
}

main()
  .catch((err) => {
    console.error("[backfill-embeddings] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
