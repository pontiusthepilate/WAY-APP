import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findNearbyProfiles } from "../lib/geo";
import { geocodeAddress } from "../lib/geocode";

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
      return reply.status(422).send({ error: (err as Error).message });
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
        return reply.status(422).send({ error: (err as Error).message });
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
}
