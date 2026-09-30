import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
};

// Local-disk upload store for dev/self-hosted use. Swap for S3/Cloudinary/R2
// before production — this won't survive redeploys or scale past one host.
export async function uploadRoutes(app: FastifyInstance) {
  await mkdir(UPLOAD_DIR, { recursive: true });

  app.post("/uploads", { onRequest: [app.authenticate] }, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } });
    if (!file) return reply.status(400).send({ error: "No file uploaded" });

    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) return reply.status(415).send({ error: `Unsupported file type: ${file.mimetype}` });

    const filename = `${randomUUID()}${ext}`;
    await pipeline(file.file, createWriteStream(path.join(UPLOAD_DIR, filename)));

    const base = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.headers.host}`;
    reply.status(201).send({
      url: `${base}/uploads/${filename}`,
      mediaType: file.mimetype.startsWith("video/") ? "video" : "image",
    });
  });
}
