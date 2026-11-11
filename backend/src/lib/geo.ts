import { prisma } from "./db";
import { cosineSimilarity } from "./voyage";

// Below this, a semantic "describe" match is treated as noise rather
// than a real hit. Empirically tuned (see lib/voyage.ts's cosine scale)
// — revisit if real search traffic shows it too strict/loose.
const SEMANTIC_MATCH_THRESHOLD = 0.35;

// Keeps the PostGIS `location` geography column in sync with displayLat/displayLng.
// Prisma can't write "Unsupported" columns directly, so this runs alongside a
// normal prisma.profile.update() call whenever the display location changes.
export async function syncProfileLocation(profileId: string, lat: number, lng: number) {
  await prisma.$executeRaw`
    UPDATE "Profile"
    SET "location" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE "id" = ${profileId}
  `;
}

export interface NearbyResult {
  id: string;
  wayId: string;
  displayName: string;
  displayPictureUrl: string | null;
  categories: string[];
  whichWay: string | null;
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  isLocationOverridden: boolean;
  distanceMeters: number;
  bearingDegrees: number;
}

// Raw query row — carries whichWayEmbedding for in-Node semantic ranking
// (see below), stripped back off before returning to callers.
interface NearbyRow extends NearbyResult {
  whichWayEmbedding: number[];
}

// A broader internal candidate cap used only when ranking semantically —
// still cheap at this app's current scale (geo-radius-filtered, not a
// full-table scan). Revisit with pgvector if profile density per search
// radius ever grows enough for this bound to start clipping real matches.
const SEMANTIC_CANDIDATE_CAP = 500;

// Finds visible profiles within radiusMeters of (lat, lng), optionally filtered
// by category, ordered nearest-first. bearingDegrees (0 = north, clockwise) lets
// the radar UI place each result around the center dot.
export async function findNearbyProfiles(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  category?: string;
  // Free-text words to additionally match against whichWay (see
  // lib/describeMatch.ts's significantWords) — any one word matching is
  // enough. Independent of `category`: a result can match via either.
  // Always used as the lexical fallback/safety net, even when
  // queryEmbedding is also supplied.
  describeWords?: string[];
  // Voyage embedding of the same describe query (see lib/voyage.ts),
  // used for semantic ranking against each candidate's
  // whichWayEmbedding. Omitted when Voyage is unconfigured or the embed
  // call failed — in that case behavior is identical to pure lexical
  // ILIKE matching, same as before this param existed.
  queryEmbedding?: number[];
  excludeProfileId?: string;
  excludeProfileIds?: string[];
  visibilityColumn: "visibleToNearby" | "visibleToAddress" | "visibleToLocation";
  limit?: number;
}): Promise<NearbyResult[]> {
  const {
    lat,
    lng,
    radiusMeters,
    category,
    describeWords = [],
    queryEmbedding,
    excludeProfileId,
    excludeProfileIds = [],
    visibilityColumn,
    limit = 100,
  } = params;

  // Semantic mode: don't make the lexical ILIKE match a hard SQL filter —
  // cosine similarity (which can't run in plain SQL without pgvector, see
  // lib/voyage.ts) decides the real pass/fail instead, in Node below. The
  // SQL step becomes a wider geo/visibility/category candidate fetch.
  const semanticMode = !!queryEmbedding && queryEmbedding.length > 0;

  // visibilityColumn is a TS-constrained literal (never user input), safe to interpolate.
  // describeWords stays a bound array parameter ($8) — never string-concatenated — so
  // this carries no injection risk despite the unsafe call being needed for the column name.
  const rows = await prisma.$queryRawUnsafe<NearbyRow[]>(
    `
    SELECT
      "id", "wayId", "displayName", "displayPictureUrl", "categories", "whichWay", "whichWayEmbedding",
      "visibilityText", "visibilityImageUrl", "isLocationOverridden",
      ST_Distance("location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS "distanceMeters",
      ((degrees(ST_Azimuth(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography::geometry, "location"::geometry)) + 360)::numeric % 360::numeric)::float AS "bearingDegrees"
    FROM "Profile"
    WHERE "location" IS NOT NULL
      AND "isVisible" = true
      AND "${visibilityColumn}" = true
      AND ST_DWithin("location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      AND ($4::text IS NULL OR $4 = ANY("categories"))
      AND ($5::text IS NULL OR "id" != $5)
      AND NOT ("id" = ANY($6::text[]))
      AND (
        $9::boolean
        OR cardinality($8::text[]) = 0
        OR EXISTS (SELECT 1 FROM unnest($8::text[]) AS w WHERE "whichWay" ILIKE '%' || w || '%')
      )
    ORDER BY "distanceMeters" ASC
    LIMIT $7
    `,
    lng,
    lat,
    radiusMeters,
    category ?? null,
    excludeProfileId ?? null,
    excludeProfileIds,
    semanticMode ? Math.min(SEMANTIC_CANDIDATE_CAP, Math.max(limit, 1) * 5) : limit,
    describeWords,
    semanticMode
  );

  if (!semanticMode) {
    return rows.map(({ whichWayEmbedding: _whichWayEmbedding, ...rest }) => rest);
  }

  const lowerWords = describeWords.map((w) => w.toLowerCase());
  const survivors = rows.filter((row) => {
    const lexicalMatch = lowerWords.length > 0 && !!row.whichWay && lowerWords.some((w) => row.whichWay!.toLowerCase().includes(w));
    const semanticMatch =
      row.whichWayEmbedding.length > 0 && cosineSimilarity(queryEmbedding!, row.whichWayEmbedding) >= SEMANTIC_MATCH_THRESHOLD;
    return lexicalMatch || semanticMatch;
  });

  return survivors.slice(0, limit).map(({ whichWayEmbedding: _whichWayEmbedding, ...rest }) => rest);
}
