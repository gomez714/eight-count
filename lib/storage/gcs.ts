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

const UPLOAD_URL_EXPIRES_IN_MS = 15 * 60 * 1000;
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

export async function createSignedReadUrl(objectPath: string) {
  const file = gcsBucket.file(objectPath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + READ_URL_EXPIRES_IN_MS,
  });

  return url;
}