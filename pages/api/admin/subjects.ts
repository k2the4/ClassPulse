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
      const name = text(req.body?.name), code = text(req.body?.code), sectionId = text(req.body?.sectionId), type = req.body?.type === "LAB" ? "LAB" : "THEORY";
      if (!name || !code || !sectionId) return res.status(400).json({ error: "Subject name, code and section are required." });
      const section = await prisma.section.findUnique({ where: { id: sectionId }, select: { id: true } });
      if (!section) return res.status(404).json({ error: "Section not found." });
      const subject = await prisma.subject.create({ data: { name, code, type, sectionId }, select: { id: true } });
      return res.status(201).json(subject);
    }
    const id = text(req.query.id || req.body?.id);
    if (req.method === "PATCH") {
      if (!id) return res.status(400).json({ error: "Subject id is required." });
      const name = text(req.body?.name), code = text(req.body?.code), type = req.body?.type === "LAB" ? "LAB" : "THEORY";
      if (!name || !code) return res.status(400).json({ error: "Subject name and code are required." });
      await prisma.subject.update({ where: { id }, data: { name, code, type } });
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Subject id is required." });
      const subject = await prisma.subject.findUnique({ where: { id }, select: { id: true, assignments: { select: { id: true } }, attendanceSessions: { select: { id: true } }, snapshots: { select: { id: true } } } });
      if (!subject) return res.status(404).json({ error: "Subject not found." });
      if (subject.assignments.length || subject.attendanceSessions.length || subject.snapshots.length) return res.status(409).json({ error: "Remove its assignments and attendance/analysis records before deleting this subject." });
      await prisma.subject.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "A subject with that code already exists in this section." });
    return res.status(500).json({ error: "The subject operation could not be completed." });
  }
}
