import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const college = await prisma.college.create({ data: { name: "Demo Institute of Technology" } });

  const dept = await prisma.department.create({
    data: { name: "ECE", collegeId: college.id },
  });

  const passwordHash = await bcrypt.hash("changeme123", 10);

  const teacher = await prisma.user.create({
    data: {
      name: "Dr. Geetanjali",
      email: "geetanjali@demo.edu",
      passwordHash,
      role: "TEACHER",
      collegeId: college.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "College Admin",
      email: "admin@demo.edu",
      passwordHash,
      role: "ADMIN",
      collegeId: college.id,
    },
  });

  const cls = await prisma.class.create({
    data: {
      departmentId: dept.id,
      program: "B.Tech ECE",
      academicYear: "2026-27",
      year: "4th Year",
      semester: 7,
      proctorId: teacher.id,
    },
  });

  const section = await prisma.section.create({
    data: { classId: cls.id, name: "A", strength: 65 },
  });

  const subject = await prisma.subject.create({
    data: { name: "Data Analysis", code: "DA 338 T", sectionId: section.id },
  });

  await prisma.assignment.create({
    data: { teacherId: teacher.id, subjectId: subject.id },
  });

  // ECE 2 Sem 7 combined section sheet. Subject Analysis prefers this
  // section-level link, so all subjects read from the same current sheet.
  const ece2Sem7SheetId =
    "1T9F-99yjdoe99hh16urc1eQHZuiMZuTemzXk3s9sHeY";

  await prisma.sheetLink.create({
    data: {
      sectionId: section.id,
      sheetId: ece2Sem7SheetId,
    },
  });

  // Keep the optional subject-level link aligned with the same current
  // proof-of-concept sheet rather than leaving the old sheet configured.
  await prisma.sheetLink.create({
    data: {
      subjectId: subject.id,
      sheetId: ece2Sem7SheetId,
    },
  });

  console.log("Seeded. Login as:");
  console.log("  teacher: geetanjali@demo.edu / changeme123");
  console.log("  admin:   admin@demo.edu / changeme123");
  console.log("");
  console.log("ECE 2 Sem 7 sheet:");
  console.log(ece2Sem7SheetId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
