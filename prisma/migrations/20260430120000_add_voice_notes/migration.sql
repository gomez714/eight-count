-- CreateEnum
CREATE TYPE "AudioAssetStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('TEXT', 'VOICE');

-- DropIndex
DROP INDEX "Note_timestampMs_idx";

-- AlterTable: rename existing timestampMs column (preserves data)
ALTER TABLE "Note" RENAME COLUMN "timestampMs" TO "startTimestampMs";

-- AlterTable: add new columns and relax bodyText
ALTER TABLE "Note"
    ADD COLUMN "audioAssetId" TEXT,
    ADD COLUMN "endTimestampMs" INTEGER,
    ADD COLUMN "noteType" "NoteType" NOT NULL DEFAULT 'TEXT',
    ALTER COLUMN "bodyText" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "uploadedByUserId" TEXT NOT NULL,
    "status" "AudioAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudioAsset_rehearsalId_idx" ON "AudioAsset"("rehearsalId");

-- CreateIndex
CREATE INDEX "AudioAsset_uploadedByUserId_idx" ON "AudioAsset"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "AudioAsset_status_idx" ON "AudioAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Note_audioAssetId_key" ON "Note"("audioAssetId");

-- CreateIndex
CREATE INDEX "Note_startTimestampMs_idx" ON "Note"("startTimestampMs");

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
