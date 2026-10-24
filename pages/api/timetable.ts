import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";

const text = (value: unknown) => String(value ?? "").trim();
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const overlaps = (a: any, b: any) => toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Not authenticated" });
  const user = session.user as any;
  const isAdmin = user.role === "ADMIN";
  try {
    if (req.method === "GET") {
      const sectionId = text(req.query.sectionId);
      const where: any = sectionId ? { sectionId } : {};
      if (!isAdmin) where.OR = [{ teacherId: user.id }, { subject: { assignments: { some: { teacherId: user.id } } } }];
      const [entries, sections] = await Promise.all([
        prisma.timetableEntry.findMany({
          where,
          include: {
            section: { include: { class: { include: { department: true } } } },
            subject: { include: { assignments: { include: { teacher: { select: { id: true, name: true } } } } } },
            teacher: { select: { id: true, name: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        prisma.section.findMany({
          where: isAdmin
            ? {}
            : {
                OR: [
                  { subjects: { some: { assignments: { some: { teacherId: user.id } } } } },
                  { class: { classAccess: { some: { teacherId: user.id } } } },
                ],
              },
          include: {
            class: { include: { department: true } },
            subjects: {
              include: {
                assignments: {
                  include: { teacher: { select: { id: true, name: true } } },
                },
              },
              orderBy: { name: "asc" },
            },
          },
          orderBy: [{ class: { semester: "asc" } }, { name: "asc" }],
        }),
      ]);
      return res.status(200).json({
        entries: entries.map((entry: any) => ({
          id: entry.id, sectionId: entry.sectionId, subjectId: entry.subjectId, teacherId: entry.teacherId,
          dayOfWeek: entry.dayOfWeek, startTime: entry.startTime, endTime: entry.endTime, room: entry.room, note: entry.note,
          sectionLabel: entry.section.class.department.name + " · " + entry.section.class.program + " · Sem " + entry.section.class.semester + " · " + entry.section.name,
          subjectName: entry.subject.name, subjectCode: entry.subject.code,
          teacherName: entry.teacher?.name || entry.subject.assignments[0]?.teacher?.name || "Unassigned",
        })),
        sections: sections.map((section: any) => ({
          id: section.id,
          label: section.class.department.name + " · " + section.class.program + " · Sem " + section.class.semester + " · " + section.name,
          subjects: section.subjects.map((subject: any) => ({
            id: subject.id, name: subject.name, code: subject.code,
            teachers: subject.assignments.map((assignment: any) => ({ id: assignment.teacher.id, name: assignment.teacher.name })),
          })),
        })),
        canManage: isAdmin,
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (!isAdmin) return res.status(403).json({ error: "Only administrators can create or edit timetable entries." });
      const body = req.body || {};
      const id = text(body.id);
      const sectionId = text(body.sectionId);
      const subjectId = text(body.subjectId);
      let teacherId = text(body.teacherId) || null;
      const dayOfWeek = Number(body.dayOfWeek);
      const startTime = text(body.startTime);
      const endTime = text(body.endTime);
      const room = text(body.room).slice(0, 80) || null;
      const note = text(body.note).slice(0, 300) || null;
      if (!sectionId || !subjectId || !Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6 || !validTime(startTime) || !validTime(endTime) || startTime >= endTime) {
        return res.status(400).json({ error: "Choose a section, subject, Monday–Saturday, and a valid start/end time." });
      }
      const subject = await prisma.subject.findFirst({ where: { id: subjectId, sectionId }, include: { assignments: { select: { teacherId: true } } } });
      if (!subject) return res.status(400).json({ error: "The selected subject does not belong to this section." });
      if (!teacherId && subject.assignments.length === 1) teacherId = subject.assignments[0].teacherId;
      if (teacherId && !subject.assignments.some((assignment: any) => assignment.teacherId === teacherId)) return res.status(400).json({ error: "The selected teacher is not assigned to this subject." });
      const conflicts = await prisma.timetableEntry.findMany({
        where: { dayOfWeek, ...(id ? { id: { not: id } } : {}), OR: [{ sectionId }, ...(teacherId ? [{ teacherId }] : [])] },
        select: { sectionId: true, teacherId: true, startTime: true, endTime: true },
      });
      const conflict = conflicts.find((entry: any) => overlaps({ startTime, endTime }, entry));
      if (conflict) return res.status(409).json({ error: conflict.sectionId === sectionId ? "This section already has a class during that time." : "This teacher is already scheduled during that time." });
      const data = { sectionId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, note };
      const entry = req.method === "POST" ? await prisma.timetableEntry.create({ data }) : await prisma.timetableEntry.update({ where: { id }, data });
      return res.status(req.method === "POST" ? 201 : 200).json({ ok: true, entry });
    }
    if (req.method === "DELETE") {
      if (!isAdmin) return res.status(403).json({ error: "Only administrators can delete timetable entries." });
      const id = text(req.query.id || req.body?.id);
      if (!id) return res.status(400).json({ error: "Entry id is required." });
      await prisma.timetableEntry.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Timetable API error:", error);
    if (error?.code === "P2025") return res.status(404).json({ error: "Timetable entry not found." });
    return res.status(500).json({ error: "Timetable request failed. Check server logs for details." });
  }
}