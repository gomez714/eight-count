-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ADDRESSED', 'RESOLVED');

-- CreateTable
CREATE TABLE "NoteAssignment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAssignmentStatus" (
    "id" TEXT NOT NULL,
    "noteAssignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'OPEN',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteAssignmentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteAssignment_noteId_idx" ON "NoteAssignment"("noteId");

-- CreateIndex
CREATE INDEX "NoteAssignment_userId_idx" ON "NoteAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteAssignment_noteId_userId_key" ON "NoteAssignment"("noteId", "userId");

-- CreateIndex
CREATE INDEX "NoteAssignmentStatus_userId_idx" ON "NoteAssignmentStatus"("userId");

-- CreateIndex
CREATE INDEX "NoteAssignmentStatus_status_idx" ON "NoteAssignmentStatus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NoteAssignmentStatus_noteAssignmentId_userId_key" ON "NoteAssignmentStatus"("noteAssignmentId", "userId");

-- AddForeignKey
ALTER TABLE "NoteAssignment" ADD CONSTRAINT "NoteAssignment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAssignment" ADD CONSTRAINT "NoteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAssignmentStatus" ADD CONSTRAINT "NoteAssignmentStatus_noteAssignmentId_fkey" FOREIGN KEY ("noteAssignmentId") REFERENCES "NoteAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAssignmentStatus" ADD CONSTRAINT "NoteAssignmentStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAssignmentStatus" ADD CONSTRAINT "NoteAssignmentStatus_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
