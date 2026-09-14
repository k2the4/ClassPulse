CREATE TYPE "SubjectType" AS ENUM ('THEORY', 'LAB');

ALTER TABLE "Subject" ADD COLUMN "type" "SubjectType" NOT NULL DEFAULT 'THEORY';
