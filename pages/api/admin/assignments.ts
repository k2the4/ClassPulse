import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";
const text = (v: unknown) => String(v ?? "").trim();
async function isAdmin(req: NextApiRequest, res: NextApiResponse) { const s = await getServerSession(req, res, authOptions); return !!s?.user && (s.user as any).role === "ADMIN"; }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });
  try {
    if (req.method === "POST") {
      const subjectId = text(req.body?.subjectId), teacherId = text(req.body?.teacherId);
      if (!subjectId || !teacherId) return res.status(400).json({ error: "Subject and teacher are required." });
      const [subject, teacher, existing] = await Promise.all([prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }), prisma.user.findFirst({ where: { id: teacherId, role: "TEACHER" }, select: { id: true } }), prisma.assignment.findUnique({ where: { subjectId }, select: { teacherId: true } })]);
      if (!subject) return res.status(404).json({ error: "Subject not found." });
      if (!teacher) return res.status(404).json({ error: "Teacher not found." });
      if (existing) return res.status(409).json({ error: "This subject is already assigned to a teacher." });
      const assignment = await prisma.assignment.create({ data: { subjectId, teacherId }, select: { id: true } });
      return res.status(201).json(assignment);
    }
    const id = text(req.query.id || req.body?.id);
    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Assignment id is required." });
      await prisma.assignment.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) { if (e?.code === "P2025") return res.status(404).json({ error: "Assignment not found." }); if (e?.code === "P2002") return res.status(409).json({ error: "This subject is already assigned." }); return res.status(500).json({ error: "The assignment operation could not be completed." }); }
}
