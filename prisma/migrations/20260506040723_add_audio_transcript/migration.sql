-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "AudioAsset" ADD COLUMN     "transcribedAt" TIMESTAMP(3),
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "transcriptError" TEXT,
ADD COLUMN     "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "AudioAsset_transcriptStatus_idx" ON "AudioAsset"("transcriptStatus");
