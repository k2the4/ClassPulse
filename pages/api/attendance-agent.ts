import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import { fetchClassRawData } from "../../lib/googleSheetsClass";

const TIME_SLOTS = [
  "8 to 9",
  "9 to 10",
  "10 to 11",
  "11 to 12",
  "12.30 to 1.30",
  "1.30 to 2.30",
  "2.30 to 3.30",
  "3.30 to 4.30",
] as const;

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function canManageSubject(userId: string, role: string, subjectId: string) {
  if (role === "ADMIN") return true;
  return !!(await prisma.assignment.findFirst({ where: { teacherId: userId, subjectId } }));
}

async function orderStudentsBySheet(sectionId: string, students: Array<{ id: string; enrollmentNo: string; name: string }>) {
  try {
    const link = await prisma.sheetLink.findUnique({ where: { sectionId }, select: { sheetId: true } });
    if (!link?.sheetId) return students;

    const raw = await fetchClassRawData(link.sheetId);
    const sheetRank = new Map<string, number>();
    let nextRank = 1;

    // Monthly rows are kept in the same order as the Google Sheet. Use the
    // first occurrence of each enrollment number as the sheet's serial order.
    for (const month of raw.months) {
      for (const row of month.rows) {
        if (!sheetRank.has(row.enrollmentNo)) {
          sheetRank.set(row.enrollmentNo, nextRank++);
        }
      }
    }

    if (sheetRank.size === 0) return students;

    return [...students].sort((a, b) => {
      const aRank = sheetRank.get(a.enrollmentNo);
      const bRank = sheetRank.get(b.enrollmentNo);
      if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return a.enrollmentNo.localeCompare(b.enrollmentNo, undefined, { numeric: true });
    });
  } catch (error) {
    // Attendance should still work if the sheet is temporarily unavailable.
    console.error("Could not read Google Sheet student order:", error);
    return students;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Not authenticated" });

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  if (req.method === "GET") {
    const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : "";
    const date = validDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";

    if (!sectionId) return res.status(400).json({ error: "sectionId is required" });

    if (sessionId) {
      const attendance = await prisma.attendanceSession.findFirst({
        where: { id: sessionId, sectionId },
        include: { records: { select: { studentId: true, present: true } } },
      });
      if (!attendance) return res.status(404).json({ error: "Attendance session not found" });
      if (role !== "ADMIN" && attendance.teacherId !== userId) return res.status(403).json({ error: "Only the teacher who recorded this session can edit it" });
      return res.status(200).json({ presentStudentIds: attendance.records.filter((record) => record.present).map((record) => record.studentId) });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: { include: { department: true } },
        students: { orderBy: [{ enrollmentNo: "asc" }] },
        subjects: { include: { assignments: true }, orderBy: { name: "asc" } },
      },
    });

    if (!section) return res.status(404).json({ error: "Class not found" });

    const visibleSubjects = role === "ADMIN"
      ? section.subjects
      : section.subjects.filter((subject) => subject.assignments.some((a) => a.teacherId === userId));

    if (visibleSubjects.length === 0) return res.status(403).json({ error: "No assigned subjects for this class" });

    const orderedStudents = await orderStudentsBySheet(sectionId, section.students);

    const sessions = await prisma.attendanceSession.findMany({
      where: { sectionId, date: toDate(date) },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
        records: { select: { studentId: true, present: true } },
      },
      orderBy: { slot: "asc" },
    });

    return res.status(200).json({
      section: {
        id: section.id,
        label: `${section.class.department.name}-${section.name} Sem ${section.class.semester}`,
        strength: section.strength,
      },
      subjects: visibleSubjects.map((subject) => ({ id: subject.id, name: subject.name, code: subject.code, type: subject.type })),
      students: orderedStudents.map((student, index) => ({ id: student.id, enrollmentNo: student.enrollmentNo, name: student.name, serialNo: index + 1 })),
      sessions: sessions.map((item) => ({
        id: item.id,
        subjectId: item.subjectId,
        subjectName: item.subject.name,
        subjectCode: item.subject.code,
        slot: item.slot,
        teacherId: item.teacherId,
        teacherName: item.teacher.name,
        present: item.records.filter((r) => r.present).length,
        total: item.records.length,
        canEdit: role === "ADMIN" || item.teacherId === userId,
      })),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { sectionId, subjectId, date, slot, presentStudentIds } = req.body ?? {};
  if (typeof sectionId !== "string" || typeof subjectId !== "string" || !validDate(date) || typeof slot !== "string" || !slot.trim()) {
    return res.status(400).json({ error: "sectionId, subjectId, date and slot are required" });
  }

  if (!TIME_SLOTS.includes(slot.trim() as (typeof TIME_SLOTS)[number])) {
    return res.status(400).json({ error: "Choose one of the available class time slots" });
  }

  if (!Array.isArray(presentStudentIds) || presentStudentIds.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "presentStudentIds must be an array" });
  }

  if (!(await canManageSubject(userId, role, subjectId))) {
    return res.status(403).json({ error: "You are not assigned to this subject" });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { sectionId: true } });
  if (!subject || subject.sectionId !== sectionId) return res.status(400).json({ error: "Subject does not belong to this class" });

  const students = await prisma.student.findMany({ where: { sectionId }, select: { id: true } });
  const studentIds = new Set(students.map((student) => student.id));
  const presentIds = [...new Set(presentStudentIds as string[])];
  if (presentIds.some((id) => !studentIds.has(id))) return res.status(400).json({ error: "Attendance contains a student outside this class" });

  const dateValue = toDate(date);
  const existing = await prisma.attendanceSession.findUnique({
    where: { sectionId_subjectId_date_slot: { sectionId, subjectId, date: dateValue, slot: slot.trim() } },
    select: { id: true, teacherId: true },
  });

  if (existing && role !== "ADMIN" && existing.teacherId !== userId) {
    return res.status(403).json({ error: "This attendance session belongs to another teacher" });
  }

  const sessionRow = existing
    ? await prisma.attendanceSession.update({ where: { id: existing.id }, data: { records: { deleteMany: {}, create: students.map((student) => ({ studentId: student.id, present: presentIds.includes(student.id) })) } } })
    : await prisma.attendanceSession.create({ data: { sectionId, subjectId, teacherId: userId, date: dateValue, slot: slot.trim(), records: { create: students.map((student) => ({ studentId: student.id, present: presentIds.includes(student.id) })) } } });

  return res.status(200).json({ ok: true, sessionId: sessionRow.id, present: presentIds.length, total: students.length });
}
