import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { findNearbyProfiles } from "../lib/geo";
import { geocodeAddress, GeocodeConfigError } from "../lib/geocode";
import { normalizeWayId } from "../lib/wayId";

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
});

const addressQuery = z.object({
  profileId: z.string(),
  address: z.string().min(3),
  radiusMeters: z.coerce.number().positive().max(MAX_RADIUS_METERS).default(DEFAULT_RADIUS_METERS),
  category: z.string().optional(),
});

// LOCATION accepts either a map-picked lat/lng OR a free-text place name
// (city, state, county, country, landmark) that gets geocoded server-side.
const locationQuery = z
  .object({
    profileId: z.string(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    query: z.string().min(2).optional(),
    radiusMeters: z.coerce.number().positive().max(MAX_RADIUS_METERS).default(DEFAULT_RADIUS_METERS),
    category: z.string().optional(),
  })
  .refine((v) => (v.lat !== undefined && v.lng !== undefined) || v.query, {
    message: "Provide either lat & lng, or a place name query",
  });

const wayIdQuery = z.object({
  profileId: z.string(),
  query: z.string().min(1),
});

// A WAY-ID lookup result has no meaningful distance/bearing — it's an exact
// handle/phone match, not a geo search — so it's shaped like NearbyResult
// minus those two fields.
const LOOKUP_SELECT = {
  id: true,
  wayId: true,
  displayName: true,
  displayPictureUrl: true,
  categories: true,
  visibilityText: true,
  visibilityImageUrl: true,
  isLocationOverridden: true,
} as const;

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
      excludeProfileId: q.profileId,
      visibilityColumn: "visibleToNearby",
    });
  });

  // B) ADDRESS — search around a free-text street address anywhere on earth.
  app.get("/search/address", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = addressQuery.parse(req.query);
    let point: { lat: number; lng: number };
    try {
      point = await geocodeAddress(q.address);
    } catch (err) {
      const { status, body } = geocodeErrorResponse(err);
      return reply.status(status).send(body);
    }
    return findNearbyProfiles({
      lat: point.lat,
      lng: point.lng,
      radiusMeters: q.radiusMeters,
      category: q.category,
      excludeProfileId: q.profileId,
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
        const point = await geocodeAddress(q.query);
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
      excludeProfileId: q.profileId,
      visibilityColumn: "visibleToLocation",
    });
  });

  // D) WAY ID — exact lookup by someone's @wayId handle or their account's
  // phone number. Unlike the three geo modes above, this isn't discovery —
  // the searcher already has a specific handle or number in hand — so it
  // intentionally ignores visibleToNearby/Address/Location and only respects
  // the master isVisible switch. A phone number can own more than one
  // profile (each account gets up to FREE_PROFILE_LIMIT), so that branch can
  // return multiple results; a WayID is globally unique, so it returns at
  // most one.
  app.get("/search/way-id", { onRequest: [app.authenticate] }, async (req) => {
    const q = wayIdQuery.parse(req.query);
    const raw = q.query.trim().replace(/^way\//i, "").trim();
    if (!raw) return [];

    if (PHONE_LIKE.test(raw)) {
      const phone = raw.replace(/[\s\-().]/g, "");
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) return [];
      const profiles = await prisma.profile.findMany({
        where: { userId: user.id, isVisible: true, id: { not: q.profileId } },
        select: LOOKUP_SELECT,
      });
      return profiles;
    }

    const profile = await prisma.profile.findFirst({
      where: { wayId: normalizeWayId(raw), isVisible: true, id: { not: q.profileId } },
      select: LOOKUP_SELECT,
    });
    return profile ? [profile] : [];
  });
}
