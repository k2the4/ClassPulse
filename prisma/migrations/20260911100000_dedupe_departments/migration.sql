-- Keep the oldest department for each college/name pair and move its classes there.
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY "collegeId", "name" ORDER BY "createdAt", id) AS keeper_id,
    ROW_NUMBER() OVER (PARTITION BY "collegeId", "name" ORDER BY "createdAt", id) AS row_number
  FROM "Department"
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
    ROW_NUMBER() OVER (PARTITION BY "collegeId", "name" ORDER BY "createdAt", id) AS row_number
  FROM "Department"
)
DELETE FROM "Department" AS d
USING ranked AS r
WHERE d.id = r.id
  AND r.row_number > 1;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_collegeId_name_key" UNIQUE ("collegeId", "name");
