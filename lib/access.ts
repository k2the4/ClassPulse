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

// Section-based analysis pages are used by Class Analysis, whose purpose is
// to show the complete class/section view across all subjects. A teacher who
// has access to the class (as proctor or by teaching any subject in it) must
// therefore be allowed to open the section analysis pages as well.
export async function assertTeacherCanViewSection(userId: string, role: string, sectionId: string) {
  if (role === "ADMIN") return true;
  const section = await prisma.section.findUnique({ where: { id: sectionId }, select: { classId: true } });
  if (!section) return false;
  return assertTeacherCanViewClass(userId, role, section.classId);
}

// Kept as an explicit alias for class-level overall analysis callers.
export async function assertTeacherCanViewOverall(userId: string, role: string, sectionId: string) {
  return assertTeacherCanViewSection(userId, role, sectionId);
}
