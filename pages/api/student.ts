import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import { fetchClassRoster } from "../../lib/googleSheetsRoster";
import { readTeacherDiarySessions } from "../../lib/googleSheetsAttendanceAgent";

const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || (session.user as any).role !== "STUDENT") return res.status(403).json({ error: "Student access required" });
  const enrollmentNo = String((session.user as any).studentEnrollmentNo || "").trim();
  if (!enrollmentNo) return res.status(400).json({ error: "Student account is not linked to an enrollment number." });
  const date = validDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);

  try {
    const account = await prisma.studentAccount.findUnique({ where: { id: String((session.user as any).id) } });
    if (!account || account.enrollmentNo !== enrollmentNo) return res.status(403).json({ error: "Student account could not be verified." });

    const sections = await prisma.section.findMany({
      where: { class: { department: { collegeId: account.collegeId } } },
      include: { class: { include: { department: true } }, sheetLink: true, subjects: { orderBy: { name: "asc" } } },
    });

    let found: { section: (typeof sections)[number]; rosterStudent: { enrollmentNo: string; name: string; email: string } } | null = null;
    for (const section of sections) {
      if (!section.sheetLink) continue;
      const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
      const rosterStudent = roster.find(s => s.enrollmentNo === enrollmentNo);
      if (rosterStudent) { found = { section, rosterStudent }; break; }
    }
    if (!found) return res.status(404).json({ error: "Your enrollment number was not found in a linked class roster." });
    const { section } = found;
    const subjectCodes = section.subjects.map(s => s.code);
    const sessions = await readTeacherDiarySessions({ spreadsheetId: section.sheetLink!.sheetId, subjectCodes });
    const subjectByCode = new Map(section.subjects.map(s => [s.code.toLowerCase(), s]));

    const dailySessions = sessions.filter(s => s.date === date).map(s => {
      const subject = subjectByCode.get(s.subjectCode.toLowerCase());
      return { id: s.id, subjectCode: s.subjectCode, subjectName: subject?.name || s.subjectCode, date: s.date, slot: s.slot, teacherName: s.teacherName, present: s.presentEnrollmentNos.includes(enrollmentNo) };
    });

    const report = section.subjects.map(subject => {
      const subjectSessions = sessions.filter(s => s.subjectCode.toLowerCase() === subject.code.toLowerCase());
      const attended = subjectSessions.filter(s => s.presentEnrollmentNos.includes(enrollmentNo)).length;
      const total = subjectSessions.length;
      return { code: subject.code, name: subject.name, type: subject.type, attended, total, missed: total - attended, percentage: total ? Math.round((attended / total) * 1000) / 10 : null };
    });
    const total = sessions.length;
    const attended = sessions.filter(s => s.presentEnrollmentNos.includes(enrollmentNo)).length;

    return res.status(200).json({
      student: { name: found.rosterStudent.name, email: found.rosterStudent.email || account.email, enrollmentNo },
      class: { program: section.class.program, department: section.class.department.name, semester: section.class.semester, section: section.name },
      summary: { attended, total, missed: total - attended, percentage: total ? Math.round((attended / total) * 1000) / 10 : null },
      daily: dailySessions,
      report,
    });
  } catch (error) {
    console.error("Student API error", error);
    return res.status(500).json({ error: "Unable to load student attendance." });
  }
}
