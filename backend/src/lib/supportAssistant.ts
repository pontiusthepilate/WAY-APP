// A conversational in-app help assistant — the first feature in this app
// using Claude for genuine open-ended generation rather than single-shot
// classification/extraction, so it calls messages.create() directly
// instead of the messages.parse()+Zod shape every other lib here uses.
// Grounded in a static description of how WAY works (nothing like that
// exists elsewhere to draw from) plus a short, deliberately-scoped
// summary of the asking profile's own settings — never wallet balance
// or transaction history, which is higher-sensitivity than anything
// else here and isn't needed for "how do I use the app" help.
import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@prisma/client";

const MODEL = "claude-haiku-5-5";
// Bounds token cost/latency as a thread grows long — full history still
// persisted regardless (see routes/supportAssistant.ts).
export const HISTORY_LIMIT = 20;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You are WAY's in-app support assistant. WAY is a location-based social app. Answer questions about how to use it, based only on what's described below. Stay on topic — if asked something you can't help with (account deletion, billing disputes, bug reports needing a human), say so and point to support@wwwaaayyy.com. Keep answers short and conversational, not a wall of text.

How WAY works:
- Profiles come in three kinds: personal, business, and podcast. A user can hold multiple profiles under one account.
- "Which Way" is a short first-person teaser ("what you do, offer, or love") shown wherever a profile is previewed.
- Categories are a fixed set of interest tags a profile can pick to help people find them.
- Search has multiple modes: Nearby (radius-based), Address, Location (a general place), WAY ID (a handle/phone), and a natural-language description search.
- "Connect" sends a WAY request to another profile; once accepted, the sender may automatically get full profile access depending on the owner's settings (based on how they were found, or the sender's profile kind). Anyone else can separately request full profile access with a short message.
- The wallet lets a user fund their balance and transfer money to another profile.
- Episodes are podcast-only audio posts; they can be liked, commented on, and shared, and get an automatic transcript and show notes once processing finishes.
- Live broadcasts let a profile go live for their followers, with chat and a viewer count.
- Calls are 1:1 or group video/audio calls between profiles.
- Notifications cover likes, comments, follows, messages, calls, live broadcasts, and WAY/camera/profile-access requests — each has its own on/off toggle in Notification preferences. There's also a weekly digest that batches likes/comments/new followers into one summary instead of a push per event.
- Privacy settings control who can message you (everyone, people you follow, or no one) and whether your profile is discoverable via nearby/address/location search.
- Blocking stops someone from contacting or finding you; Reporting flags content for review.
- Business profiles can apply for verification. Podcast profiles may have a paid subscription.`;

export interface SupportHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

// Deliberately excludes wallet balance/transactions — see file header.
export function summarizeProfileForAssistant(profile: Profile): string {
  const lines = [
    `\n\nThe profile you're helping (use this to answer specifically, not generically):`,
    `- Display name: ${profile.displayName}`,
    `- Profile kind: ${profile.kind}`,
    `- Verified: ${profile.isVerified ? "yes" : "no"}`,
    `- Has a Which Way teaser set: ${profile.whichWay ? "yes" : "no"}`,
    `- Discoverable nearby: ${profile.visibleToNearby ? "yes" : "no"}`,
    `- Discoverable by address search: ${profile.visibleToAddress ? "yes" : "no"}`,
    `- Discoverable by location search: ${profile.visibleToLocation ? "yes" : "no"}`,
    `- Who can message them: ${profile.messagePrivacy}`,
    `- Weekly digest notifications: ${profile.notifyDigest ? "on" : "off"}`,
  ];
  return lines.join("\n");
}

export async function askAssistant(
  profile: Profile,
  history: SupportHistoryTurn[],
  message: string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT + summarizeProfileForAssistant(profile),
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.text })),
        { role: "user" as const, content: message },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : null;
  } catch (err) {
    console.error("[WAY][supportAssistant] askAssistant failed", err);
    return null;
  }
}
