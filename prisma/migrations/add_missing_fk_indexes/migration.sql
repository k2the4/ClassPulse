CREATE INDEX "Department_collegeId_idx" ON "Department"("collegeId");
CREATE INDEX "User_collegeId_idx" ON "User"("collegeId");
CREATE INDEX "Class_departmentId_idx" ON "Class"("departmentId");
CREATE INDEX "Class_proctorId_idx" ON "Class"("proctorId");
CREATE INDEX "AttendanceSession_subjectId_idx" ON "AttendanceSession"("subjectId");
