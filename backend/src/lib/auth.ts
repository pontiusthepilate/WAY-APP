import type { FastifyRequest } from "fastify";
import { prisma } from "./db";

export interface AuthedUser {
  userId: string;
}

// Reads the verified user id off the request, populated by the @fastify/jwt
// `onRequest: [app.authenticate]` hook. Throws if the route forgot the hook.
export function requireUser(req: FastifyRequest): AuthedUser {
  const payload = req.user as { userId: string } | undefined;
  if (!payload?.userId) {
    throw new Error("Route is missing the authenticate hook");
  }
  return { userId: payload.userId };
}

// Every route that accepts a profileId in its body/query must call this
// before acting on it — it's the one thing standing between "any logged-in
// user" and "the actual owner of this profile". Two routes shipped earlier
// this session without it (wallet transaction history, scheduled live
// sessions) specifically because this check was copy-pasted per-file instead
// of shared; use this instead of redefining it locally.
export async function assertOwnsProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.userId !== userId) {
    const err = new Error("Profile not found");
    (err as any).statusCode = 404;
    throw err;
  }
  return profile;
}
