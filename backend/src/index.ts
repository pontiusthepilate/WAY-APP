import "dotenv/config";
import path from "node:path";
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

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
