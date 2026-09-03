import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const college = await prisma.college.create({ data: { name: "Demo Institute of Technology" } });

  const dept = await prisma.department.create({
    data: { name: "ECE", collegeId: college.id },
  });

  const teacher = await prisma.user.create({
    data: {
      name: "Dr. Geetanjali Sharma",
      email: "geetanjali@demo.edu",
      role: "TEACHER",
      collegeId: college.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "College Admin",
      email: "admin@demo.edu",
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

  const ece2Sem7SheetId =
    "1T9F-99yjdoe99hh16urc1eQHZuiMZuTemzXk3s9sHeY";

  await prisma.sheetLink.create({
    data: {
      sectionId: section.id,
      sheetId: ece2Sem7SheetId,
    },
  });

  await prisma.sheetLink.create({
    data: {
      subjectId: subject.id,
      sheetId: ece2Sem7SheetId,
    },
  });

  console.log("Seeded Prisma application data.");
  console.log("Create/link the demo accounts with Supabase Auth before signing in.");
  console.log(`  teacher: ${teacher.email}`);
  console.log(`  admin:   ${admin.email}`);
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
