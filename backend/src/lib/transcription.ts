// Speech-to-text for podcast episodes, via Deepgram (Claude has no audio
// input). Deepgram's pre-recorded endpoint fetches the audio itself from
// a URL — every Episode.mediaUrl is already public (routes/uploads.ts),
// so no file-fetching/re-uploading step is needed, just one JSON POST.
// Never throws: any error, timeout, or unconfigured key returns null —
// callers (routes/episodes.ts) always have a plain "failed" status to
// fall back to, same resilience contract as every other provider in
// this app (lib/voyage.ts, lib/moderation.ts, etc.).
const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&diarize_model=latest&paragraphs=true";

export function isTranscriptionConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}

interface DeepgramResponse {
  results?: {
    channels?: {
      alternatives?: {
        transcript?: string;
        paragraphs?: { transcript?: string };
      }[];
    }[];
  };
}

export async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  if (!isTranscriptionConfigured()) return null;
  try {
    const res = await fetch(DEEPGRAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: mediaUrl }),
    });

    if (!res.ok) {
      console.error(`[WAY][transcription] Deepgram request failed (${res.status}): ${await res.text()}`);
      return null;
    }

    const body = (await res.json()) as DeepgramResponse;
    const alt = body.results?.channels?.[0]?.alternatives?.[0];
    // Prefer the speaker-labeled, paragraph-formatted transcript when
    // diarization produced one; fall back to the plain transcript.
    const transcript = alt?.paragraphs?.transcript || alt?.transcript;
    return transcript && transcript.trim().length > 0 ? transcript : null;
  } catch (err) {
    console.error("[WAY][transcription] transcribeAudio errored", err);
    return null;
  }
}
