import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const college = await prisma.college.create({ data: { name: "Demo Institute of Technology" });

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

  await prisma.user.create({
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

  // ClassPulse's teacher-facing identity is ECE 2 Sem 7. The existing
  // Section model remains an internal storage boundary; "2" is the class
  // number here, not a user-facing "Section A" label.
  const section = await prisma.section.create({
    data: { classId: cls.id, name: "2", strength: 65 },
  });

  const subjects = [
    { code: "MLDA", name: "Machine Learning and Data Analytics Frameworks" },
    { code: "IOT", name: "Internet of Things" },
    { code: "PR", name: "Pattern Recognition" },
    { code: "PE", name: "Principles of Entrepreneurship" },
    { code: "USL", name: "Unsupervised Learning" },
    { code: "SL", name: "Supervised and Deep Learning" },
  ];

  for (const subject of subjects) {
    const created = await prisma.subject.create({
      data: { ...subject, sectionId: section.id },
    });

    await prisma.assignment.create({
      data: { teacherId: teacher.id, subjectId: created.id },
    });
  }

  // ECE 2 Sem 7 combined sheet. Subject and class analysis both resolve
  // through this section-level link, so the old Sem 6 sheet is not used.
  const ece2Sem7SheetId =
    "1T9F-99yjdoe99hh16urc1eQHZuiMZuTemzXk3s9sHeY";

  await prisma.sheetLink.create({
    data: {
      sectionId: section.id,
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
