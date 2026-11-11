// Text embeddings via Voyage AI — Anthropic's recommended embeddings
// partner (the Claude API itself has no embeddings endpoint). Powers
// semantic matching for Profile.whichWay (see geo.ts's describe-search
// ranking). Every function here fails soft (returns null, never throws)
// — a Voyage outage or missing key must never break a profile save or a
// search; callers always have a plain-ILIKE fallback path available.
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-4-lite";
const EMBEDDING_DIMENSION = 512;

export function isVoyageConfigured(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

type VoyageInputType = "query" | "document";

interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

// Batched: Voyage accepts up to 1000 strings per request. Returns one
// entry per input, in order; an entry is null if that embedding failed
// to come back (shouldn't normally happen within a successful response,
// but guards against a malformed/partial one).
export async function embedTexts(texts: string[], inputType: VoyageInputType): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  if (!isVoyageConfigured()) {
    console.warn("[WAY][voyage] not configured — skipping embedding");
    return texts.map(() => null);
  }

  try {
    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSION,
      }),
    });

    if (!res.ok) {
      console.error(`[WAY][voyage] embeddings request failed (${res.status}): ${await res.text()}`);
      return texts.map(() => null);
    }

    const body = (await res.json()) as VoyageEmbeddingsResponse;
    const byIndex = new Map(body.data.map((d) => [d.index, d.embedding]));
    return texts.map((_, i) => byIndex.get(i) ?? null);
  } catch (err) {
    console.error("[WAY][voyage] embeddings request errored", err);
    return texts.map(() => null);
  }
}

export async function embedText(text: string, inputType: VoyageInputType): Promise<number[] | null> {
  const [result] = await embedTexts([text], inputType);
  return result ?? null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
