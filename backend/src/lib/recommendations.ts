// "People you may want to connect with" — a pure ranking problem over
// signals this app already computes, not a generation/classification
// task, so this deliberately does NOT call an LLM: reaching for Claude
// per recommendation list would add cost/latency for no real benefit.
// Reuses whichWayEmbedding (lib/voyage.ts's cosineSimilarity), shared
// Profile.categories, the WayRequest graph (mutual connections), and
// simple geographic proximity. Computed live per request — no cache
// table, no background job; revisit if the candidate pool ever grows
// enough for that to matter (same scale posture as geo.ts's semantic
// search candidate cap).
import { prisma } from "./db";
import { cosineSimilarity } from "./voyage";
import { getSuppressedProfileIds } from "./blocking";

// Pragmatic bound on how many visible profiles get scored per request —
// mirrors geo.ts's SEMANTIC_CANDIDATE_CAP. Fine at this app's current
// scale; revisit (e.g. pgvector, a precomputed candidate index) if
// profile counts ever grow enough for this to start clipping real
// matches.
const CANDIDATE_POOL_CAP = 500;
const RESULT_LIMIT_DEFAULT = 10;

// Signal weights — tune here. Sum to 1 so the combined score stays in a
// comparable 0–1-ish range across requests.
const WEIGHT_CATEGORY = 0.3;
const WEIGHT_SEMANTIC = 0.3;
const WEIGHT_MUTUAL = 0.25;
const WEIGHT_PROXIMITY = 0.15;

const CATEGORY_CAP = 5; // shared categories beyond this don't add more score
const MUTUAL_CAP = 5; // mutual connections beyond this don't add more score
const PROXIMITY_DECAY_KM = 5; // distance at which the proximity signal has roughly halved

export interface ConnectRecommendation {
  profile: {
    id: string;
    wayId: string;
    displayName: string;
    displayPictureUrl: string | null;
    isVerified: boolean;
    kind: string;
  };
  reason: string;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function getConnectRecommendations(
  profileId: string,
  limit = RESULT_LIMIT_DEFAULT
): Promise<ConnectRecommendation[]> {
  const viewer = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!viewer) return [];

  const [suppressed, existingRequests] = await Promise.all([
    getSuppressedProfileIds(profileId, { includeMuted: false }),
    prisma.wayRequest.findMany({
      where: { OR: [{ fromProfileId: profileId }, { toProfileId: profileId }] },
      select: { fromProfileId: true, toProfileId: true },
    }),
  ]);
  const alreadyConnected = new Set(
    existingRequests.map((r) => (r.fromProfileId === profileId ? r.toProfileId : r.fromProfileId))
  );
  const excludeIds = [profileId, ...suppressed, ...alreadyConnected];

  // Mutual-connections signal: who the viewer is already accepted-
  // connected to, then who THOSE people are accepted-connected to.
  const myAccepted = await prisma.wayRequest.findMany({
    where: { status: "accepted", OR: [{ fromProfileId: profileId }, { toProfileId: profileId }] },
    select: { fromProfileId: true, toProfileId: true },
  });
  const myConnectionIds = new Set(
    myAccepted.map((r) => (r.fromProfileId === profileId ? r.toProfileId : r.fromProfileId))
  );
  const mutualCountByCandidate = new Map<string, number>();
  if (myConnectionIds.size > 0) {
    const theirAccepted = await prisma.wayRequest.findMany({
      where: {
        status: "accepted",
        OR: [{ fromProfileId: { in: [...myConnectionIds] } }, { toProfileId: { in: [...myConnectionIds] } }],
      },
      select: { fromProfileId: true, toProfileId: true },
    });
    for (const r of theirAccepted) {
      // Whichever side is one of my connections, the OTHER side is a
      // candidate "friend of a friend" — unless that other side is me.
      if (myConnectionIds.has(r.fromProfileId) && r.toProfileId !== profileId) {
        mutualCountByCandidate.set(r.toProfileId, (mutualCountByCandidate.get(r.toProfileId) ?? 0) + 1);
      }
      if (myConnectionIds.has(r.toProfileId) && r.fromProfileId !== profileId) {
        mutualCountByCandidate.set(r.fromProfileId, (mutualCountByCandidate.get(r.fromProfileId) ?? 0) + 1);
      }
    }
  }

  const candidates = await prisma.profile.findMany({
    where: { isVisible: true, isDefault: false, id: { notIn: excludeIds } },
    select: {
      id: true,
      wayId: true,
      displayName: true,
      displayPictureUrl: true,
      isVerified: true,
      kind: true,
      categories: true,
      whichWayEmbedding: true,
      displayLat: true,
      displayLng: true,
    },
    take: CANDIDATE_POOL_CAP,
    orderBy: { createdAt: "desc" },
  });

  const viewerCategories = new Set(viewer.categories);

  const scored = candidates.map((c) => {
    const sharedCategories = c.categories.filter((cat) => viewerCategories.has(cat));
    const categoryScore = Math.min(sharedCategories.length, CATEGORY_CAP) / CATEGORY_CAP;

    const semanticScore =
      viewer.whichWayEmbedding.length > 0 && c.whichWayEmbedding.length > 0
        ? Math.max(0, cosineSimilarity(viewer.whichWayEmbedding, c.whichWayEmbedding))
        : 0;

    const mutualCount = mutualCountByCandidate.get(c.id) ?? 0;
    const mutualScore = Math.min(mutualCount, MUTUAL_CAP) / MUTUAL_CAP;

    let distanceKm: number | null = null;
    if (viewer.displayLat != null && viewer.displayLng != null && c.displayLat != null && c.displayLng != null) {
      distanceKm = haversineKm(viewer.displayLat, viewer.displayLng, c.displayLat, c.displayLng);
    }
    const proximityScore = distanceKm === null ? 0 : 1 / (1 + distanceKm / PROXIMITY_DECAY_KM);

    const total =
      categoryScore * WEIGHT_CATEGORY +
      semanticScore * WEIGHT_SEMANTIC +
      mutualScore * WEIGHT_MUTUAL +
      proximityScore * WEIGHT_PROXIMITY;

    // Pick the single strongest signal to explain the suggestion —
    // priority order matches the weights above.
    let reason: string;
    if (mutualCount > 0) {
      reason = `${mutualCount} mutual connection${mutualCount > 1 ? "s" : ""}`;
    } else if (sharedCategories.length > 0) {
      const shown = sharedCategories.slice(0, 2).join(", ");
      reason = sharedCategories.length > 2 ? `Shares ${shown} +more` : `Shares ${shown}`;
    } else if (semanticScore >= 0.3) {
      reason = "Similar interests";
    } else if (distanceKm !== null && distanceKm < 10) {
      reason = "Near you";
    } else {
      reason = "Suggested for you";
    }

    return { candidate: c, total, reason };
  });

  return scored
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((s) => ({
      profile: {
        id: s.candidate.id,
        wayId: s.candidate.wayId,
        displayName: s.candidate.displayName,
        displayPictureUrl: s.candidate.displayPictureUrl,
        isVerified: s.candidate.isVerified,
        kind: s.candidate.kind,
      },
      reason: s.reason,
    }));
}
