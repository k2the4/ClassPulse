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

// Admins can access anything in their college. Teachers can view a subject
// only when they are the single teacher assigned to that subject.
export async function assertTeacherCanViewSubject(userId: string, role: string, subjectId: string) {
  if (role === "ADMIN") return true;
  const assignment = await prisma.assignment.findUnique({
    where: { subjectId },
  });
  return assignment?.teacherId === userId;
}

// Class-level access is separate from subject assignment. A teacher must be
// explicitly granted ClassAccess for the whole class. Teaching one subject
// no longer implicitly grants access to the complete class.
export async function assertTeacherCanViewClass(userId: string, role: string, classId: string) {
  if (role === "ADMIN") return true;
  const access = await prisma.classAccess.findUnique({
    where: { teacherId_classId: { teacherId: userId, classId } },
  });
  return !!access;
}

export async function assertTeacherCanViewSection(userId: string, role: string, sectionId: string) {
  if (role === "ADMIN") return true;
  const section = await prisma.section.findUnique({ where: { id: sectionId }, select: { classId: true } });
  if (!section) return false;
  return assertTeacherCanViewClass(userId, role, section.classId);
}

export async function assertTeacherCanViewOverall(userId: string, role: string, sectionId: string) {
  return assertTeacherCanViewSection(userId, role, sectionId);
}
