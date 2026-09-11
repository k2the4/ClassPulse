-- Keep the duplicate department currently used by the most classes.
-- Ties fall back to the oldest department, then id, so existing class references
-- are consolidated onto the department that is already in use.
WITH ranked AS (
  SELECT
    d.id,
    FIRST_VALUE(d.id) OVER (
      PARTITION BY d."collegeId", d."name"
      ORDER BY (SELECT COUNT(*) FROM "Class" c WHERE c."departmentId" = d.id) DESC, d."createdAt", d.id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY d."collegeId", d."name"
      ORDER BY (SELECT COUNT(*) FROM "Class" c WHERE c."departmentId" = d.id) DESC, d."createdAt", d.id
    ) AS row_number
  FROM "Department" d
), duplicates AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE row_number > 1
)
UPDATE "Class" AS c
SET "departmentId" = d.keeper_id
FROM duplicates AS d
WHERE c."departmentId" = d.id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "collegeId", "name"
      ORDER BY (SELECT COUNT(*) FROM "Class" c WHERE c."departmentId" = "Department".id) DESC, "createdAt", id
    ) AS row_number
  FROM "Department"
)
DELETE FROM "Department" AS d
USING ranked AS r
WHERE d.id = r.id
  AND r.row_number > 1;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_collegeId_name_key" UNIQUE ("collegeId", "name");
