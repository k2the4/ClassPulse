import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findUnique({
    where: { email: "geetanjali@demo.edu" },
  });

  if (!teacher) {
    throw new Error("Dr. Geetanjali Sharma was not found.");
  }

  const cls = await prisma.class.findFirst({
    where: {
      program: "B.Tech ECE 2",
      academicYear: "2026-27",
      semester: 7,
    },
    include: { sections: true },
  });

  const section = cls?.sections.find((item) => item.name === "A");
  if (!section) {
    console.log("ECE 2 Sem 7 Section A not found; nothing to fix.");
    return;
  }

  // DA 338 T belongs to the old Sem 6 data and must not appear in
  // Geetanjali's ECE 2 Sem 7 subject assignments.
  const legacySubject = await prisma.subject.findFirst({
    where: {
      sectionId: section.id,
      code: "DA 338 T",
    },
  });

  if (legacySubject) {
    const result = await prisma.assignment.deleteMany({
      where: {
        teacherId: teacher.id,
        subjectId: legacySubject.id,
      },
    });
    console.log(`Removed ${result.count} legacy DA assignment(s) from Geetanjali's ECE 2 Sem 7.`);
  }

  console.log("Geetanjali ECE 2 Sem 7 assignment fix complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
