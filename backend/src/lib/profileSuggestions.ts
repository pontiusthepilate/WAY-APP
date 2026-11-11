// Suggests a Which Way teaser from a profile's bio — a short generation
// task, so Claude Haiku 5.5 (same model as moderation/searchIntent) is
// plenty. Category suggestion from the same bio text deliberately has NO
// backend counterpart here: mobile/src/lib/categoryMatch.ts's
// matchCategories() already does free-text → taxonomy matching
// client-side (used by the category picker's sentence match), so reusing
// it for this needs zero new backend code.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";
const WHICH_WAY_MAX_LENGTH = 150;

const SuggestionSchema = z.object({ whichWay: z.string() });

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You write a "Which Way" teaser for WAY, a location-based social app. Which Way is a short, first-person line answering "what do you do, offer, or love?" — shown wherever someone's profile is previewed, so people can tell at a glance whether to connect.

Given someone's bio, write one Which Way teaser: ${WHICH_WAY_MAX_LENGTH} characters or fewer, first person, plain and specific (no hashtags, no emoji, no generic filler like "passionate about life"). Base it only on what the bio actually says.`;

export async function suggestWhichWay(bio: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(SuggestionSchema), effort: "low" },
      messages: [{ role: "user", content: bio }],
    });
    const whichWay = response.parsed_output?.whichWay;
    return whichWay ? whichWay.slice(0, WHICH_WAY_MAX_LENGTH) : null;
  } catch (err) {
    console.error("[WAY][profileSuggestions] suggestWhichWay failed", err);
    return null;
  }
}
