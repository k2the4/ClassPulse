import { PrismaClient, Role, SubjectType } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS = [
  { code: "DA301", name: "Data Analytics", type: SubjectType.THEORY },
  { code: "DB302", name: "Database Systems", type: SubjectType.THEORY },
  { code: "CN303", name: "Computer Networks", type: SubjectType.THEORY },
  { code: "OS304", name: "Operating Systems", type: SubjectType.THEORY },
  { code: "DA305L", name: "Data Analytics Lab", type: SubjectType.LAB },
];

const TEACHERS = [
  { name: "Aarav Sharma", email: "aarav.sharma@demo.classpulse.local" },
  { name: "Diya Mehta", email: "diya.mehta@demo.classpulse.local" },
  { name: "Kabir Singh", email: "kabir.singh@demo.classpulse.local" },
  { name: "Ananya Gupta", email: "ananya.gupta@demo.classpulse.local" },
  { name: "Rohan Verma", email: "rohan.verma@demo.classpulse.local" },
  { name: "Ishita Rao", email: "ishita.rao@demo.classpulse.local" },
  { name: "Arjun Kapoor", email: "arjun.kapoor@demo.classpulse.local" },
  { name: "Meera Nair", email: "meera.nair@demo.classpulse.local" },
];

const ADMIN = {
  name: "ClassPulse Admin",
  email: "admin@demo.classpulse.local",
};

const CLASS_DEFINITIONS = [
  { department: "Computer Science & Engineering", program: "B.Tech CSE", academicYear: "2026-27", year: "3", semester: 5 },
  { department: "Computer Science & Engineering", program: "B.Tech CSE", academicYear: "2026-27", year: "4", semester: 7 },
  { department: "Electronics & Communication Engineering", program: "B.Tech ECE", academicYear: "2026-27", year: "3", semester: 5 },
  { department: "Electronics & Communication Engineering", program: "B.Tech ECE", academicYear: "2026-27", year: "4", semester: 7 },
];

function studentName(index: number) {
  const first = ["Aarav", "Vivaan", "Aditya", "Arjun", "Reyansh", "Vihaan", "Ishaan", "Atharv", "Anaya", "Aadhya", "Diya", "Myra"];
  const last = ["Sharma", "Gupta", "Singh", "Verma", "Mehta", "Kapoor", "Rao", "Nair", "Malhotra", "Bansal"];
  return `${first[index % first.length]} ${last[Math.floor(index / first.length) % last.length]}`;
}

async function clearSeedData() {
  // Only remove records owned by this deterministic seed. This is intentionally
  // narrow so a developer can keep unrelated local records while reseeding.
  await prisma.attendanceRecord.deleteMany({
    where: { student: { email: { endsWith: "@seed.classpulse.local" } } },
  });
  await prisma.attendanceSession.deleteMany({
    where: { teacher: { email: { endsWith: "@demo.classpulse.local" } } },
  });
  await prisma.analysisSnapshot.deleteMany({
    where: { section: { students: { some: { email: { endsWith: "@seed.classpulse.local" } } } } },
  });
  await prisma.sheetLink.deleteMany({
    where: { section: { students: { some: { email: { endsWith: "@seed.classpulse.local" } } } } },
  });
  await prisma.assignment.deleteMany({
    where: { teacher: { email: { endsWith: "@demo.classpulse.local" } } },
  });
  await prisma.subject.deleteMany({
    where: { section: { students: { some: { email: { endsWith: "@seed.classpulse.local" } } } } },
  });
  await prisma.student.deleteMany({
    where: { email: { endsWith: "@seed.classpulse.local" } },
  });
  await prisma.classAccess.deleteMany({
    where: { teacher: { email: { endsWith: "@demo.classpulse.local" } } },
  });
  await prisma.section.deleteMany({
    where: { class: { program: { startsWith: "B.Tech" } } },
  });
  await prisma.class.deleteMany({
    where: { program: { startsWith: "B.Tech" }, academicYear: "2026-27" },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@demo.classpulse.local" } },
  });
  await prisma.department.deleteMany({
    where: { name: { in: CLASS_DEFINITIONS.map((item) => item.department) } },
  });
  await prisma.college.deleteMany({ where: { name: "ClassPulse Demo College" } });
}

async function main() {
  await clearSeedData();

  const college = await prisma.college.create({
    data: { name: "ClassPulse Demo College" },
  });

  const departments = new Map<string, string>();
  for (const definition of CLASS_DEFINITIONS) {
    if (departments.has(definition.department)) continue;
    const department = await prisma.department.create({
      data: { name: definition.department, collegeId: college.id },
    });
    departments.set(definition.department, department.id);
  }

  const admin = await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      role: Role.ADMIN,
      collegeId: college.id,
    },
  });

  const teachers = [];
  for (const teacher of TEACHERS) {
    const departmentId = departments.get("Computer Science & Engineering")!;
    teachers.push(
      await prisma.user.create({
        data: {
          name: teacher.name,
          email: teacher.email,
          role: Role.TEACHER,
          collegeId: college.id,
          departmentId,
        },
      }),
    );
  }

  const classRecords = [];
  for (let classIndex = 0; classIndex < CLASS_DEFINITIONS.length; classIndex += 1) {
    const definition = CLASS_DEFINITIONS[classIndex];
    const departmentId = departments.get(definition.department)!;
    const proctor = teachers[classIndex];

    const classRecord = await prisma.class.create({
      data: {
        departmentId,
        program: definition.program,
        academicYear: definition.academicYear,
        year: definition.year,
        semester: definition.semester,
        proctorId: proctor.id,
      },
    });

    await prisma.classAccess.create({
      data: { teacherId: proctor.id, classId: classRecord.id },
    });

    classRecords.push(classRecord);
  }

  let studentCounter = 1;
  let subjectCounter = 0;
  let sessionCounter = 0;
  let attendanceCounter = 0;

  for (const [classIndex, classRecord] of classRecords.entries()) {
    for (const sectionName of ["A", "B"]) {
      const section = await prisma.section.create({
        data: {
          name: sectionName,
          classId: classRecord.id,
          strength: 40,
        },
      });

      const students = [];
      for (let index = 0; index < 40; index += 1) {
        const enrollmentNo = `CP26${String(studentCounter).padStart(4, "0")}`;
        const student = await prisma.student.create({
          data: {
            enrollmentNo,
            name: studentName(studentCounter - 1),
            email: `${enrollmentNo.toLowerCase()}@seed.classpulse.local`,
            sectionId: section.id,
          },
        });
        students.push(student);
        studentCounter += 1;
      }

      for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex += 1) {
        const template = SUBJECTS[subjectIndex];
        const subject = await prisma.subject.create({
          data: {
            name: template.name,
            code: `${template.code}-${classIndex + 1}${sectionName}`,
            type: template.type,
            sectionId: section.id,
          },
        });
        subjectCounter += 1;

        const teacher = teachers[(classIndex * SUBJECTS.length + subjectIndex) % teachers.length];
        await prisma.assignment.create({
          data: { teacherId: teacher.id, subjectId: subject.id },
        });

        // Ten historical sessions per subject. Attendance intentionally varies
        // by student so the analysis screens contain healthy, average, and
        // at-risk populations.
        for (let day = 0; day < 10; day += 1) {
          const date = new Date(Date.UTC(2026, 8, 1 + day));
          const session = await prisma.attendanceSession.create({
            data: {
              sectionId: section.id,
              subjectId: subject.id,
              teacherId: teacher.id,
              date,
              slot: `${9 + ((subjectIndex + day) % 4)}:00-${10 + ((subjectIndex + day) % 4)}:00`,
            },
          });
          sessionCounter += 1;

          await prisma.attendanceRecord.createMany({
            data: students.map((student, studentIndex) => ({
              sessionId: session.id,
              studentId: student.id,
              // First group is healthy, middle group is borderline, final group
              // is intentionally at risk.
              present:
                studentIndex < 20
                  ? true
                  : studentIndex < 32
                    ? (studentIndex + day + subjectIndex) % 5 !== 0
                    : (studentIndex + day + subjectIndex) % 3 === 0,
            })),
          });
          attendanceCounter += students.length;
        }

        await prisma.analysisSnapshot.create({
          data: {
            subjectId: subject.id,
            sectionId: section.id,
            data: {
              seeded: true,
              subjectCode: subject.code,
              generatedFor: "development",
              note: "Placeholder snapshot for Phase 1 integration testing.",
            },
          },
        });
      }
    }
  }

  await prisma.systemSetting.create({
    data: {
      key: "seed.version",
      value: { version: 1, environment: "development" },
    },
  });

  console.log(`Seed complete.`);
  console.log(`College: ${college.name}`);
  console.log(`Admin: ${admin.email}`);
  console.log(`Teachers: ${teachers.length}`);
  console.log(`Classes: ${classRecords.length}`);
  console.log(`Sections: ${classRecords.length * 2}`);
  console.log(`Students: ${studentCounter - 1}`);
  console.log(`Subjects: ${subjectCounter}`);
  console.log(`Attendance sessions: ${sessionCounter}`);
  console.log(`Attendance records: ${attendanceCounter}`);
  console.log(`Student login accounts are intentionally not created yet; auth sync currently provisions Prisma User records only.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
