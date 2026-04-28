-- CreateEnum
CREATE TYPE "VideoAssetStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "uploadedByUserId" TEXT NOT NULL,
    "status" "VideoAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_rehearsalId_key" ON "VideoAsset"("rehearsalId");

-- CreateIndex
CREATE INDEX "VideoAsset_uploadedByUserId_idx" ON "VideoAsset"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "VideoAsset_status_idx" ON "VideoAsset"("status");

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
