import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";

const admin = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
};
const text = (v: unknown) => String(v ?? "").trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await admin(req, res))) return res.status(403).json({ error: "Admin access required" });
  try {
    if (req.method === "POST") {
      const name = text(req.body?.name);
      const email = text(req.body?.email).toLowerCase();
      if (!name || !email) return res.status(400).json({ error: "Name and email are required." });
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (existing) return res.status(409).json({ error: "A user with this email already exists." });
      const session = await getServerSession(req, res, authOptions);
      const collegeId = text((session?.user as any)?.collegeId);
      if (!collegeId) return res.status(400).json({ error: "Admin college could not be determined." });
      const teacher = await prisma.user.create({ data: { name, email, role: "TEACHER", collegeId }, select: { id: true, name: true, email: true } });
      return res.status(201).json(teacher);
    }

    if (req.method === "PATCH") {
      const id = text(req.body?.id);
      const name = text(req.body?.name);
      const email = text(req.body?.email).toLowerCase();
      if (!id || !name || !email) return res.status(400).json({ error: "Teacher, name and email are required." });
      const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!existing || existing.role !== "TEACHER") return res.status(404).json({ error: "Teacher not found." });
      const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== id) return res.status(409).json({ error: "That email is already in use." });
      const teacher = await prisma.user.update({ where: { id }, data: { name, email }, select: { id: true, name: true, email: true } });
      return res.status(200).json(teacher);
    }

    if (req.method === "DELETE") {
      const id = text(req.query.id);
      if (!id) return res.status(400).json({ error: "Teacher id is required." });
      const teacher = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, assignments: { select: { id: true } }, classAccess: { select: { id: true } }, proctorOf: { select: { id: true } } } });
      if (!teacher || teacher.role !== "TEACHER") return res.status(404).json({ error: "Teacher not found." });
      if (teacher.assignments.length || teacher.classAccess.length || teacher.proctorOf.length) return res.status(409).json({ error: "Remove this teacher's assignments, class access and proctor roles before deleting." });
      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Admin teacher API error", error);
    if (error?.code === "P2002") return res.status(409).json({ error: "That email is already in use." });
    return res.status(500).json({ error: "The teacher operation could not be completed." });
  }
}
