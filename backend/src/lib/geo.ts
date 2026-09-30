import { prisma } from "./db";

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
  visibilityText: string | null;
  visibilityImageUrl: string | null;
  isLocationOverridden: boolean;
  distanceMeters: number;
  bearingDegrees: number;
}

// Finds visible profiles within radiusMeters of (lat, lng), optionally filtered
// by category, ordered nearest-first. bearingDegrees (0 = north, clockwise) lets
// the radar UI place each result around the center dot.
export async function findNearbyProfiles(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  category?: string;
  excludeProfileId?: string;
  visibilityColumn: "visibleToNearby" | "visibleToAddress" | "visibleToLocation";
  limit?: number;
}): Promise<NearbyResult[]> {
  const { lat, lng, radiusMeters, category, excludeProfileId, visibilityColumn, limit = 100 } = params;

  // visibilityColumn is a TS-constrained literal (never user input), safe to interpolate.
  const rows = await prisma.$queryRawUnsafe<NearbyResult[]>(
    `
    SELECT
      "id", "wayId", "displayName", "displayPictureUrl", "categories",
      "visibilityText", "visibilityImageUrl", "isLocationOverridden",
      ST_Distance("location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS "distanceMeters",
      (degrees(ST_Azimuth(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography::geometry, "location"::geometry)) + 360)::float % 360 AS "bearingDegrees"
    FROM "Profile"
    WHERE "location" IS NOT NULL
      AND "isVisible" = true
      AND "${visibilityColumn}" = true
      AND ST_DWithin("location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      AND ($4::text IS NULL OR $4 = ANY("categories"))
      AND ($5::text IS NULL OR "id" != $5)
    ORDER BY "distanceMeters" ASC
    LIMIT $6
    `,
    lng,
    lat,
    radiusMeters,
    category ?? null,
    excludeProfileId ?? null,
    limit
  );

  return rows;
}
