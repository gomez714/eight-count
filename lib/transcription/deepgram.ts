/**
 * Deepgram pre-recorded transcription client.
 *
 * Single function: `transcribeFromUrl` — POSTs a signed URL to Deepgram's
 * /v1/listen endpoint and returns the transcript string. Deepgram fetches
 * the audio itself, so we never have to download + re-upload bytes from
 * our server.
 */

const DEEPGRAM_ENDPOINT = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_TIMEOUT_MS = 30_000;

type TranscribeFromUrlParams = {
  signedUrl: string;
};

type DeepgramResponse = {
  metadata?: unknown;
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
};

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

/**
 * Transcribe an audio file by passing Deepgram a signed URL it can fetch.
 * Throws `TranscriptionError` on any failure path; callers (`run.ts`)
 * should catch and persist the error to the AudioAsset row.
 */
export async function transcribeFromUrl({
  signedUrl,
}: TranscribeFromUrlParams): Promise<{ transcript: string }> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      // Loud log so this shows up in prod observability — the row will
      // still be marked FAILED gracefully by run.ts, but ops needs to know.
      console.error(
        "[transcription] DEEPGRAM_API_KEY is not set in production. Voice-note transcription is disabled."
      );
    }
    throw new TranscriptionError("DEEPGRAM_API_KEY is not set");
  }

  const url = new URL(DEEPGRAM_ENDPOINT);
  url.searchParams.set("model", process.env.DEEPGRAM_MODEL ?? "nova-3");
  url.searchParams.set("language", "en");
  url.searchParams.set("smart_format", "true");
  // Opt out of Deepgram's Model Improvement Program. Without this flag,
  // submitted audio can be retained and used to train Deepgram's models —
  // which would conflict with the /privacy commitment that voice
  // recordings aren't used for AI training. Audio for opted-out requests
  // is retained only for the duration needed to process the request.
  url.searchParams.set("mip_opt_out", "true");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signedUrl }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TranscriptionError("Deepgram request timed out");
    }
    throw new TranscriptionError(
      "Network error contacting Deepgram",
      error
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new TranscriptionError(
      `Deepgram returned ${response.status}: ${bodyText.slice(0, 300)}`
    );
  }

  let payload: DeepgramResponse;
  try {
    payload = (await response.json()) as DeepgramResponse;
  } catch (error) {
    throw new TranscriptionError("Deepgram returned non-JSON response", error);
  }

  const transcript =
    payload.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (typeof transcript !== "string") {
    throw new TranscriptionError(
      "Deepgram response missing transcript field"
    );
  }

  return { transcript };
}
