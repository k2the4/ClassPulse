import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";

const isAdmin = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
};

const text = (value: unknown) => String(value ?? "").trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });

  try {
    if (req.method === "POST") {
      const { departmentId, program, academicYear, year, semester, proctorId } = req.body || {};
      const cleanProgram = text(program);
      const cleanAcademicYear = text(academicYear);
      const cleanYear = text(year);
      const sem = Number(semester);
      if (!departmentId || !cleanProgram || !cleanAcademicYear || !cleanYear || !Number.isInteger(sem) || sem < 1 || sem > 8) {
        return res.status(400).json({ error: "Department, class name, academic year, year and a valid semester are required." });
      }
      const created = await prisma.class.create({
        data: { departmentId: String(departmentId), program: cleanProgram, academicYear: cleanAcademicYear, year: cleanYear, semester: sem, proctorId: proctorId ? String(proctorId) : null },
        select: { id: true },
      });
      return res.status(201).json({ id: created.id });
    }

    const id = text(req.query.id || req.body?.id);
    if (!id) return res.status(400).json({ error: "Class id is required." });

    const existing = await prisma.class.findUnique({
      where: { id },
      include: { sections: { select: { id: true } }, classAccess: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Class not found." });

    if (req.method === "PATCH") {
      const { departmentId, program, academicYear, year, semester, proctorId } = req.body || {};
      const cleanProgram = text(program);
      const cleanAcademicYear = text(academicYear);
      const cleanYear = text(year);
      const sem = Number(semester);
      if (!departmentId || !cleanProgram || !cleanAcademicYear || !cleanYear || !Number.isInteger(sem) || sem < 1 || sem > 8) {
        return res.status(400).json({ error: "Department, class name, academic year, year and a valid semester are required." });
      }
      await prisma.class.update({
        where: { id },
        data: { departmentId: String(departmentId), program: cleanProgram, academicYear: cleanAcademicYear, year: cleanYear, semester: sem, proctorId: proctorId ? String(proctorId) : null },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (existing.sections.length || existing.classAccess.length) {
        return res.status(409).json({ error: "This class has sections or teacher access records. Remove those relationships before deleting the class." });
      }
      await prisma.class.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Admin class API error", error);
    return res.status(500).json({ error: "The class operation could not be completed." });
  }
}
