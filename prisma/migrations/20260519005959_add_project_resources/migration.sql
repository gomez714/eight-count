-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('LINK');

-- CreateTable
CREATE TABLE "ProjectResource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rehearsalId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL DEFAULT 'LINK',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectResource_projectId_createdAt_idx" ON "ProjectResource"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectResource_rehearsalId_idx" ON "ProjectResource"("rehearsalId");

-- CreateIndex
CREATE INDEX "ProjectResource_createdByUserId_idx" ON "ProjectResource"("createdByUserId");

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
