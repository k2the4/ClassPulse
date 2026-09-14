-- Keep the duplicate department currently used by the most classes.
-- Ties fall back to the oldest department, then id, so existing class references
-- are consolidated onto the department that is already in use.
WITH class_counts AS (
  SELECT d.id, COUNT(c.id) AS class_count
  FROM "Department" AS d
  LEFT JOIN "Class" AS c ON c."departmentId" = d.id
  GROUP BY d.id
), ranked AS (
  SELECT
    d.id,
    FIRST_VALUE(d.id) OVER (
      PARTITION BY d."collegeId", d."name"
      ORDER BY cc.class_count DESC, d."createdAt", d.id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY d."collegeId", d."name"
      ORDER BY cc.class_count DESC, d."createdAt", d.id
    ) AS row_number
  FROM "Department" AS d
  JOIN class_counts AS cc ON cc.id = d.id
), duplicates AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE row_number > 1
)
UPDATE "Class" AS c
SET "departmentId" = d.keeper_id
FROM duplicates AS d
WHERE c."departmentId" = d.id;

WITH class_counts AS (
  SELECT d.id, COUNT(c.id) AS class_count
  FROM "Department" AS d
  LEFT JOIN "Class" AS c ON c."departmentId" = d.id
  GROUP BY d.id
), ranked AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d."collegeId", d."name"
      ORDER BY cc.class_count DESC, d."createdAt", d.id
    ) AS row_number
  FROM "Department" AS d
  JOIN class_counts AS cc ON cc.id = d.id
)
DELETE FROM "Department" AS d
USING ranked AS r
WHERE d.id = r.id
  AND r.row_number > 1;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_collegeId_name_key" UNIQUE ("collegeId", "name");
