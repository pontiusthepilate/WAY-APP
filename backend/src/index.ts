import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { ZodError } from "zod";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { profileRoutes } from "./routes/profiles";
import { searchRoutes } from "./routes/search";
import { wayRequestRoutes } from "./routes/wayRequests";
import { postRoutes } from "./routes/posts";
import { uploadRoutes } from "./routes/uploads";
import { walletRoutes } from "./routes/wallet";
import { followRoutes } from "./routes/follow";
import { pushRoutes } from "./routes/push";
import { liveRoutes } from "./routes/live";
import { remoteCameraRoutes } from "./routes/remoteCamera";
import { messageRoutes } from "./routes/messages";
import { safetyRoutes } from "./routes/safety";
import { statusRoutes } from "./routes/status";
import { notificationRoutes } from "./routes/notifications";
import { callRoutes } from "./routes/calls";
import { businessVerificationRoutes } from "./routes/businessVerification";
import { subscriptionRoutes } from "./routes/subscriptions";
import { episodeRoutes } from "./routes/episodes";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret-change-me" });
  await app.register(multipart);
  await app.register(fastifyStatic, { root: path.join(process.cwd(), "uploads"), prefix: "/uploads/" });
  // Unlike /uploads (user-submitted, written at runtime, wiped on every
  // redeploy — no Fly volume mounted), this serves assets committed to
  // the repo and copied into the image at build time, for the handful of
  // permanent default-profile images that must survive every redeploy.
  // decorateReply: false for the same reason as the web root below — only
  // one static registration can own reply.sendFile.
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public-assets"),
    prefix: "/public-assets/",
    decorateReply: false,
  });

  // The Expo web export (mobile/dist, copied to ./web at build time) is a
  // single-page app — one index.html plus hashed JS/asset files under their
  // own real paths. Static assets are served as-is; the notFoundHandler
  // below falls through to index.html for anything else, so Expo Router's
  // client-side routing can render the right screen for a deep link or a
  // hard refresh. decorateReply: false avoids a duplicate `sendFile`
  // decorator clash with the /uploads/ registration above — this handler
  // reads the file directly instead.
  const webRoot = path.join(process.cwd(), "web");
  await app.register(fastifyStatic, { root: webRoot, prefix: "/", decorateReply: false });

  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/health", async () => ({ ok: true, service: "way-backend" }));

  // Every route validates its input with a zod .parse() that just throws on
  // failure — without this, that throw fell through to Fastify's default
  // handler as a raw 500 with the dumped ZodError, on every route in the
  // app, not just one. Routes that throw their own Error with a
  // .statusCode attached (e.g. assertOwnsProfile's 404) already worked,
  // since Fastify's default handler already honors that; this only needed
  // to special-case ZodError on top of that same behavior.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: err.issues[0]?.message ?? "Invalid request",
        issues: err.issues,
      });
    }
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) req.log.error(err);
    reply.status(statusCode).send({ error: (err as Error).message || "Internal Server Error" });
  });

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(profileRoutes);
  await app.register(searchRoutes);
  await app.register(wayRequestRoutes);
  await app.register(postRoutes);
  await app.register(uploadRoutes);
  await app.register(walletRoutes);
  await app.register(followRoutes);
  await app.register(pushRoutes);
  await app.register(liveRoutes);
  await app.register(remoteCameraRoutes);
  await app.register(messageRoutes);
  await app.register(safetyRoutes);
  await app.register(statusRoutes);
  await app.register(notificationRoutes);
  await app.register(callRoutes);
  await app.register(businessVerificationRoutes);
  await app.register(subscriptionRoutes);
  await app.register(episodeRoutes);

  // Reached only when no API route or static file matched — i.e. a browser
  // navigating straight to (or reloading) a client-side route like /feed.
  // Missing locally in dev (no web/ build present), which is fine: that 404s
  // normally instead of crashing, since local dev talks to Metro directly.
  app.setNotFoundHandler(async (req, reply) => {
    if (req.method !== "GET") return reply.status(404).send({ error: "Not found" });
    try {
      const html = await readFile(path.join(webRoot, "index.html"));
      reply.type("text/html").send(html);
    } catch {
      reply.status(404).send({ error: "Not found" });
    }
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
