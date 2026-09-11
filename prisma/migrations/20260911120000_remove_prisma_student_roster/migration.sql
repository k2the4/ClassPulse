-- Student roster data is maintained in the linked Google Sheets.
-- Remove the duplicate Prisma roster so the application has one source of truth.
DELETE FROM "AttendanceRecord";
DELETE FROM "Student";
