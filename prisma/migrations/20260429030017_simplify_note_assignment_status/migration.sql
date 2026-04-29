/*
  Warnings:

  - You are about to drop the column `userId` on the `NoteAssignmentStatus` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[noteAssignmentId]` on the table `NoteAssignmentStatus` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "NoteAssignmentStatus" DROP CONSTRAINT "NoteAssignmentStatus_userId_fkey";

-- DropIndex
DROP INDEX "NoteAssignmentStatus_noteAssignmentId_userId_key";

-- DropIndex
DROP INDEX "NoteAssignmentStatus_userId_idx";

-- AlterTable
ALTER TABLE "NoteAssignmentStatus" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "NoteAssignmentStatus_noteAssignmentId_key" ON "NoteAssignmentStatus"("noteAssignmentId");
