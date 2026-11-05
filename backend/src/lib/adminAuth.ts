import type { FastifyReply, FastifyRequest } from "fastify";

// Bare-bones admin gate: a single shared secret, since there's no admin
// user/role system yet — just the one person (the app owner) reviewing
// business verification requests. Fails closed if ADMIN_API_SECRET is
// unset: an empty env var never matches a real header value, so admin
// routes are simply unreachable rather than open, until it's configured.
export async function requireAdminSecret(req: FastifyRequest, reply: FastifyReply) {
  const provided = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_API_SECRET || provided !== process.env.ADMIN_API_SECRET) {
    reply.status(401).send({ error: "Unauthorized" });
  }
}
