import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { findNearbyProfiles } from "../lib/geo";
import { geocodeAddress, GeocodeConfigError } from "../lib/geocode";
import { normalizeWayId } from "../lib/wayId";
import { getSuppressedProfileIds } from "../lib/blocking";
import { significantWords } from "../lib/describeMatch";
import { embedText } from "../lib/voyage";
import { parseSearchQuery } from "../lib/searchIntent";

const parseQueryBody = z.object({ query: z.string().min(1).max(300) });

// Shared by all three geo routes below: embeds the describe query for
// semantic ranking (see geo.ts), falling back to undefined (pure lexical
// matching, today's behavior) if there's no query, Voyage isn't
// configured, or the embed call fails — embedText never throws.
async function embedDescribeQuery(describe: string | undefined): Promise<number[] | undefined> {
  if (!describe) return undefined;
  return (await embedText(describe, "query")) ?? undefined;
}

// Config/outage errors are logged with the real reason but never shown to
// the end user verbatim; a bad address gets its own (already friendly) message.
function geocodeErrorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof GeocodeConfigError) {
    console.error("[WAY][geocode]", err.message);
    return { status: 422, body: { error: "Address search is temporarily unavailable. Try again later." } };
  }
  return { status: 422, body: { error: (err as Error).message } };
}

const DEFAULT_RADIUS_METERS = 5000;
const MAX_RADIUS_METERS = 100_000;

const nearbyQuery = z.object({
  profileId: z.string(), // the searching profile, excluded from its own results
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive().max(MAX_RADIUS_METERS).default(DEFAULT_RADIUS_METERS),
  category: z.string().optional(),
  // Free-text "describe what you're looking for" query, matched against
  // whichWay via findNearbyProfiles' describeWords (see lib/describeMatch.ts)
  // — independent of `category`, a result can match via either.
  describe: z.string().optional(),
});

// ADDRESS accepts either a client-resolved lat/lng (the mobile app already
// resolved a suggestion via Mapbox's Search Box API — no point re-geocoding
// text it already has coordinates for) OR a free-text address that gets
// geocoded server-side, same either/or shape as LOCATION below.
const addressQuery = z
  .object({
    profileId: z.string(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    address: z.string().min(3).optional(),
    radiusMeters: z.coerce.number().positive().max(MAX_RADIUS_METERS).default(DEFAULT_RADIUS_METERS),
    category: z.string().optional(),
    describe: z.string().optional(),
    language: z.string().optional(),
  })
  .refine((v) => (v.lat !== undefined && v.lng !== undefined) || v.address, {
    message: "Provide either lat & lng, or an address",
  });

// LOCATION accepts either a map-picked (or suggestion-resolved) lat/lng OR
// a free-text place name (city, state, county, country, landmark) that
// gets geocoded server-side.
const locationQuery = z
  .object({
    profileId: z.string(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    query: z.string().min(2).optional(),
    radiusMeters: z.coerce.number().positive().max(MAX_RADIUS_METERS).default(DEFAULT_RADIUS_METERS),
    category: z.string().optional(),
    describe: z.string().optional(),
    language: z.string().optional(),
  })
  .refine((v) => (v.lat !== undefined && v.lng !== undefined) || v.query, {
    message: "Provide either lat & lng, or a place name query",
  });

const wayIdQuery = z.object({
  profileId: z.string(),
  query: z.string().min(1),
});

const allQuery = z.object({
  profileId: z.string(),
  query: z.string().min(1),
  language: z.string().optional(),
});

const UNIFIED_RESULT_LIMIT = 10;

// A WAY-ID lookup result has no meaningful distance/bearing — it's an exact
// handle/phone match, not a geo search — so it's shaped like NearbyResult
// minus those two fields.
// A WAY-ID lookup result has no meaningful distance/bearing — it's an exact
// handle/phone match, not a geo search — so it's shaped like NearbyResult
// minus those two fields. Deliberately never carries a phone number: that's
// never revealed at search time (no connection exists yet to consent to
// it) — only on the full-profile page of someone you're already connected
// to, per-connection, see routes/profiles.ts and lib/profileAccess.ts.
const LOOKUP_SELECT = {
  id: true,
  wayId: true,
  displayName: true,
  displayPictureUrl: true,
  categories: true,
  whichWay: true,
  visibilityText: true,
  visibilityImageUrl: true,
  isLocationOverridden: true,
} as const;

// Unified search (feature: multi-entity search) also needs each result's
// kind, to group/label people vs. businesses vs. podcasts in one response.
const UNIFIED_SELECT = { ...LOOKUP_SELECT, kind: true } as const;

// Loose enough to accept "+1 555 123 4567", "555-123-4567", "15551234567",
// etc.; anything that doesn't look like a phone number is treated as a WayID.
const PHONE_LIKE = /^\+?[0-9][0-9\s\-().]{4,}$/;

export async function searchRoutes(app: FastifyInstance) {
  // A) NEARBY — search around the requester's own current device position.
  app.get("/search/nearby", { onRequest: [app.authenticate] }, async (req) => {
    const q = nearbyQuery.parse(req.query);
    return findNearbyProfiles({
      lat: q.lat,
      lng: q.lng,
      radiusMeters: q.radiusMeters,
      category: q.category,
      describeWords: q.describe ? significantWords(q.describe) : undefined,
      queryEmbedding: await embedDescribeQuery(q.describe),
      excludeProfileId: q.profileId,
      excludeProfileIds: await getSuppressedProfileIds(q.profileId, { includeMuted: false }),
      visibilityColumn: "visibleToNearby",
    });
  });

  // B) ADDRESS — search around a street address anywhere on earth. The
  // mobile app resolves a typed suggestion to lat/lng itself (via Mapbox's
  // Search Box API) before calling this, so geocoding here is only the
  // fallback for a free-text address submitted without picking a suggestion.
  app.get("/search/address", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = addressQuery.parse(req.query);

    let lat = q.lat;
    let lng = q.lng;
    if ((lat === undefined || lng === undefined) && q.address) {
      try {
        const point = await geocodeAddress(q.address, q.language);
        lat = point.lat;
        lng = point.lng;
      } catch (err) {
        const { status, body } = geocodeErrorResponse(err);
        return reply.status(status).send(body);
      }
    }

    return findNearbyProfiles({
      lat: lat!,
      lng: lng!,
      radiusMeters: q.radiusMeters,
      category: q.category,
      describeWords: q.describe ? significantWords(q.describe) : undefined,
      queryEmbedding: await embedDescribeQuery(q.describe),
      excludeProfileId: q.profileId,
      excludeProfileIds: await getSuppressedProfileIds(q.profileId, { includeMuted: false }),
      visibilityColumn: "visibleToAddress",
    });
  });

  // C) LOCATION — search around a point chosen on the map, or a typed place
  // name, city, state, county, or country resolved via geocoding.
  app.get("/search/location", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = locationQuery.parse(req.query);

    let lat = q.lat;
    let lng = q.lng;
    if ((lat === undefined || lng === undefined) && q.query) {
      try {
        const point = await geocodeAddress(q.query, q.language);
        lat = point.lat;
        lng = point.lng;
      } catch (err) {
        const { status, body } = geocodeErrorResponse(err);
        return reply.status(status).send(body);
      }
    }

    return findNearbyProfiles({
      lat: lat!,
      lng: lng!,
      radiusMeters: q.radiusMeters,
      category: q.category,
      describeWords: q.describe ? significantWords(q.describe) : undefined,
      queryEmbedding: await embedDescribeQuery(q.describe),
      excludeProfileId: q.profileId,
      excludeProfileIds: await getSuppressedProfileIds(q.profileId, { includeMuted: false }),
      visibilityColumn: "visibleToLocation",
    });
  });

  // D) WAY ID — exact lookup by someone's @wayId handle or their account's
  // phone number. Unlike the three geo modes above, this isn't discovery —
  // the searcher already has a specific handle or number in hand — so it
  // intentionally ignores visibleToNearby/Address/Location and only respects
  // the master isVisible switch (plus discoverableByPhone, specifically for
  // the phone-number branch — see Profile's own doc comment). A phone
  // number can own more than one profile (each account gets up to
  // FREE_PROFILE_LIMIT), so that branch can return multiple results; a
  // WayID is globally unique, so it returns at most one. Neither branch
  // ever reveals the found account's own phone number — there's no
  // connection yet at search time, so nobody's consented to that; see
  // routes/profiles.ts's GET /profiles/:id for the per-connection reveal.
  app.get("/search/way-id", { onRequest: [app.authenticate] }, async (req) => {
    const q = wayIdQuery.parse(req.query);
    const raw = q.query.trim().replace(/^way\//i, "").trim();
    if (!raw) return [];
    const suppressed = await getSuppressedProfileIds(q.profileId, { includeMuted: false });

    if (PHONE_LIKE.test(raw)) {
      const phone = raw.replace(/[\s\-().]/g, "");
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) return [];
      return prisma.profile.findMany({
        where: { userId: user.id, isVisible: true, discoverableByPhone: true, id: { not: q.profileId, notIn: suppressed } },
        select: LOOKUP_SELECT,
      });
    }

    const profile = await prisma.profile.findFirst({
      where: { wayId: normalizeWayId(raw), isVisible: true, id: { not: q.profileId, notIn: suppressed } },
      select: LOOKUP_SELECT,
    });
    return profile ? [profile] : [];
  });

  // E) ALL — unified multi-entity search: one free-text query matched by
  // name/handle across every profile kind at once, plus (if the query
  // reads as a place) a jump-to-location shortcut. Unlike nearby/address/
  // location, this never filters by distance — it's "find X by name"
  // regardless of where it is, so it only respects the master isVisible
  // switch, same as WAY ID lookup.
  app.get("/search/all", { onRequest: [app.authenticate] }, async (req) => {
    const q = allQuery.parse(req.query);
    const suppressed = await getSuppressedProfileIds(q.profileId, { includeMuted: false });
    const nameMatch = { contains: q.query, mode: "insensitive" as const };

    async function findByKind(kind: "personal" | "business" | "podcast") {
      return prisma.profile.findMany({
        where: {
          kind,
          isVisible: true,
          id: { not: q.profileId, notIn: suppressed },
          OR: [{ displayName: nameMatch }, { wayId: nameMatch }],
        },
        select: UNIFIED_SELECT,
        take: UNIFIED_RESULT_LIMIT,
      });
    }

    const [people, businesses, podcasts, location] = await Promise.all([
      findByKind("personal"),
      findByKind("business"),
      findByKind("podcast"),
      q.query.trim().length >= 2
        ? geocodeAddress(q.query, q.language).then(
            (point) => ({ lat: point.lat, lng: point.lng, label: point.formattedAddress }),
            () => null // not a resolvable place, geocoding unconfigured, etc. — just omit it
          )
        : Promise.resolve(null),
    ]);

    return { people, businesses, podcasts, location };
  });

  // F) PARSE QUERY — turns a free-text natural-language query into the
  // same structured fields the manual search UI already produces (see
  // lib/searchIntent.ts). Produces intent only; the mobile client applies
  // it to its own state and calls the routes above exactly as if the
  // user had filled them in by hand — no search execution happens here.
  app.post("/search/parse-query", { onRequest: [app.authenticate] }, async (req) => {
    const { query } = parseQueryBody.parse(req.body);
    return parseSearchQuery(query);
  });
}
