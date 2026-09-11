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

    const classSnapshot = await prisma.analysisSnapshot.findFirst({
      where: { sectionId: section.id, subjectId: null, data: { path: ["kind"], equals: "overall" } as any },
      orderBy: { computedAt: "desc" },
    });
    const classData = classSnapshot?.data as any;
    const classStudents = Array.isArray(classData?.students) ? classData.students : [];
    const rankedClassStudents = [...classStudents].sort((a: any, b: any) => {
      const aScore = Number(a.overallPct) || 0;
      const bScore = Number(b.overallPct) || 0;
      return bScore - aScore || String(a.name || "").localeCompare(String(b.name || ""));
    });
    const classStudentIndex = rankedClassStudents.findIndex((student: any) => String(student.enrollmentNo).trim() === enrollmentNo);
    const classStudent = classStudents.find((student: any) => String(student.enrollmentNo).trim() === enrollmentNo);

    const subjectSnapshots = await prisma.analysisSnapshot.findMany({
      where: { subjectId: { in: section.subjects.map(subject => subject.id) } },
      orderBy: { computedAt: "desc" },
    });
    const latestSubjectSnapshots = new Map<string, any>();
    for (const snapshot of subjectSnapshots) {
      if (snapshot.subjectId && !latestSubjectSnapshots.has(snapshot.subjectId)) latestSubjectSnapshots.set(snapshot.subjectId, snapshot);
    }

    const subjectReports = section.subjects.map(subject => {
      const snapshot = latestSubjectSnapshots.get(subject.id);
      const data = snapshot?.data as any;
      const student = Array.isArray(data?.students)
        ? data.students.find((item: any) => String(item.enrollmentNo).trim() === enrollmentNo)
        : null;
      return {
        subject: { id: subject.id, code: subject.code, name: subject.name, type: subject.type },
        computedAt: snapshot?.computedAt || null,
        data: student,
        classAverageBasicMarks: data?.classAverageBasicMarks ?? null,
      };
    });

    return res.status(200).json({
      student: { name: found.rosterStudent.name, email: found.rosterStudent.email || account.email, enrollmentNo },
      class: { program: section.class.program, department: section.class.department.name, semester: section.class.semester, section: section.name },
      summary: { attended, total, missed: total - attended, percentage: total ? Math.round((attended / total) * 1000) / 10 : null },
      daily: dailySessions,
      report,
      analysisReports: {
        class: classStudent ? {
          computedAt: classSnapshot?.computedAt || null,
          classAverageOverallPct: classData?.classAverageOverallPct ?? null,
          rank: classStudentIndex >= 0 ? classStudentIndex + 1 : null,
          totalStudents: classStudents.length,
          student: classStudent,
        } : null,
        subjects: subjectReports,
      },
    });
  } catch (error) {
    console.error("Student API error", error);
    return res.status(500).json({ error: "Unable to load student attendance." });
  }
}
