// Generates podcast show notes from a transcript — a text summarization
// task, so Claude Haiku 5.5 (same model as moderation/searchIntent/
// profileSuggestions) is plenty; a bigger model adds cost, not quality,
// here. Separate file from lib/transcription.ts to keep one provider per
// file (Deepgram there, Anthropic here), matching lib/voyage.ts vs.
// lib/moderation.ts's existing split.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";

const ShowNotesSchema = z.object({ showNotes: z.string() });

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You write show notes for a podcast episode on WAY, a location-based social app. Given the episode's transcript, write concise show notes: 3-5 sentences summarizing what the episode covers, in a neutral, inviting tone — not a word-for-word recap, a useful preview for someone deciding whether to listen.`;

export async function generateShowNotes(transcript: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ShowNotesSchema), effort: "low" },
      messages: [{ role: "user", content: transcript }],
    });
    return response.parsed_output?.showNotes ?? null;
  } catch (err) {
    console.error("[WAY][episodeShowNotes] generateShowNotes failed", err);
    return null;
  }
}
