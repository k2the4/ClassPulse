ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;

CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User" u
SET "departmentId" = (
  SELECT c."departmentId"
  FROM "Assignment" a
  JOIN "Subject" s ON s.id = a."subjectId"
  JOIN "Section" sec ON sec.id = s."sectionId"
  JOIN "Class" c ON c.id = sec."classId"
  WHERE a."teacherId" = u.id
  ORDER BY a."createdAt" ASC
  LIMIT 1
)
WHERE u.role = 'TEACHER' AND u."departmentId" IS NULL;
