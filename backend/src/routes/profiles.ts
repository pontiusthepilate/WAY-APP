import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireUser, assertOwnsProfile } from "../lib/auth";
import { syncProfileLocation } from "../lib/geo";
import { isValidWayId, normalizeWayId } from "../lib/wayId";
import { autoFollowDefaultProfile } from "../lib/defaultProfiles";
import { computeProfileAccessLevel, restrictedProfileView, getConnection } from "../lib/profileAccess";
import { embedText } from "../lib/voyage";
import { suggestWhichWay } from "../lib/profileSuggestions";

const FREE_PROFILE_LIMIT = 2;
const suggestWhichWayBody = z.object({ bio: z.string().min(10).max(280) });

// Keeps Profile.whichWayEmbedding (see lib/voyage.ts, lib/geo.ts) in sync
// with whichWay whenever it's part of a create/update body. Runs after
// the main write, never inside a transaction (it's a slow network call),
// and is always wrapped by its caller in try/catch — a Voyage hiccup
// must never fail a profile save. `whichWay === undefined` means the
// field wasn't part of this request at all, so it's left untouched.
async function syncWhichWayEmbedding(profileId: string, whichWay: string | undefined) {
  if (whichWay === undefined) return;
  if (!whichWay) {
    await prisma.profile.update({ where: { id: profileId }, data: { whichWayEmbedding: [] } });
    return;
  }
  const embedding = await embedText(whichWay, "document");
  if (embedding) {
    await prisma.profile.update({ where: { id: profileId }, data: { whichWayEmbedding: embedding } });
  }
}

const createProfileBody = z.object({
  wayId: z.string().min(3).max(20),
  displayName: z.string().min(1).max(40),
  displayPictureUrl: z.string().url().optional(),
  bio: z.string().max(280).optional(),
  whichWay: z.string().max(150).optional(),
  categories: z.array(z.string().min(1).max(30)).max(10).default([]),
  kind: z.enum(["personal", "business", "podcast"]).default("personal"),
  // Surfaced as a 2-switch section on the signup screen itself (not just
  // buried in Privacy later) — see create-profile.tsx.
  discoverableByPhone: z.boolean().optional(),
  sharePhoneNumber: z.boolean().optional(),
});

const updateProfileBody = z.object({
  displayName: z.string().min(1).max(40).optional(),
  // null explicitly clears the picture (removing it) — plain omission leaves
  // the existing value untouched.
  displayPictureUrl: z.string().url().nullable().optional(),
  bio: z.string().max(280).optional(),
  whichWay: z.string().max(150).optional(),
  categories: z.array(z.string().min(1).max(30)).max(10).optional(),
});

// Auto-grant-full-profile-access rules (feature: profile access) — a
// separate route from /visibility and /privacy since it's a distinct
// setting group (see privacy.tsx's "Who gets full profile access" section).
const accessGrantBody = z.object({
  autoGrantAccessViaNearby: z.boolean().optional(),
  autoGrantAccessViaAddress: z.boolean().optional(),
  autoGrantAccessViaLocation: z.boolean().optional(),
  autoGrantAccessToPersonal: z.boolean().optional(),
  autoGrantAccessToBusiness: z.boolean().optional(),
  autoGrantAccessToPodcast: z.boolean().optional(),
});

const profileViewQuery = z.object({ viewerProfileId: z.string() });

const visibilityBody = z.object({
  isVisible: z.boolean().optional(),
  visibleToNearby: z.boolean().optional(),
  visibleToAddress: z.boolean().optional(),
  visibleToLocation: z.boolean().optional(),
  visibilityText: z.string().max(140).optional(),
  visibilityImageUrl: z.string().url().optional(),
  discoverableByPhone: z.boolean().optional(),
  sharePhoneNumber: z.boolean().optional(),
});

const linksBody = z.object({
  linkedProfileIds: z.array(z.string()).max(20),
});

const notificationPrefsBody = z.object({
  notifyLikes: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
  notifyFollows: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
  notifyCalls: z.boolean().optional(),
  notifyLive: z.boolean().optional(),
  notifyWayRequests: z.boolean().optional(),
  notifyCameraRequests: z.boolean().optional(),
  notifyDigest: z.boolean().optional(),
});

const privacyBody = z.object({
  messagePrivacy: z.enum(["everyone", "following", "no_one"]).optional(),
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
    return prisma.profile.findMany({ where: { userId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  });

  // Stateless text-in/text-out — doesn't touch any specific profile's
  // row, so no assertOwnsProfile needed, just being signed in. See
  // lib/profileSuggestions.ts; category suggestion from the same bio
  // happens entirely client-side via lib/categoryMatch.ts's matchCategories.
  app.post("/profiles/suggest-which-way", { onRequest: [app.authenticate] }, async (req) => {
    const { bio } = suggestWhichWayBody.parse(req.body);
    return { whichWay: await suggestWhichWay(bio) };
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

    if (body.kind === "podcast") {
      // Podcast profiles never draw from the 2 free personal/business
      // slots below — each one is paid for by its own active subscription
      // instead (see routes/subscriptions.ts).
      const [activeSlots, usedSlots] = await Promise.all([
        prisma.subscription.count({ where: { userId, kind: "podcast", status: "active" } }),
        prisma.profile.count({ where: { userId, kind: "podcast" } }),
      ]);
      if (usedSlots >= activeSlots) {
        return reply.status(402).send({
          error: "Podcast profiles require an active subscription. Subscribe to add one.",
        });
      }
    } else {
      const existingCount = await prisma.profile.count({ where: { userId, kind: { not: "podcast" } } });
      if (existingCount >= FREE_PROFILE_LIMIT) {
        return reply.status(402).send({ error: `Free plan includes ${FREE_PROFILE_LIMIT} profiles. Upgrade to add more.` });
      }
    }

    const taken = await prisma.profile.findUnique({ where: { wayId } });
    if (taken) {
      return reply.status(409).send({ error: "That WAY is already taken" });
    }

    // This user's very first profile is their primary by default — nothing
    // to choose between yet. Later profiles stay non-primary until the user
    // explicitly switches via PATCH /profiles/:id/primary.
    const existingCount = await prisma.profile.count({ where: { userId } });
    const profile = await prisma.$transaction(async (tx) => {
      const created = await tx.profile.create({
        data: { ...body, wayId, userId, isPrimary: existingCount === 0 },
      });
      try {
        await autoFollowDefaultProfile(tx, created);
      } catch (err) {
        // Never block a signup over the tribute/official-account auto-
        // follow — log and move on. (Prisma transactions abort on any
        // thrown error, so this catch is what keeps a problem here from
        // taking the profile-creation transaction down with it; without
        // it, the whole $transaction — and thus the signup — would roll
        // back if, say, the default profile row were ever in a bad state.)
        app.log.warn({ err, profileId: created.id, kind: created.kind }, "auto-follow of default profile failed");
      }
      return created;
    });
    try {
      await syncWhichWayEmbedding(profile.id, body.whichWay);
    } catch (err) {
      app.log.warn({ err, profileId: profile.id }, "whichWay embedding failed");
    }
    reply.status(201).send(profile);
  });

  // Sets this profile as the user's default "what's your WAY" answer,
  // unsetting any previous primary — exactly one per user, enforced here
  // rather than as a DB constraint since Postgres can't express "unique
  // where true" without a partial index this schema doesn't have.
  app.patch("/profiles/:id/primary", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);

    return prisma.$transaction(async (tx) => {
      await tx.profile.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
      return tx.profile.update({ where: { id }, data: { isPrimary: true } });
    });
  });

  app.get("/profiles/way/:wayId", async (req, reply) => {
    const { wayId } = req.params as { wayId: string };
    const profile = await prisma.profile.findUnique({ where: { wayId: normalizeWayId(wayId) } });
    if (!profile) return reply.status(404).send({ error: "Not found" });
    reply.send(profile);
  });

  // Gated full-profile fetch for the new full-profile page (feature:
  // profile access) — additive alongside GET /profiles/way/:wayId above,
  // which stays exactly as-is (used by the existing mini-profile modal,
  // unrestricted). Returns the full row only when computeProfileAccessLevel
  // says so; otherwise the same restricted field subset the mini-profile
  // already shows.
  app.get("/profiles/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { viewerProfileId } = profileViewQuery.parse(req.query);
    const owner = await prisma.profile.findUnique({ where: { id } });
    if (!owner) return reply.status(404).send({ error: "Not found" });
    const accessLevel = await computeProfileAccessLevel(viewerProfileId, owner);

    // Both discoveredVia and the phone-number reveal are per-connection —
    // they key off the actual accepted WayRequest between these two
    // specific profiles (never set when "full" came from a
    // ProfileAccessRequest instead, since there's no such row then).
    let isConnected = false;
    let discoveredVia: string | null = null;
    let phoneNumber: string | null = null;
    let sharingMyPhone = false;
    if (viewerProfileId !== owner.id) {
      const connection = await getConnection(viewerProfileId, owner.id);
      if (connection) {
        isConnected = true;
        discoveredVia = connection.discoveredVia;
        const ownerShares = connection.fromProfileId === owner.id ? connection.fromSharesPhone : connection.toSharesPhone;
        sharingMyPhone = connection.fromProfileId === viewerProfileId ? connection.fromSharesPhone : connection.toSharesPhone;
        if (ownerShares) {
          const ownerUser = await prisma.user.findUnique({ where: { id: owner.userId }, select: { phone: true } });
          phoneNumber = ownerUser?.phone ?? null;
        }
      }
    }

    reply.send({
      accessLevel,
      profile: accessLevel === "full" ? owner : restrictedProfileView(owner),
      isConnected,
      discoveredVia,
      phoneNumber,
      sharingMyPhone,
    });
  });

  // The viewer's own phone-sharing decision for this one connection — set
  // inline at accept time (see POST /way-requests/:id/accept) or changed
  // anytime afterward from here, which is what this route is for.
  const sharePhoneBody = z.object({ viewerProfileId: z.string(), share: z.boolean() });
  app.patch("/profiles/:id/share-phone", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const body = sharePhoneBody.parse(req.body);
    await assertOwnsProfile(userId, body.viewerProfileId);
    const connection = await getConnection(id, body.viewerProfileId);
    if (!connection) return reply.status(404).send({ error: "You're not connected to this profile" });
    const field = connection.fromProfileId === body.viewerProfileId ? "fromSharesPhone" : "toSharesPhone";
    await prisma.wayRequest.update({ where: { id: connection.id }, data: { [field]: body.share } });
    reply.send({ share: body.share });
  });

  app.patch("/profiles/:id", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = updateProfileBody.parse(req.body);
    const updated = await prisma.profile.update({ where: { id }, data: body });
    try {
      await syncWhichWayEmbedding(id, body.whichWay);
    } catch (err) {
      app.log.warn({ err, profileId: id }, "whichWay embedding failed");
    }
    return updated;
  });

  app.patch("/profiles/:id/visibility", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = visibilityBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  app.patch("/profiles/:id/notification-prefs", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = notificationPrefsBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  app.patch("/profiles/:id/privacy", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = privacyBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  app.patch("/profiles/:id/access-grants", { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = accessGrantBody.parse(req.body);
    return prisma.profile.update({ where: { id }, data: body });
  });

  // Public: lets anyone viewing a profile see which of the owner's other
  // profiles they've chosen to cross-link from this one (feature:
  // profile-kind cross-linking). Returns full Profile rows, same shape as
  // GET /profiles/way/:wayId, so mobile can reuse that type directly.
  app.get("/profiles/:id/links", async (req) => {
    const { id } = req.params as { id: string };
    const links = await prisma.profileLink.findMany({
      where: { profileId: id },
      include: { linkedProfile: true },
      orderBy: { createdAt: "asc" },
    });
    return links.map((l) => l.linkedProfile);
  });

  // Owner-only: replaces the full set of profiles cross-linked from `id`.
  // Both ends must belong to the same user — this is about a user's own
  // profiles pointing at each other, not a connection between two users.
  app.put("/profiles/:id/links", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await assertOwnsProfile(userId, id);
    const body = linksBody.parse(req.body);

    const targetIds = [...new Set(body.linkedProfileIds)].filter((linkedId) => linkedId !== id);
    const owned = await prisma.profile.count({ where: { id: { in: targetIds }, userId } });
    if (owned !== targetIds.length) {
      return reply.status(400).send({ error: "Can only link to your own other profiles" });
    }

    await prisma.$transaction([
      prisma.profileLink.deleteMany({ where: { profileId: id } }),
      ...(targetIds.length
        ? [prisma.profileLink.createMany({ data: targetIds.map((linkedProfileId) => ({ profileId: id, linkedProfileId })) })]
        : []),
    ]);
    const links = await prisma.profileLink.findMany({ where: { profileId: id }, include: { linkedProfile: true } });
    reply.send(links.map((l) => l.linkedProfile));
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
