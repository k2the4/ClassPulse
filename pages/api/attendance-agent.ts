import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import { fetchClassRawData } from "../../lib/googleSheetsClass";
import { deleteTeacherDiaryAttendance, writeTeacherDiaryAttendance } from "../../lib/googleSheetsAttendance";
import { readTeacherDiarySessions } from "../../lib/googleSheetsAttendanceAgent";

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

    for (const month of raw.months) {
      for (const row of month.rows) {
        if (!sheetRank.has(row.enrollmentNo)) sheetRank.set(row.enrollmentNo, nextRank++);
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
    console.error("Could not read Google Sheet student order:", error);
    return students;
  }
}

function sessionSortKey(date: string, slot: string): string {
  const slotIndex = TIME_SLOTS.findIndex((item) => item === slot);
  return `${date}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${slot}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Not authenticated" });

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const teacherName = ((session.user as any).name as string | undefined) || "Teacher";

  if (req.method === "GET") {
    const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : "";
    const date = validDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";

    if (!sectionId) return res.status(400).json({ error: "sectionId is required" });

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: { include: { department: true } },
        students: { orderBy: [{ enrollmentNo: "asc" }] },
        subjects: { include: { assignments: true }, orderBy: { name: "asc" } },
        sheetLink: true,
      },
    });

    if (!section) return res.status(404).json({ error: "Class not found" });
    if (!section.sheetLink?.sheetId) return res.status(400).json({ error: "No Google Sheet is linked to this class" });

    const visibleSubjects = role === "ADMIN"
      ? section.subjects
      : section.subjects.filter((subject) => subject.assignments.some((a) => a.teacherId === userId));

    if (visibleSubjects.length === 0) return res.status(403).json({ error: "No assigned subjects for this class" });

    const orderedStudents = await orderStudentsBySheet(sectionId, section.students);
    const sheetSessions = await readTeacherDiarySessions({
      spreadsheetId: section.sheetLink.sheetId,
      subjectCodes: visibleSubjects.map((subject) => subject.code),
      date,
    });

    const subjectByCode = new Map(visibleSubjects.map((subject) => [subject.code.toLowerCase(), subject]));
    const sessions = sheetSessions
      .map((item) => {
        const subject = subjectByCode.get(item.subjectCode.toLowerCase());
        if (!subject) return null;
        return {
          id: item.id,
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          slot: item.slot,
          teacherId: "sheet",
          teacherName: item.teacherName,
          present: item.presentEnrollmentNos.length,
          total: orderedStudents.length,
          canEdit: true,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => sessionSortKey(date, a.slot).localeCompare(sessionSortKey(date, b.slot)));

    if (sessionId) {
      const found = sheetSessions.find((item) => item.id === sessionId);
      if (!found) return res.status(404).json({ error: "Attendance session not found" });
      const presentEnrollmentNos = new Set(found.presentEnrollmentNos);
      return res.status(200).json({
        presentStudentIds: orderedStudents.filter((student) => presentEnrollmentNos.has(student.enrollmentNo)).map((student) => student.id),
      });
    }

    return res.status(200).json({
      section: { id: section.id, label: `${section.class.department.name}-${section.name} Sem ${section.class.semester}`, strength: section.strength },
      subjects: visibleSubjects.map((subject) => ({ id: subject.id, name: subject.name, code: subject.code, type: subject.type })),
      students: orderedStudents.map((student, index) => ({ id: student.id, enrollmentNo: student.enrollmentNo, name: student.name, serialNo: index + 1 })),
      sessions,
    });
  }

  if (req.method === "DELETE") {
    const { sectionId, sessionId } = req.body ?? {};
    if (typeof sectionId !== "string" || typeof sessionId !== "string" || !sessionId) {
      return res.status(400).json({ error: "sectionId and sessionId are required" });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        sheetLink: true,
        subjects: { include: { assignments: true } },
      },
    });
    if (!section) return res.status(404).json({ error: "Class not found" });
    if (!section.sheetLink?.sheetId) return res.status(400).json({ error: "No Google Sheet is linked to this class" });

    const visibleSubjects = role === "ADMIN"
      ? section.subjects
      : section.subjects.filter((subject) => subject.assignments.some((a) => a.teacherId === userId));
    const sheetSessions = await readTeacherDiarySessions({
      spreadsheetId: section.sheetLink.sheetId,
      subjectCodes: visibleSubjects.map((subject) => subject.code),
    });
    const target = sheetSessions.find((item) => item.id === sessionId);
    if (!target) return res.status(404).json({ error: "Attendance session not found" });

    try {
      await deleteTeacherDiaryAttendance({
        spreadsheetId: section.sheetLink.sheetId,
        subjectCode: target.subjectCode,
        date: target.date,
        slot: target.slot,
      });
    } catch (error) {
      console.error("Teacher Diary deletion failed:", error);
      const message = error instanceof Error ? error.message : "Unknown Google Sheets error";
      return res.status(502).json({ error: `Attendance was not deleted because Teacher Diary could not be updated. ${message}` });
    }

    return res.status(200).json({ ok: true, deletedSessionId: sessionId });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { sectionId, subjectId, date, slot, presentStudentIds } = req.body ?? {};
  if (typeof sectionId !== "string" || typeof subjectId !== "string" || !validDate(date) || typeof slot !== "string" || !slot.trim()) {
    return res.status(400).json({ error: "sectionId, subjectId, date and slot are required" });
  }

  const normalizedSlot = slot.trim();
  if (!TIME_SLOTS.includes(normalizedSlot as (typeof TIME_SLOTS)[number])) {
    return res.status(400).json({ error: "Choose one of the available class time slots" });
  }

  if (!Array.isArray(presentStudentIds) || presentStudentIds.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "presentStudentIds must be an array" });
  }

  if (!(await canManageSubject(userId, role, subjectId))) {
    return res.status(403).json({ error: "You are not assigned to this subject" });
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { sectionId: true, name: true, code: true },
  });
  if (!subject || subject.sectionId !== sectionId) return res.status(400).json({ error: "Subject does not belong to this class" });

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      name: true,
      sheetLink: { select: { sheetId: true } },
      class: { select: { semester: true, department: { select: { name: true } } } },
    },
  });
  if (!section) return res.status(404).json({ error: "Class not found" });
  if (!section.sheetLink?.sheetId) return res.status(400).json({ error: "No Google Sheet is linked to this class" });

  const students = await prisma.student.findMany({
    where: { sectionId },
    select: { id: true, enrollmentNo: true },
  });
  const studentIds = new Set(students.map((student) => student.id));
  const presentIds = [...new Set(presentStudentIds as string[])];
  if (presentIds.some((id) => !studentIds.has(id))) return res.status(400).json({ error: "Attendance contains a student outside this class" });

  const sessionKey = `ATT-${date.replace(/-/g, "")}-${subject.code.replace(/[^a-z0-9]/gi, "").toUpperCase()}-${normalizedSlot.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;

  try {
    await writeTeacherDiaryAttendance({
      spreadsheetId: section.sheetLink.sheetId,
      subjectCode: subject.code,
      subjectName: subject.name,
      classLabel: `${section.class.department.name}-${section.name} Sem ${section.class.semester}`,
      teacherName,
      date,
      slot: normalizedSlot,
      sessionKey,
      students: students.map((student) => ({
        enrollmentNo: student.enrollmentNo,
        present: presentIds.includes(student.id),
      })),
    });
  } catch (error) {
    console.error("Teacher Diary update failed:", error);
    const message = error instanceof Error ? error.message : "Unknown Google Sheets error";
    return res.status(502).json({ error: `Attendance was not saved because Teacher Diary could not be updated. ${message}` });
  }

  return res.status(200).json({
    ok: true,
    sessionId: sessionKey,
    present: presentIds.length,
    total: students.length,
    sheetUpdated: true,
  });
}
