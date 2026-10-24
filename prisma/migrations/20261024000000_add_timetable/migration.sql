CREATE TABLE "TimetableEntry" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "teacherId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "room" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TimetableEntry_sectionId_dayOfWeek_startTime_idx" ON "TimetableEntry"("sectionId", "dayOfWeek", "startTime");
CREATE INDEX "TimetableEntry_teacherId_dayOfWeek_startTime_idx" ON "TimetableEntry"("teacherId", "dayOfWeek", "startTime");
CREATE INDEX "TimetableEntry_subjectId_idx" ON "TimetableEntry"("subjectId");