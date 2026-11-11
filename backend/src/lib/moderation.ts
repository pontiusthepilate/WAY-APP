// Proactive content-safety classification via Claude — the first direct
// Anthropic API use in this app (Voyage, used for semantic search in
// lib/voyage.ts, is a separate, non-Anthropic provider). Screens
// user-generated text and uploaded images at creation time, before
// anything is saved (see routes/posts.ts, live.ts, messages.ts, status.ts,
// episodes.ts, uploads.ts).
//
// Fails OPEN on infrastructure errors (network issue, rate limit, outage,
// or an unset key) — content is allowed through, never blocked, if the
// classifier itself can't be reached. Only an actual `flagged: true`
// result blocks anything. Mirrors this app's standing resilience pattern
// (notify.ts's provider fallback chain) — an external outage must never
// become a total feature outage for posting/commenting/messaging.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";

const ModerationResultSchema = z.object({
  flagged: z.boolean(),
  category: z.string().nullable(),
  reason: z.string().nullable(),
});
export type ModerationResult = z.infer<typeof ModerationResultSchema>;

const PASS: ModerationResult = { flagged: false, category: null, reason: null };

export function isModerationConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const TEXT_SYSTEM_PROMPT = `You are a content-safety classifier for WAY, a location-based social app. Flag content that contains: harassment, hate speech, or threats aimed at a person or group; sexual content involving minors (always flag, no exceptions); graphic violence or gore; scams, phishing, or spam; or other clearly harmful content.

Do NOT flag merely edgy, crude, or mature-but-legal content, political or religious opinions, profanity on its own, or content you simply disagree with — the bar is real harm, not taste. When in doubt, don't flag.`;

const IMAGE_SYSTEM_PROMPT = `You are a content-safety classifier for WAY, a location-based social app. Flag images containing: sexual or sexually suggestive content, especially involving minors (always flag, no exceptions); graphic violence or gore; hate symbols; or other clearly illegal imagery.

Do NOT flag ordinary photos, mild suggestiveness (e.g. swimwear), or content you simply find distasteful — the bar is real harm, not taste. When in doubt, don't flag.`;

export const REJECTED_CONTENT_ERROR = { error: "This content violates our content policy" };

// Convenience for route handlers: checks every piece of free text passed
// in (skipping empty/undefined ones — e.g. an optional caption) and
// returns true as soon as any is flagged, short-circuiting the rest.
// Callers respond with REJECTED_CONTENT_ERROR when this returns true.
export async function textViolatesPolicy(...texts: (string | undefined)[]): Promise<boolean> {
  if (!isModerationConfigured()) return false;
  for (const text of texts) {
    if (!text) continue;
    const result = await moderateText(text);
    if (result.flagged) return true;
  }
  return false;
}

export async function moderateText(text: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) return PASS;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: TEXT_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ModerationResultSchema), effort: "low" },
      messages: [{ role: "user", content: text }],
    });
    return response.parsed_output ?? PASS;
  } catch (err) {
    console.error("[WAY][moderation] moderateText failed, failing open", err);
    return PASS;
  }
}

const EXT_TO_MEDIA_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function moderateImage(filePath: string, extension: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) return PASS;
  const mediaType = EXT_TO_MEDIA_TYPE[extension];
  if (!mediaType) return PASS; // not an image we know how to classify — nothing to check

  try {
    const data = (await readFile(filePath)).toString("base64");
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: IMAGE_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ModerationResultSchema), effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as any, data } },
            { type: "text", text: "Classify this image." },
          ],
        },
      ],
    });
    return response.parsed_output ?? PASS;
  } catch (err) {
    console.error("[WAY][moderation] moderateImage failed, failing open", err);
    return PASS;
  }
}
