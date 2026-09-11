-- A teacher has at most one Class Analysis class.
-- Preserve the most recently created access row when old data contains duplicates.
DELETE FROM "ClassAccess" a
USING "ClassAccess" newer
WHERE a."teacherId" = newer."teacherId"
  AND (a."createdAt" < newer."createdAt" OR (a."createdAt" = newer."createdAt" AND a.id < newer.id));

CREATE UNIQUE INDEX "ClassAccess_teacherId_key" ON "ClassAccess"("teacherId");
