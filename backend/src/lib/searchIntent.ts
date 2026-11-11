// Parses a free-text search query ("bike mechanics within 2km of Yaba")
// into the exact structured fields the manual search UI already produces
// (mode, radius, location/describe/wayId/all text) — see
// mobile/src/app/(tabs)/search.tsx's runSearch. This never executes a
// search itself; routes/search.ts's existing nearby/address/location/
// way-id/all endpoints do all the real work, completely unchanged.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";

export const ParsedSearchIntentSchema = z.object({
  mode: z.enum(["nearby", "address", "location", "wayid", "all"]),
  describe: z.string().nullable(),
  radiusMeters: z.number().nullable(),
  locationQuery: z.string().nullable(),
  wayIdQuery: z.string().nullable(),
  allQuery: z.string().nullable(),
});
export type ParsedSearchIntent = z.infer<typeof ParsedSearchIntentSchema>;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You turn a free-text search query for WAY (a location-based social app) into structured search parameters. Pick exactly one "mode":

- "nearby": no location is mentioned, or it implies the user's current location ("near me", "around here"). Example: "bike mechanics near me" -> mode: nearby, describe: "bike mechanics".
- "address": a specific street address is given (street number + street name, or similarly precise). Example: "photographers within 3km of 12 Allen Avenue, Ikeja" -> mode: address, locationQuery: "12 Allen Avenue, Ikeja", radiusMeters: 3000, describe: "photographers".
- "location": a general place is given — a city, state, country, neighborhood, or landmark, without a specific street address. Example: "find a podcast studio in Abuja" -> mode: location, locationQuery: "Abuja", describe: "podcast studio".
- "wayid": the query is just a handle (e.g. "@johndoe") or a phone number, nothing else. Example: "@johndoe" -> mode: wayid, wayIdQuery: "johndoe".
- "all": the query names a specific person, business, or podcast to find by name, with no location or category intent. Example: "WAY Ltd" -> mode: all, allQuery: "WAY Ltd".

Fill "describe" with the free-text description of what/who they're looking for (skip it for wayid/all modes, where the name/handle itself is the query). Only fill "radiusMeters" when a distance is explicitly mentioned (convert miles to meters: 1 mile = 1609 meters). Leave every field you don't need as null.`;

const FALLBACK = (query: string): ParsedSearchIntent => ({
  mode: "nearby",
  describe: query,
  radiusMeters: null,
  locationQuery: null,
  wayIdQuery: null,
  allQuery: null,
});

export async function parseSearchQuery(query: string): Promise<ParsedSearchIntent> {
  if (!process.env.ANTHROPIC_API_KEY) return FALLBACK(query);
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ParsedSearchIntentSchema), effort: "low" },
      messages: [{ role: "user", content: query }],
    });
    return response.parsed_output ?? FALLBACK(query);
  } catch (err) {
    console.error("[WAY][searchIntent] parseSearchQuery failed, falling back to nearby/describe", err);
    return FALLBACK(query);
  }
}
