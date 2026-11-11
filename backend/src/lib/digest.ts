import { prisma } from "./db";

// Batches the three notification types that never push on their own
// (like/comment/follow — see routes/digest.ts) into one weekly count.
// Deliberately not an LLM call: this is arithmetic over rows already in
// the Notification table, not generation, same reasoning as
// recommendations.ts/fraudDetection.ts.
export interface DigestCounts {
  likes: number;
  comments: number;
  follows: number;
}

export async function buildDigest(profileId: string, windowStart: Date): Promise<DigestCounts | null> {
  const grouped = await prisma.notification.groupBy({
    by: ["type"],
    where: {
      profileId,
      type: { in: ["like", "comment", "follow"] },
      createdAt: { gte: windowStart },
    },
    _count: { type: true },
  });

  const counts: DigestCounts = { likes: 0, comments: 0, follows: 0 };
  for (const row of grouped) {
    if (row.type === "like") counts.likes = row._count.type;
    else if (row.type === "comment") counts.comments = row._count.type;
    else if (row.type === "follow") counts.follows = row._count.type;
  }

  if (counts.likes === 0 && counts.comments === 0 && counts.follows === 0) return null;
  return counts;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDigestMessage(counts: DigestCounts): { title: string; body: string } {
  const clauses: string[] = [];
  if (counts.likes > 0) clauses.push(pluralize(counts.likes, "like"));
  if (counts.comments > 0) clauses.push(pluralize(counts.comments, "comment"));
  if (counts.follows > 0) clauses.push(pluralize(counts.follows, "new follower"));

  const body =
    clauses.length === 1
      ? clauses[0]
      : clauses.length === 2
        ? `${clauses[0]} and ${clauses[1]}`
        : `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;

  return { title: "This week on WAY", body };
}
