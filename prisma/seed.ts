import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SubjectSeed = {
  name: string;
  code: string;
};

// These are the theory subjects supplied for the ECE curriculum.
// Labs are intentionally excluded for now.
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
    // The timetable supplied identifies these by these abbreviations only.
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

  const dept = await prisma.department.findFirst({
    where: { collegeId: college.id, name: "ECE" },
  });

  const eceDepartment =
    dept ??
    (await prisma.department.create({
      data: { name: "ECE", collegeId: college.id },
    }));

  const passwordHash = await bcrypt.hash("changeme123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "geetanjali@demo.edu" },
    update: {
      name: "Dr. Geetanjali",
      passwordHash,
      role: "TEACHER",
      collegeId: college.id,
    },
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
    update: {
      name: "College Admin",
      passwordHash,
      role: "ADMIN",
      collegeId: college.id,
    },
    create: {
      name: "College Admin",
      email: "admin@demo.edu",
      passwordHash,
      role: "ADMIN",
      collegeId: college.id,
    },
  });

  // Create all three ECE batches for Semesters 1-7.
  // Semester 8 intentionally has no regular subjects.
  for (const batch of eceBatches) {
    for (let semester = 1; semester <= 7; semester += 1) {
      const existingClass = await prisma.class.findFirst({
        where: {
          departmentId: eceDepartment.id,
          program: `B.Tech ${batch}`,
          academicYear: "2026-27",
          semester,
        },
      });

      const cls =
        existingClass ??
        (await prisma.class.create({
          data: {
            departmentId: eceDepartment.id,
            program: `B.Tech ${batch}`,
            academicYear: "2026-27",
            year: yearForSemester(semester),
            semester,
            proctorId: semester === 7 && batch === "ECE 2" ? teacher.id : null,
          },
        }));

      const existingSection = await prisma.section.findFirst({
        where: { classId: cls.id, name: "A" },
      });

      const section =
        existingSection ??
        (await prisma.section.create({
          data: {
            classId: cls.id,
            name: "A",
            strength: batch === "ECE 2" && semester === 7 ? 65 : 0,
          },
        }));

      for (const subject of subjectsBySemester[semester]) {
        const existingSubject = await prisma.subject.findFirst({
          where: { sectionId: section.id, code: subject.code },
        });

        if (!existingSubject) {
          await prisma.subject.create({
            data: {
              name: subject.name,
              code: subject.code,
              sectionId: section.id,
            },
          });
        }
      }
    }
  }

  // Keep the existing ECE 2 Sem 7 / Section A demo data and its sheet links.
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
    await prisma.section.update({
      where: { id: demoSection.id },
      data: { strength: 65 },
    });

    const daSubject = await prisma.subject.findFirst({
      where: { sectionId: demoSection.id, code: "DA 338 T" },
    });

    if (daSubject) {
      const assignment = await prisma.assignment.findFirst({
        where: { teacherId: teacher.id, subjectId: daSubject.id },
      });

      if (!assignment) {
        await prisma.assignment.create({
          data: { teacherId: teacher.id, subjectId: daSubject.id },
        });
      }

      const subjectSheet = await prisma.sheetLink.findFirst({
        where: { subjectId: daSubject.id },
      });

      if (!subjectSheet) {
        await prisma.sheetLink.create({
          data: {
            subjectId: daSubject.id,
            sheetId: "118662A6Ifl2GDZKnh120v2jNylUiMWGNYThfRXSDX6U",
          },
        });
      }
    }

    const sectionSheet = await prisma.sheetLink.findFirst({
      where: { sectionId: demoSection.id },
    });

    if (!sectionSheet) {
      await prisma.sheetLink.create({
        data: {
          sectionId: demoSection.id,
          sheetId: "1DM3brNxfdWl0I4r9cbffjh_PlXaWaTsM",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Created/updated ECE 1, ECE 2 and ECE E for Semesters 1-7.");
  console.log("Semester 8 intentionally has no subjects.");
  console.log("Labs are intentionally excluded.");
  console.log("Login as: geetanjali@demo.edu / changeme123");
  console.log("Admin: admin@demo.edu / changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
