CREATE TABLE "StudentAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "enrollmentNo" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "authUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentAccount_email_key" ON "StudentAccount"("email");
CREATE UNIQUE INDEX "StudentAccount_enrollmentNo_key" ON "StudentAccount"("enrollmentNo");
CREATE UNIQUE INDEX "StudentAccount_authUserId_key" ON "StudentAccount"("authUserId");
CREATE INDEX "StudentAccount_collegeId_idx" ON "StudentAccount"("collegeId");
