import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type SubjectSeed = { name: string; code: string };

const prisma = new PrismaClient();

const subjectsBySemester: Record<number, SubjectSeed[]> = {
  1: [
    { name: "Environmental Studies", code: "SEM1-ENVIRONMENTAL-STUDIES" },
    { name: "Engineering Graphics-I", code: "SEM1-ENGINEERING-GRAPHICS-I" },
    { name: "Manufacturing Process", code: "SEM1-MANUFACTURING-PROCESS" },
    { name: "Communications Skills", code: "SEM1-COMMUNICATIONS-SKILLS" },
    { name: "Applied Mathematics-I", code: "SEM1-APPLIED-MATHEMATICS-I" },
    { name: "Applied Physics-I", code: "SEM1-APPLIED-PHYSICS-I" },
    { name: "Programming in C", code: "SEM1-PROGRAMMING-IN-C" },
  ],
  2: [
    { name: "Applied Chemistry", code: "SEM2-APPLIED-CHEMISTRY" },
    { name: "Applied Physics-II", code: "SEM2-APPLIED-PHYSICS-II" },
    { name: "Electrical Science", code: "SEM2-ELECTRICAL-SCIENCE" },
    { name: "Applied Mathematics-II", code: "SEM2-APPLIED-MATHEMATICS-II" },
    { name: "Engineering Mechanics", code: "SEM2-ENGINEERING-MECHANICS" },
    { name: "Indian Constitution", code: "SEM2-INDIAN-CONSTITUTION" },
    { name: "Human Values and Ethics", code: "SEM2-HUMAN-VALUES-AND-ETHICS" },
  ],
  3: [
    { name: "Computational Methods", code: "SEM3-COMPUTATIONAL-METHODS" },
    { name: "Indian Knowledge System", code: "SEM3-INDIAN-KNOWLEDGE-SYSTEM" },
    { name: "Signal and System", code: "SEM3-SIGNAL-AND-SYSTEM" },
    { name: "Digital Logic and Computer Design", code: "SEM3-DIGITAL-LOGIC-AND-COMPUTER-DESIGN" },
    { name: "Analog Communications", code: "SEM3-ANALOG-COMMUNICATIONS" },
    { name: "Analog Electronics-I", code: "SEM3-ANALOG-ELECTRONICS-I" },
  ],
  4: [
    { name: "Probability, Statistics and Linear Programming", code: "SEM4-PSLP" },
    { name: "Technical Writing", code: "SEM4-TECHNICAL-WRITING" },
    { name: "Network Analysis and Synthesis", code: "SEM4-NAS" },
    { name: "Microprocessors and Microcontrollers", code: "SEM4-MICROPROCESSORS-AND-MICROCONTROLLERS" },
    { name: "Digital Communications", code: "SEM4-DIGITAL-COMMUNICATIONS" },
    { name: "Analog Electronics-II", code: "SEM4-ANALOG-ELECTRONICS-II" },
    { name: "Electromagnetic Field Theory", code: "SEM4-EMFT" },
  ],
  5: [
    { name: "Economics for Engineers", code: "SEM5-ECONOMICS-FOR-ENGINEERS" },
    { name: "Digital Signal Processing", code: "SEM5-DSP" },
    { name: "Microelectronics", code: "SEM5-MICROELECTRONICS" },
    { name: "Introduction to Control Systems", code: "SEM5-INTRODUCTION-TO-CONTROL-SYSTEMS" },
    { name: "Transmission Lines, Waveguides and Antenna Design", code: "SEM5-TLWAD" },
    { name: "Data Communication and Networking", code: "SEM5-DCN" },
  ],
  6: [
    { name: "PME", code: "MS-302" },
    { name: "AI", code: "ECE 318 T" },
    { name: "OCSN", code: "ECE 326 T" },
    { name: "ML", code: "ECE 350 T" },
    { name: "SSM&DA", code: "DA 304 T" },
    { name: "DA", code: "DA 338 T" },
  ],
  7: [
    { name: "MLDA", code: "MLDA" },
    { name: "IOT", code: "IOT" },
    { name: "PR", code: "PR" },
    { name: "USL", code: "USL" },
    { name: "SL", code: "SL" },
    { name: "PE", code: "PE" },
  ],
};

const eceBatches = ["ECE 1", "ECE 2", "ECE E"];

function yearForSemester(semester: number) {
  if (semester <= 2) return "1st Year";
  if (semester <= 4) return "2nd Year";
  if (semester <= 6) return "3rd Year";
  return "4th Year";
}

async function main() {
  const college = await prisma.college.upsert({
    where: { id: "demo-college" },
    update: { name: "Demo Institute of Technology" },
    create: { id: "demo-college", name: "Demo Institute of Technology" },
  });

  const eceDepartment =
    (await prisma.department.findFirst({ where: { collegeId: college.id, name: "ECE" } })) ??
    (await prisma.department.create({ data: { name: "ECE", collegeId: college.id } }));

  const passwordHash = await bcrypt.hash("changeme123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "geetanjali@demo.edu" },
    update: { name: "Dr. Geetanjali", passwordHash, role: "TEACHER", collegeId: college.id },
    create: {
      name: "Dr. Geetanjali",
      email: "geetanjali@demo.edu",
      passwordHash,
      role: "TEACHER",
      collegeId: college.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@demo.edu" },
    update: { name: "College Admin", passwordHash, role: "ADMIN", collegeId: college.id },
    create: {
      name: "College Admin",
      email: "admin@demo.edu",
      passwordHash,
      role: "ADMIN",
      collegeId: college.id,
    },
  });

  for (const batch of eceBatches) {
    for (let semester = 1; semester <= 7; semester += 1) {
      const program = `B.Tech ${batch}`;
      const isLegacyEce2Sem7 = batch === "ECE 2" && semester === 7;

      const cls =
        (await prisma.class.findFirst({
          where: {
            departmentId: eceDepartment.id,
            academicYear: "2026-27",
            semester,
            OR: [
              { program },
              ...(isLegacyEce2Sem7 ? [{ program: "B.Tech ECE" }] : []),
            ],
          },
        })) ??
        (await prisma.class.create({
          data: {
            departmentId: eceDepartment.id,
            program,
            academicYear: "2026-27",
            year: yearForSemester(semester),
            semester,
            proctorId: semester === 7 && batch === "ECE 2" ? teacher.id : null,
          },
        }));

      if (cls.program !== program || cls.year !== yearForSemester(semester)) {
        await prisma.class.update({
          where: { id: cls.id },
          data: {
            program,
            year: yearForSemester(semester),
            proctorId: semester === 7 && batch === "ECE 2" ? teacher.id : cls.proctorId,
          },
        });
      }

      const section =
        (await prisma.section.findFirst({ where: { classId: cls.id, name: "A" } })) ??
        (await prisma.section.create({
          data: {
            classId: cls.id,
            name: "A",
            strength: batch === "ECE 2" && semester === 7 ? 65 : 0,
          },
        }));

      if (batch === "ECE 2" && semester === 7 && section.strength !== 65) {
        await prisma.section.update({ where: { id: section.id }, data: { strength: 65 } });
      }

      for (const subject of subjectsBySemester[semester]) {
        const existing = await prisma.subject.findFirst({
          where: { sectionId: section.id, code: subject.code },
        });
        if (!existing) {
          await prisma.subject.create({
            data: { name: subject.name, code: subject.code, sectionId: section.id },
          });
        }
      }
    }
  }

  // Dr. Geetanjali gets exactly six classes from Semesters 1, 3, 5 and 7.
  // One subject is assigned in each selected class for the class/subject selector.
  const teacherClassAssignments = [
    { batch: "ECE 1", semester: 1, subjectIndex: 0 },
    { batch: "ECE E", semester: 1, subjectIndex: 4 },
    { batch: "ECE 2", semester: 3, subjectIndex: 3 },
    { batch: "ECE 1", semester: 5, subjectIndex: 1 },
    { batch: "ECE E", semester: 5, subjectIndex: 4 },
    { batch: "ECE 2", semester: 7, subjectIndex: 5 },
  ];

  for (const item of teacherClassAssignments) {
    const cls = await prisma.class.findFirst({
      where: {
        departmentId: eceDepartment.id,
        program: `B.Tech ${item.batch}`,
        academicYear: "2026-27",
        semester: item.semester,
      },
    });
    if (!cls) continue;

    const section = await prisma.section.findFirst({
      where: { classId: cls.id, name: "A" },
    });
    const subjectSeed = subjectsBySemester[item.semester][item.subjectIndex];
    if (!section || !subjectSeed) continue;

    const subject = await prisma.subject.findFirst({
      where: { sectionId: section.id, code: subjectSeed.code },
    });
    if (!subject) continue;

    await prisma.assignment.upsert({
      where: { teacherId_subjectId: { teacherId: teacher.id, subjectId: subject.id } },
      update: {},
      create: { teacherId: teacher.id, subjectId: subject.id },
    });
  }

  // Preserve the existing ECE 2 / Sem 7 / Section A demo SheetLinks.
  const demoClass = await prisma.class.findFirst({
    where: {
      departmentId: eceDepartment.id,
      program: "B.Tech ECE 2",
      academicYear: "2026-27",
      semester: 7,
    },
  });
  const demoSection = demoClass
    ? await prisma.section.findFirst({ where: { classId: demoClass.id, name: "A" } })
    : null;

  if (demoSection) {
    const daSubject = await prisma.subject.findFirst({
      where: { sectionId: demoSection.id, code: "DA 338 T" },
    });
    if (daSubject) {
      await prisma.assignment.upsert({
        where: { teacherId_subjectId: { teacherId: teacher.id, subjectId: daSubject.id } },
        update: {},
        create: { teacherId: teacher.id, subjectId: daSubject.id },
      });
      await prisma.sheetLink.upsert({
        where: { subjectId: daSubject.id },
        update: {},
        create: { subjectId: daSubject.id, sheetId: "118662A6Ifl2GDZKnh120v2jNylUiMWGNYThfRXSDX6U" },
      });
    }
    await prisma.sheetLink.upsert({
      where: { sectionId: demoSection.id },
      update: {},
      create: { sectionId: demoSection.id, sheetId: "1DM3brNxfdWl0I4r9cbffjh_PlXaWaTsM" },
    });
  }

  console.log("Seed complete.");
  console.log("Created/updated ECE 1, ECE 2 and ECE E for Semesters 1-7.");
  console.log("Assigned Dr. Geetanjali to 6 classes from Semesters 1, 3, 5 and 7.");
  console.log("Semester 8 intentionally has no subjects; labs are excluded.");
  console.log("Login: geetanjali@demo.edu / changeme123");
  console.log("Admin: admin@demo.edu / changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
