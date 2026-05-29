/**
 * Resumable chunked uploader for GCS resumable upload sessions.
 *
 * The browser PUTs `chunkSize`-byte chunks directly to the session URI
 * returned by the server's /upload-session route. Each chunk PUT is its
 * own request, so a network blip kills a single chunk rather than the
 * whole transfer — failed chunks retry with exponential backoff, and
 * GCS holds the partial state behind the session URI for ~7 days.
 *
 * Progress is reported continuously via XMLHttpRequest's
 * `upload.onprogress` (fetch can't surface PUT body progress), smoothed
 * across chunk boundaries so the UI doesn't jump.
 *
 * Cancellation is via AbortSignal: aborting mid-chunk fires `xhr.abort()`
 * and surfaces an UploadAbortedError to the caller. The DB row stays at
 * UPLOADING and is cleaned up by `npm run db:reap-stale-uploads` after
 * the 24 h threshold.
 *
 * Cross-session resume (closing the tab and picking up where you left
 * off on the next load) is deliberately deferred — the protocol supports
 * it via `Content-Range: bytes * /{total}` status queries, but the UX of
 * "where to store the in-progress session URI" is enough surface to be
 * its own PR.
 */

// 8 MiB chunks. Trades sub-chunk progress granularity (XHR.upload.onprogress
// fills the gap between chunks anyway) for fewer HTTP round-trips and GCS's
// recommended per-chunk size. Must be a multiple of 256 KiB per GCS spec for
// non-final chunks; 8 MiB = 32 × 256 KiB.
export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

const MAX_RETRIES_PER_CHUNK = 3;
const BACKOFF_BASE_MS = 1000;

export type UploadProgress = {
  uploaded: number;
  total: number;
  percent: number;
  bytesPerSec: number;
};

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadAbortedError";
  }
}

export class UploadSessionExpiredError extends Error {
  constructor() {
    super("Upload session expired. Please try again.");
    this.name = "UploadSessionExpiredError";
  }
}

export class UploadNetworkError extends Error {
  constructor(message = "Network error during upload") {
    super(message);
    this.name = "UploadNetworkError";
  }
}

type UploadResumableParams = {
  sessionUri: string;
  file: Blob;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export async function uploadResumable({
  sessionUri,
  file,
  chunkSize = DEFAULT_CHUNK_SIZE,
  signal,
  onProgress,
}: UploadResumableParams): Promise<void> {
  const total = file.size;

  if (total === 0) {
    throw new Error("Cannot upload an empty file.");
  }

  const startedAt = performance.now();
  let committedBytes = 0;

  const reportProgress = (extraInCurrentChunk: number) => {
    if (!onProgress) return;
    const uploaded = Math.min(total, committedBytes + extraInCurrentChunk);
    const elapsedSec = (performance.now() - startedAt) / 1000;
    onProgress({
      uploaded,
      total,
      percent: total > 0 ? (uploaded / total) * 100 : 0,
      bytesPerSec: elapsedSec > 0 ? uploaded / elapsedSec : 0,
    });
  };

  // initial paint at 0% so the UI doesn't sit at "Uploading..." with no bar
  reportProgress(0);

  while (committedBytes < total) {
    throwIfAborted(signal);

    const chunkEnd = Math.min(committedBytes + chunkSize, total);
    const chunk = file.slice(committedBytes, chunkEnd);

    const result = await putChunkWithRetry({
      sessionUri,
      chunk,
      start: committedBytes,
      end: chunkEnd - 1,
      total,
      signal,
      onChunkProgress: (loaded) => reportProgress(loaded),
    });

    if (result.kind === "done") {
      committedBytes = total;
      reportProgress(0);
      return;
    }

    committedBytes = result.committedThrough + 1;
    reportProgress(0);
  }
}

type ChunkResult =
  | { kind: "done" }
  | { kind: "partial"; committedThrough: number };

type PutChunkParams = {
  sessionUri: string;
  chunk: Blob;
  start: number;
  end: number;
  total: number;
  signal?: AbortSignal;
  onChunkProgress: (loaded: number) => void;
};

async function putChunkWithRetry(params: PutChunkParams): Promise<ChunkResult> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES_PER_CHUNK; attempt++) {
    throwIfAborted(params.signal);

    try {
      return await putChunk(params);
    } catch (err) {
      // Fatal errors: no retry.
      if (err instanceof UploadAbortedError) throw err;
      if (err instanceof UploadSessionExpiredError) throw err;

      lastError = err;

      // Linear-ish exponential backoff: 1s, 2s, 4s. Aborts surface
      // immediately via the signal.
      const isLastAttempt = attempt === MAX_RETRIES_PER_CHUNK - 1;
      if (!isLastAttempt) {
        await delay(BACKOFF_BASE_MS * 2 ** attempt, params.signal);
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new UploadNetworkError("Upload failed after retries");
}

function putChunk(params: PutChunkParams): Promise<ChunkResult> {
  const { sessionUri, chunk, start, end, total, signal, onChunkProgress } =
    params;

  return new Promise<ChunkResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let abortListener: (() => void) | null = null;

    const cleanup = () => {
      if (abortListener && signal) {
        signal.removeEventListener("abort", abortListener);
      }
    };

    if (signal) {
      if (signal.aborted) {
        reject(new UploadAbortedError());
        return;
      }
      abortListener = () => xhr.abort();
      signal.addEventListener("abort", abortListener, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onChunkProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      cleanup();
      const status = xhr.status;

      // 200/201: full upload finalized.
      if (status === 200 || status === 201) {
        resolve({ kind: "done" });
        return;
      }

      // 308: chunk accepted, more to come. The `Range` header tells us
      // exactly how much GCS committed (in case the connection dropped
      // partway and the last few bytes never landed).
      if (status === 308) {
        const rangeHeader = xhr.getResponseHeader("Range");
        const committedThrough = parseRangeEnd(rangeHeader) ?? end;
        resolve({ kind: "partial", committedThrough });
        return;
      }

      // 404/410: session expired or never existed. Not retryable.
      if (status === 404 || status === 410) {
        reject(new UploadSessionExpiredError());
        return;
      }

      reject(
        new UploadNetworkError(`Upload chunk failed (HTTP ${status})`)
      );
    };

    xhr.onerror = () => {
      cleanup();
      reject(new UploadNetworkError("Network error during chunk upload."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new UploadNetworkError("Chunk upload timed out."));
    };

    xhr.open("PUT", sessionUri, true);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    xhr.send(chunk);
  });
}

// GCS Range header for resumable uploads: "bytes=0-{lastCommittedByte}".
// Returns the index of the last committed byte, or null if the header is
// missing/malformed (in which case the caller falls back to the chunk end).
function parseRangeEnd(header: string | null): number | null {
  if (!header) return null;
  const match = /bytes=(\d+)-(\d+)/.exec(header);
  if (!match) return null;
  const parsed = Number(match[2]);
  return Number.isFinite(parsed) ? parsed : null;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new UploadAbortedError();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      reject(new UploadAbortedError());
    }

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeout);
        reject(new UploadAbortedError());
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
