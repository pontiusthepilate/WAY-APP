import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { syncProfileLocation } from "../lib/geo";
import { isValidWayId, normalizeWayId } from "../lib/wayId";

const FREE_PROFILE_LIMIT = 2;

const createProfileBody = z.object({
  wayId: z.string().min(3).max(20),
  displayName: z.string().min(1).max(40),
  displayPictureUrl: z.string().url().optional(),
  bio: z.string().max(280).optional(),
  categories: z.array(z.string().min(1).max(30)).max(10).default([]),
  kind: z.enum(["personal", "business"]).default("personal"),
});

const updateProfileBody = z.object({
  displayName: z.string().min(1).max(40).optional(),
  displayPictureUrl: z.string().url().optional(),
  bio: z.string().max(280).optional(),
  categories: z.array(z.string().min(1).max(30)).max(10).optional(),
});

const visibilityBody = z.object({
  isVisible: z.boolean().optional(),
  visibleToNearby: z.boolean().optional(),
  visibleToAddress: z.boolean().optional(),
  visibleToLocation: z.boolean().optional(),
  visibilityText: z.string().max(140).optional(),
  visibilityImageUrl: z.string().url().optional(),
});

const locationBody = z.object({
  actualLat: z.number().min(-90).max(90),
  actualLng: z.number().min(-180).max(180),
  // When set, the profile appears at this location instead of the actual one
  // (feature 5: "set my location anywhere in the world").
  overrideLat: z.number().min(-90).max(90).optional(),
  overrideLng: z.number().min(-180).max(180).optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profiles/me", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    return prisma.profile.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  });

  app.post("/profiles", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const body = createProfileBody.parse(req.body);

    const wayId = normalizeWayId(body.wayId);
    if (!isValidWayId(wayId)) {
      return reply.status(400).send({
        error: "WAY must be 3-20 characters: lowercase letters, numbers, underscore, starting with a letter",
      });
    }

    const existingCount = await prisma.profile.count({ where: { userId } });
    if (existingCount >= FREE_PROFILE_LIMIT) {
      return reply.status(402).send({ error: `Free plan includes ${FREE_PROFILE_LIMIT} profiles. Upgrade to add more.` });
    }

    const taken = await prisma.profile.findUnique({ where: { wayId } });
    if (taken) {
      return reply.status(409).send({ error: "That WAY is already taken" });
    }

    const profile = await prisma.profile.create({
      data: { ...body, wayId, userId },
    });
    reply.status(201).send(profile);
  });

  app.get("/profiles/way/:wayId", async (req, reply) => {
    const { wayId } = req.params as { wayId: string };
    const profile = await prisma.profile.findUnique({ where: { wayId: normalizeWayId(wayId) } });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    reply.send(profile);
  });

  app.patch("/profiles/:id", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = updateProfileBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  app.patch("/profiles/:id/visibility", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = visibilityBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  // Updates the device's real location and, optionally, a decoupled display
  // location the profile should appear at instead (feature 5).
  app.patch("/profiles/:id/location", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = locationBody.parse(req.body);

    const isOverridden = body.overrideLat !== undefined && body.overrideLng !== undefined;
    const displayLat = isOverridden ? body.overrideLat! : body.actualLat;
    const displayLng = isOverridden ? body.overrideLng! : body.actualLng;

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        actualLat: body.actualLat,
        actualLng: body.actualLng,
        displayLat,
        displayLng,
        isLocationOverridden: isOverridden,
        lastActiveAt: new Date(),
      },
    });
    await syncProfileLocation(id, displayLat, displayLng);
    return profile;
  });
}
