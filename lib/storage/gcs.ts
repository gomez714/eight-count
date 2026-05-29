import { Storage, type StorageOptions } from "@google-cloud/storage";

const bucketName = process.env.GCS_BUCKET_NAME;
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const serviceAccountJson = process.env.GCP_SA_KEY_JSON;

if (!bucketName) {
  throw new Error("GCS_BUCKET_NAME is not set");
}

if (!projectId) {
  throw new Error("GOOGLE_CLOUD_PROJECT_ID is not set");
}

const storageOptions: StorageOptions = { projectId };

if (serviceAccountJson) {
  try {
    storageOptions.credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GCP_SA_KEY_JSON is set but is not valid JSON");
  }
}

export const storage = new Storage(storageOptions);

export const gcsBucket = storage.bucket(bucketName);

// 1h is enough headroom for a 2 GB video on slow residential uplinks
// (~4 Mbps sustained). Shorter windows were dropping large mobile-Safari
// uploads mid-stream and stranding rows at status=UPLOADING.
const UPLOAD_URL_EXPIRES_IN_MS = 60 * 60 * 1000;
const READ_URL_EXPIRES_IN_MS = 60 * 60 * 1000;

type BuildRehearsalVideoObjectPathParams = {
  teamId: string;
  projectId: string;
  rehearsalId: string;
  videoAssetId: string;
  originalFileName: string;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export function buildRehearsalVideoObjectPath({
  teamId,
  projectId,
  rehearsalId,
  videoAssetId,
  originalFileName,
}: BuildRehearsalVideoObjectPathParams) {
  const safeFileName = sanitizeFileName(originalFileName || "video");

  return [
    "teams",
    teamId,
    "projects",
    projectId,
    "rehearsals",
    rehearsalId,
    "video",
    `${videoAssetId}-${safeFileName}`,
  ].join("/");
}

type BuildRehearsalAudioObjectPathParams = {
  teamId: string;
  projectId: string;
  rehearsalId: string;
  audioAssetId: string;
  originalFileName: string;
};

export function buildRehearsalAudioObjectPath({
  teamId,
  projectId,
  rehearsalId,
  audioAssetId,
  originalFileName,
}: BuildRehearsalAudioObjectPathParams) {
  const safeFileName = sanitizeFileName(originalFileName || "audio");

  return [
    "teams",
    teamId,
    "projects",
    projectId,
    "rehearsals",
    rehearsalId,
    "audio",
    `${audioAssetId}-${safeFileName}`,
  ].join("/");
}

type CreateSignedUploadUrlParams = {
  objectPath: string;
  contentType: string;
};

export async function createSignedUploadUrl({
  objectPath,
  contentType,
}: CreateSignedUploadUrlParams) {
  const file = gcsBucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_URL_EXPIRES_IN_MS,
    contentType,
  });

  return url;
}

type CreateResumableSessionParams = CreateSignedUploadUrlParams & {
  // Forwarded as the Origin header on the session-initiation request.
  // Required for browser uploads: bucket-level CORS doesn't automatically
  // apply to resumable upload sessions — GCS only emits
  // Access-Control-Allow-Origin on the chunk PUT responses if the session
  // was *initiated* with that Origin. Without this, the browser blocks
  // every chunk PUT regardless of bucket CORS. See "Video Upload Flow"
  // in CLAUDE.md.
  origin?: string | null;
};

// Session URIs from createResumableUpload are valid for 7 days (GCS default),
// far longer than any reasonable single upload window. The client uploads
// chunks directly to this URI from the browser, so the session must be
// initiated with the browser's Origin (see CreateResumableSessionParams).
export async function createResumableUploadSession({
  objectPath,
  contentType,
  origin,
}: CreateResumableSessionParams): Promise<string> {
  const file = gcsBucket.file(objectPath);
  const [sessionUri] = await file.createResumableUpload({
    metadata: { contentType },
    ...(origin ? { origin } : {}),
  });
  return sessionUri;
}

export async function createSignedReadUrl(objectPath: string) {
  const file = gcsBucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + READ_URL_EXPIRES_IN_MS,
  });

  return url;
}

export type GcsObjectMetadata = {
  exists: true;
  sizeBytes: number;
};

export type GcsObjectMissing = {
  exists: false;
};

function coerceSize(rawSize: unknown): number {
  if (typeof rawSize === "string") return Number(rawSize);
  if (typeof rawSize === "number") return rawSize;
  return 0;
}

// Used by the two-step upload `complete` routes as a defense-in-depth check
// before flipping status -> READY. Catches the case where a client calls
// `complete` after a failed/aborted PUT, which would otherwise leave the
// DB row pointing at a nonexistent GCS object.
export async function statGcsObject(
  objectPath: string
): Promise<GcsObjectMetadata | GcsObjectMissing> {
  const file = gcsBucket.file(objectPath);
  const [exists] = await file.exists();

  if (!exists) {
    return { exists: false };
  }

  const [metadata] = await file.getMetadata();

  return { exists: true, sizeBytes: coerceSize(metadata.size) };
}