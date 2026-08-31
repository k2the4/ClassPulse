import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSection } from "../../../../../lib/access";
import { fetchClassRawData } from "../../../../../lib/googleSheetsClass";
import { computeAllSubjectAnalyses, gradeFor, round1 } from "../../../../../lib/analysis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const requestedId = req.query.sectionId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  let resolvedSection = await prisma.section.findUnique({ where: { id: requestedId } });
  if (!resolvedSection) {
    if (role === "ADMIN") {
      resolvedSection = await prisma.section.findFirst({
        where: { classId: requestedId },
        orderBy: { name: "asc" },
      });
    } else {
      resolvedSection = await prisma.section.findFirst({
        where: {
          classId: requestedId,
          OR: [
            { class: { proctorId: userId } },
            { subjects: { some: { assignments: { some: { teacherId: userId } } } } },
          ],
        },
        orderBy: { name: "asc" },
      });
    }
  }

  if (!resolvedSection) {
    return res.status(404).json({ error: "Section not found or not assigned to you" });
  }

  const sectionId = resolvedSection.id;
  const allowed = await assertTeacherCanViewSection(userId, role, sectionId);
  if (!allowed) return res.status(403).json({ error: "Not authorized for this section" });

  // Class Overall / At Risk intentionally uses the six theory subjects only.
  const subjects = await prisma.subject.findMany({
    where: { sectionId, type: "THEORY" },
    orderBy: { code: "asc" },
  });
  if (subjects.length === 0) {
    return res.status(404).json({ error: "No theory subjects exist for this section yet" });
  }

  const link = await prisma.sheetLink.findUnique({ where: { sectionId } });
  if (!link) return res.status(404).json({ error: "No combined Google Sheet linked to this section yet" });

  const theoryIds = new Set(subjects.map((s) => s.id));
  const theoryCodes = new Set(subjects.map((s) => s.code));

  if (req.query.sync !== "1") {
    const latest = await prisma.analysisSnapshot.findFirst({
      where: { sectionId, data: { path: ["kind"], equals: "overall" } as any },
      orderBy: { computedAt: "desc" },
    });
    if (latest) {
      const cached = latest.data as any;
      const cachedSubjects = Array.isArray(cached.subjects)
        ? cached.subjects.filter((s: any) => theoryIds.has(s.id) || theoryCodes.has(s.code))
        : subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }));
      const data = {
        ...cached,
        subjects: cachedSubjects,
        students: Array.isArray(cached.students)
          ? cached.students.map((student: any) => ({
              ...student,
              subjects: Array.isArray(student.subjects)
                ? student.subjects.filter((s: any) => theoryIds.has(s.subjectId) || theoryCodes.has(s.code))
                : [],
            }))
          : [],
      };
      return res.status(200).json({
        cached: true,
        computedAt: latest.computedAt,
        sheetId: link.sheetId,
        data,
      });
    }
  }

  try {
    const raw = await fetchClassRawData(link.sheetId);
    const subjectAnalyses = computeAllSubjectAnalyses(raw, subjects.map((s) => s.code));

    const studentMap = new Map<string, {
      enrollmentNo: string;
      name: string;
      email: string;
      subjects: {
        subjectId: string;
        code: string;
        name: string;
        attendance: number;
        midsem1: number;
        midsem2: number;
        combined: number;
        basicInternal: number;
        moderatedInternal: number;
        basicMax: number;
        grade: string;
      }[];
    }>();

    subjects.forEach((subject) => {
      const analysis = subjectAnalyses[subject.code];
      if (!analysis) return;

      analysis.students.forEach((s) => {
        if (!studentMap.has(s.enrollmentNo)) {
          studentMap.set(s.enrollmentNo, {
            enrollmentNo: s.enrollmentNo,
            name: s.name,
            email: s.email,
            subjects: [],
          });
        }

        const basicMax = (s.assignment.total || 0) + 10 + 30;
        studentMap.get(s.enrollmentNo)!.subjects.push({
          subjectId: subject.id,
          code: subject.code,
          name: subject.name,
          attendance: s.attendancePct.currMonth,
          midsem1: s.midsem.first,
          midsem2: s.midsem.second,
          combined: s.midsem.combined,
          basicInternal: s.internalMarks.basic,
          moderatedInternal: s.internalMarks.moderated,
          basicMax,
          grade: s.midsem.grade,
        });
      });
    });

    const students = Array.from(studentMap.values()).map((student) => {
      const percentages = student.subjects.map((sub) => sub.basicMax > 0 ? (sub.basicInternal / sub.basicMax) * 100 : 0);
      const overallPct = percentages.length ? round1(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
      const attendancePercentages = student.subjects.map((sub) => sub.attendance);
      const overallAttendance = attendancePercentages.length ? round1(attendancePercentages.reduce((a, b) => a + b, 0) / attendancePercentages.length) : 0;

      return {
        ...student,
        overallPct,
        overallAttendance,
        overallGrade: gradeFor(overallPct, 100),
      };
    });

    const data = {
      kind: "overall" as const,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      students,
      classAverageOverallPct: students.length ? round1(students.reduce((a, s) => a + s.overallPct, 0) / students.length) : 0,
    };

    const snapshot = await prisma.analysisSnapshot.create({ data: { sectionId, data: data as any } });
    return res.status(200).json({ cached: false, computedAt: snapshot.computedAt, sheetId: link.sheetId, data });
  } catch (err: any) {
    console.error(err);
    return res.status(502).json({
      error: "Failed to sync from Google Sheets. Check that the sheet is shared with the service account.",
      detail: err.message,
    });
  }
}
