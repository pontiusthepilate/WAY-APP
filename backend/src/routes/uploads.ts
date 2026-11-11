import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { moderateImage, REJECTED_CONTENT_ERROR } from "../lib/moderation";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  // Podcast episode audio (routes/episodes.ts) — picked via
  // expo-document-picker, so the mime type comes from whatever the OS
  // reports for the file rather than from a fixed camera-roll export.
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/aac": ".aac",
  // Business verification documents (CAC certificate) are usually a PDF
  // scan, not a photo — see routes/businessVerification.ts.
  "application/pdf": ".pdf",
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
    const filePath = path.join(UPLOAD_DIR, filename);
    await pipeline(file.file, createWriteStream(filePath));

    const mediaType = file.mimetype === "application/pdf"
      ? "document"
      : file.mimetype.startsWith("video/")
        ? "video"
        : file.mimetype.startsWith("audio/")
          ? "audio"
          : "image";

    // Image moderation runs here rather than at every post/status/DM/
    // profile-picture call site — this is the one chokepoint every image
    // passes through (see lib/moderation.ts). Video/audio/PDF aren't
    // checked yet (see the content-moderation plan's scope notes).
    if (mediaType === "image") {
      const result = await moderateImage(filePath, ext);
      if (result.flagged) {
        await unlink(filePath).catch(() => {});
        return reply.status(422).send(REJECTED_CONTENT_ERROR);
      }
    }

    // `||`, not `??` — an empty PUBLIC_BASE_URL (present but unset in .env)
    // must fall back too, or this produces a relative "/uploads/..." path
    // that fails every URL-shaped validation downstream (documentUrls, etc).
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.headers.host}`;
    reply.status(201).send({ url: `${base}/uploads/${filename}`, mediaType });
  });
}
