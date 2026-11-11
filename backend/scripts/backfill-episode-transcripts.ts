// One-off, idempotent: transcribes every episode created before this
// feature shipped (transcriptStatus still "none"). Safe to re-run — any
// episode already "pending"/"ready"/"failed" is left alone.
//
// Run with: npx tsx scripts/backfill-episode-transcripts.ts
import { prisma } from "../src/lib/db";
import { isTranscriptionConfigured } from "../src/lib/transcription";
import { processEpisodeTranscription } from "../src/routes/episodes";

async function main() {
  if (!isTranscriptionConfigured()) {
    console.error("[backfill-transcripts] DEEPGRAM_API_KEY not set — nothing to do");
    process.exitCode = 1;
    return;
  }

  const episodes = await prisma.episode.findMany({
    where: { transcriptStatus: "none" },
    select: { id: true, mediaUrl: true },
  });
  console.log(`[backfill-transcripts] ${episodes.length} episode(s) to transcribe`);

  await prisma.episode.updateMany({
    where: { id: { in: episodes.map((e) => e.id) } },
    data: { transcriptStatus: "pending" },
  });

  let done = 0;
  for (const episode of episodes) {
    await processEpisodeTranscription(episode.id, episode.mediaUrl);
    done++;
    console.log(`[backfill-transcripts] processed ${done}/${episodes.length} (${episode.id})`);
  }
  console.log(`[backfill-transcripts] done`);
}

main()
  .catch((err) => {
    console.error("[backfill-transcripts] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
