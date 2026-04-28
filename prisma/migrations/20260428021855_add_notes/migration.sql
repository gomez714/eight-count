-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "timestampMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_rehearsalId_idx" ON "Note"("rehearsalId");

-- CreateIndex
CREATE INDEX "Note_videoAssetId_idx" ON "Note"("videoAssetId");

-- CreateIndex
CREATE INDEX "Note_authorUserId_idx" ON "Note"("authorUserId");

-- CreateIndex
CREATE INDEX "Note_timestampMs_idx" ON "Note"("timestampMs");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
