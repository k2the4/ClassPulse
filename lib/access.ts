import { getServerSession } from "next-auth/next";
import { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "./authOptions";
import { prisma } from "./prisma";

export async function requireSession(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return session;
}

// Admins can access anything in their college. Teachers only subjects
// they're assigned to (via Assignment) or classes they proctor.
export async function assertTeacherCanViewSubject(userId: string, role: string, subjectId: string) {
  if (role === "ADMIN") return true;
  const assignment = await prisma.assignment.findFirst({
    where: { teacherId: userId, subjectId },
  });
  return !!assignment;
}

export async function assertTeacherCanViewClass(userId: string, role: string, classId: string) {
  if (role === "ADMIN") return true;
  const cls = await prisma.class.findFirst({ where: { id: classId, proctorId: userId } });
  if (cls) return true;
  // or teaches at least one subject within this class's sections
  const teaches = await prisma.assignment.findFirst({
    where: {
      teacherId: userId,
      subject: { section: { classId } },
    },
  });
  return !!teaches;
}

// Section access: the class proctor, or anyone teaching a subject within
// this specific section.
export async function assertTeacherCanViewSection(userId: string, role: string, sectionId: string) {
  if (role === "ADMIN") return true;
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return false;

  const proctorMatch = await prisma.class.findFirst({
    where: { id: section.classId, proctorId: userId },
  });
  if (proctorMatch) return true;

  const teaches = await prisma.assignment.findFirst({
    where: { teacherId: userId, subject: { sectionId } },
  });
  return !!teaches;
}
