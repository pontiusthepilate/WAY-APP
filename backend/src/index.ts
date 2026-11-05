import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { authRoutes } from "./routes/auth";
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

  await app.register(authRoutes);
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
