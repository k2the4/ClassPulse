/*
  Warnings:

  - A unique constraint covering the columns `[sectionId]` on the table `SheetLink` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "AnalysisSnapshot" DROP CONSTRAINT "AnalysisSnapshot_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "SheetLink" DROP CONSTRAINT "SheetLink_subjectId_fkey";

-- AlterTable
ALTER TABLE "AnalysisSnapshot" ADD COLUMN     "sectionId" TEXT,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SheetLink" ADD COLUMN     "sectionId" TEXT,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AnalysisSnapshot_sectionId_computedAt_idx" ON "AnalysisSnapshot"("sectionId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SheetLink_sectionId_key" ON "SheetLink"("sectionId");

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSnapshot" ADD CONSTRAINT "AnalysisSnapshot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
