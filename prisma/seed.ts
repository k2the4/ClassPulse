import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type SubjectSeed = {
  name: string;
  code: string;
  type: "THEORY" | "LAB";
};

const prisma = new PrismaClient();

const subjectsBySemester: Record<number, SubjectSeed[]> = {
  1: [
    { name: "Environmental Studies", code: "SEM1-ENVIRONMENTAL-STUDIES", type: "THEORY" },
    { name: "Engineering Graphics-I", code: "SEM1-ENGINEERING-GRAPHICS-I", type: "THEORY" },
    { name: "Manufacturing Process", code: "SEM1-MANUFACTURING-PROCESS", type: "THEORY" },
    { name: "Communications Skills", code: "SEM1-COMMUNICATIONS-SKILLS", type: "THEORY" },
    { name: "Applied Mathematics-I", code: "SEM1-APPLIED-MATHEMATICS-I", type: "THEORY" },
    { name: "Applied Physics-I", code: "SEM1-APPLIED-PHYSICS-I", type: "THEORY" },
    { name: "Programming in C", code: "SEM1-PROGRAMMING-IN-C", type: "THEORY" },
    { name: "Environmental Studies Lab", code: "SEM1-ENVIRONMENTAL-STUDIES-LAB", type: "LAB" },
    { name: "Programming in C Lab", code: "SEM1-PROGRAMMING-IN-C-LAB", type: "LAB" },
    { name: "Physics-I Lab", code: "SEM1-PHYSICS-I-LAB", type: "LAB" },
  ],
  2: [
    { name: "Applied Chemistry", code: "SEM2-APPLIED-CHEMISTRY", type: "THEORY" },
    { name: "Applied Physics-II", code: "SEM2-APPLIED-PHYSICS-II", type: "THEORY" },
    { name: "Electrical Science", code: "SEM2-ELECTRICAL-SCIENCE", type: "THEORY" },
    { name: "Applied Mathematics-II", code: "SEM2-APPLIED-MATHEMATICS-II", type: "THEORY" },
    { name: "Engineering Mechanics", code: "SEM2-ENGINEERING-MECHANICS", type: "THEORY" },
    { name: "Indian Constitution", code: "SEM2-INDIAN-CONSTITUTION", type: "THEORY" },
    { name: "Human Values and Ethics", code: "SEM2-HUMAN-VALUES-AND-ETHICS", type: "THEORY" },
    { name: "Physics-III Lab", code: "SEM2-PHYSICS-III-LAB", type: "LAB" },
    { name: "Applied Chemistry Lab", code: "SEM2-APPLIED-CHEMISTRY-LAB", type: "LAB" },
    { name: "Engineering Graphics-II", code: "SEM2-ENGINEERING-GRAPHICS-II", type: "LAB" },
    { name: "Electrical Science Lab", code: "SEM2-ELECTRICAL-SCIENCE-LAB", type: "LAB" },
    { name: "Workshop Practice", code: "SEM2-WORKSHOP-PRACTICE", type: "LAB" },
  ],
  3: [
    { name: "Computational Methods", code: "SEM3-COMPUTATIONAL-METHODS", type: "THEORY" },
    { name: "Indian Knowledge System", code: "SEM3-INDIAN-KNOWLEDGE-SYSTEM", type: "THEORY" },
    { name: "Signal and System", code: "SEM3-SIGNAL-AND-SYSTEM", type: "THEORY" },
    { name: "Digital Logic and Computer Design", code: "SEM3-DIGITAL-LOGIC-AND-COMPUTER-DESIGN", type: "THEORY" },
    { name: "Analog Communications", code: "SEM3-ANALOG-COMMUNICATIONS", type: "THEORY" },
    { name: "Analog Electronics-I", code: "SEM3-ANALOG-ELECTRONICS-I", type: "THEORY" },
    { name: "Computational Methods Lab", code: "SEM3-COMPUTATIONAL-METHODS-LAB", type: "LAB" },
    { name: "Digital Logic and Computer Design Lab", code: "SEM3-DIGITAL-LOGIC-AND-COMPUTER-DESIGN-LAB", type: "LAB" },
    { name: "Analog Communications Lab", code: "SEM3-ANALOG-COMMUNICATIONS-LAB", type: "LAB" },
    { name: "Analog Electronics-I Lab", code: "SEM3-ANALOG-ELECTRONICS-I-LAB", type: "LAB" },
    { name: "Signal and System Lab", code: "SEM3-SIGNAL-AND-SYSTEM-LAB", type: "LAB" },
  ],
  4: [
    { name: "Probability, Statistics and Linear Programming", code: "SEM4-PSLP", type: "THEORY" },
    { name: "Technical Writing", code: "SEM4-TECHNICAL-WRITING", type: "THEORY" },
    { name: "Network Analysis and Synthesis", code: "SEM4-NAS", type: "THEORY" },
    { name: "Microprocessors and Microcontrollers", code: "SEM4-MICROPROCESSORS-AND-MICROCONTROLLERS", type: "THEORY" },
    { name: "Digital Communications", code: "SEM4-DIGITAL-COMMUNICATIONS", type: "THEORY" },
    { name: "Analog Electronics-II", code: "SEM4-ANALOG-ELECTRONICS-II", type: "THEORY" },
    { name: "Electromagnetic Field Theory", code: "SEM4-EMFT", type: "THEORY" },
    { name: "Probability, Statistics and Linear Programming Lab", code: "SEM4-PSLP-LAB", type: "LAB" },
    { name: "Microprocessors and Microcontrollers Lab", code: "SEM4-MPMC-LAB", type: "LAB" },
    { name: "Digital Communications Lab", code: "SEM4-DIGITAL-COMMUNICATIONS-LAB", type: "LAB" },
    { name: "Analog Electronics-II Lab", code: "SEM4-ANALOG-ELECTRONICS-II-LAB", type: "LAB" },
    { name: "Network Analysis and Synthesis Lab", code: "SEM4-NAS-LAB", type: "LAB" },
  ],
  5: [
    { name: "Economics for Engineers", code: "SEM5-ECONOMICS-FOR-ENGINEERS", type: "THEORY" },
    { name: "Digital Signal Processing", code: "SEM5-DSP", type: "THEORY" },
    { name: "Microelectronics", code: "SEM5-MICROELECTRONICS", type: "THEORY" },
    { name: "Introduction to Control Systems", code: "SEM5-INTRODUCTION-TO-CONTROL-SYSTEMS", type: "THEORY" },
    { name: "Transmission Lines, Waveguides and Antenna Design", code: "SEM5-TLWAD", type: "THEORY" },
    { name: "Data Communication and Networking", code: "SEM5-DCN", type: "THEORY" },
    { name: "Digital Signal Processing Lab", code: "SEM5-DSP-LAB", type: "LAB" },
    { name: "Microelectronics Lab", code: "SEM5-MICROELECTRONICS-LAB", type: "LAB" },
    { name: "Introduction to Control Systems Lab", code: "SEM5-INTRODUCTION-TO-CONTROL-SYSTEMS-LAB", type: "LAB" },
    { name: "Transmission Lines, Waveguides and Antenna Design Lab", code: "SEM5-TLWAD-LAB", type: "LAB" },
    { name: "Data Communication and Networking Lab", code: "SEM5-DCN-LAB", type: "LAB" },
  ],
  6: [
    { name: "Principles of Management for Engineers", code: "SEM6-PME", type: "THEORY" },
    { name: "Universal Human Values", code: "SEM6-UHV", type: "THEORY" },
    { name: "Statistics, Statistical Modelling & Data Analytics", code: "DA 304 T", type: "THEORY" },
    { name: "Artificial Intelligence", code: "ECE 318 T", type: "THEORY" },
    { name: "Optical Communication Systems and Network", code: "ECE 326 T", type: "THEORY" },
    { name: "Data Analytics", code: "DA 338 T", type: "THEORY" },
    { name: "Machine Learning", code: "ECE 350 T", type: "THEORY" },
    { name: "Statistics, Statistical Modelling & Data Analytics Lab", code: "DA 304 P", type: "LAB" },
    { name: "Artificial Intelligence Lab", code: "ECE 318 P", type: "LAB" },
    { name: "Optical Communication Systems and Networks Lab", code: "ECE 326 P", type: "LAB" },
    { name: "Data Analytics Lab", code: "DA 338 P", type: "LAB" },
    { name: "Machine Learning Lab", code: "ECE 350 P", type: "LAB" },
  ],
  7: [
    { name: "Machine Learning and Data Analytics Frameworks", code: "MLDA", type: "THEORY" },
    { name: "Internet of Things", code: "IOT", type: "THEORY" },
    { name: "Pattern Recognition", code: "PR", type: "THEORY" },
    { name: "Principles of Entrepreneurship", code: "PE", type: "THEORY" },
    { name: "Unsupervised Learning", code: "USL", type: "THEORY" },
    { name: "Supervised and Deep Learning", code: "SL", type: "THEORY" },
    { name: "Unsupervised Learning Lab", code: "USL-LAB", type: "LAB" },
    { name: "Supervised and Deep Learning Lab", code: "SL-LAB", type: "LAB" },
    { name: "Machine Learning and Data Analytics Frameworks Lab", code: "MLDA-LAB", type: "LAB" },
    { name: "Internet of Things Lab", code: "IOT-LAB", type: "LAB" },
    { name: "Pattern Recognition Lab", code: "PR-LAB", type: "LAB" },
  ],
};

const teacherSeeds = [
  { name: "Dr. Sudesh Pahal", email: "sudesh.pahal@demo.edu" },
  { name: "Dr. Archana Balyan", email: "archana.balyan@demo.edu" },
  { name: "Dr. Pardeep Sangwan", email: "pardeep.sangwan@demo.edu" },
  { name: "Dr. Puneet Azad", email: "puneet.azad@demo.edu" },
  { name: "Dr. Neeru Rathi", email: "neeru.rathi@demo.edu" },
  { name: "Dr. Meena Rao", email: "meena.rao@demo.edu" },
  { name: "Dr. Shafali Madan Arora", email: "shafali.arora@demo.edu" },
  { name: "Dr. Richa Gupta", email: "richa.gupta@demo.edu" },
  { name: "Dr. Aman Kumari Dahiya", email: "aman.dahiya@demo.edu" },
  { name: "Dr. Dinesh Sheoran", email: "dinesh.sheoran@demo.edu" },
  { name: "Mr. Deepak Goyal", email: "deepak.goyal@demo.edu" },
  { name: "Dr. Deepti Deshwal", email: "deepti.deshwal@demo.edu" },
  { name: "Ms. Neelam Nehra", email: "neelam.nehra@demo.edu" },
  { name: "Dr. Geetanjali Sharma", email: "geetanjali@demo.edu" },
  { name: "Dr. Sakshi Rajput", email: "sakshi.rajput@demo.edu" },
  { name: "Dr. Nishtha", email: "nishtha@demo.edu" },
  { name: "Dr. Neetu", email: "neetu@demo.edu" },
  { name: "Dr. Upma Singh", email: "upma.singh@demo.edu" },
  { name: "Ms. Jasmine Chhikara", email: "jasmine.chhikara@demo.edu" },
  { name: "Ms. Prinkle Talan", email: "prinkle.talan@demo.edu" },
  { name: "Ms. Garima", email: "garima@demo.edu" },
  { name: "Ms. Vishakha Tomar", email: "vishakha.tomar@demo.edu" },
  { name: "Dr. Suman Lata", email: "suman.lata@demo.edu" },
  { name: "Ms. Anjali Balyan", email: "anjali.balyan@demo.edu" },
  { name: "Dr. Neelam Barak", email: "neelam.barak@demo.edu" },
  { name: "Ms. Himani", email: "himani@demo.edu" },
  { name: "Ms. Sonia", email: "sonia@demo.edu" },
  { name: "Ms. Neha", email: "neha@demo.edu" },
];

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

  const teachers = new Map<string, { id: string; name: string }>();
  for (const teacherSeed of teacherSeeds) {
    const teacher = await prisma.user.upsert({
      where: { email: teacherSeed.email },
      update: {
        name: teacherSeed.name,
        passwordHash,
        role: "TEACHER",
        collegeId: college.id,
      },
      create: {
        name: teacherSeed.name,
        email: teacherSeed.email,
        passwordHash,
        role: "TEACHER",
        collegeId: college.id,
      },
      select: { id: true, name: true },
    });
    teachers.set(teacher.name, teacher);
  }

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
            proctorId:
              semester === 7 && batch === "ECE 2"
                ? teachers.get("Dr. Geetanjali Sharma")?.id ?? null
                : null,
          },
        }));

      if (cls.program !== program || cls.year !== yearForSemester(semester)) {
        await prisma.class.update({
          where: { id: cls.id },
          data: {
            program,
            year: yearForSemester(semester),
            proctorId:
              semester === 7 && batch === "ECE 2"
                ? teachers.get("Dr. Geetanjali Sharma")?.id ?? cls.proctorId
                : cls.proctorId,
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
        await prisma.subject.upsert({
          where: { sectionId_code: { sectionId: section.id, code: subject.code } },
          update: { name: subject.name, type: subject.type },
          create: {
            name: subject.name,
            code: subject.code,
            type: subject.type,
            sectionId: section.id,
          },
        });
      }
    }
  }

  const geetanjali = teachers.get("Dr. Geetanjali Sharma");
  if (!geetanjali) throw new Error("Dr. Geetanjali Sharma was not seeded.");

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
      where: { teacherId_subjectId: { teacherId: geetanjali.id, subjectId: subject.id } },
      update: {},
      create: { teacherId: geetanjali.id, subjectId: subject.id },
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
        where: { teacherId_subjectId: { teacherId: geetanjali.id, subjectId: daSubject.id } },
        update: {},
        create: { teacherId: geetanjali.id, subjectId: daSubject.id },
      });
      await prisma.sheetLink.upsert({
        where: { subjectId: daSubject.id },
        update: {},
        create: {
          subjectId: daSubject.id,
          sheetId: "118662A6Ifl2GDZKnh120v2jNylUiMWGNYThfRXSDX6U",
        },
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
  console.log("Added theory and lab subjects; Summer Training Report and NSS are excluded.");
  console.log(`Seeded ${teacherSeeds.length} ECE faculty teacher accounts.`);
  console.log("Assigned Dr. Geetanjali Sharma to 6 classes from Semesters 1, 3, 5 and 7.");
  console.log("Semester 8 intentionally has no subjects.");
  console.log("Login: geetanjali@demo.edu / changeme123");
  console.log("Admin: admin@demo.edu / changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
