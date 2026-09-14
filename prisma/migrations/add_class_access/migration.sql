CREATE TABLE "ClassAccess" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassAccess_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassAccess_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassAccess_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassAccess_teacherId_classId_key" UNIQUE ("teacherId", "classId")
);
CREATE INDEX "ClassAccess_classId_idx" ON "ClassAccess"("classId");
CREATE INDEX "ClassAccess_teacherId_idx" ON "ClassAccess"("teacherId");
