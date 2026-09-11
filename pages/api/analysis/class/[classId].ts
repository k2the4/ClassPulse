import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewClass } from "../../../../lib/access";
import { fetchClassRoster } from "../../../../lib/googleSheetsRoster";
import { SubjectAnalysis } from "../../../../lib/analysis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const classId = req.query.classId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const allowed = await assertTeacherCanViewClass(userId, role, classId);
  if (!allowed) return res.status(403).json({ error: "Not authorized for this class" });

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      sections: {
        include: {
          sheetLink: true,
          subjects: { include: { snapshots: { orderBy: { computedAt: "desc" }, take: 1 } } },
        },
      },
    },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const uniqueStudents = new Map<string, { enrollmentNo: string; name: string; email: string }>();
  for (const section of cls.sections) {
    if (!section.sheetLink) continue;
    const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
    for (const student of roster) uniqueStudents.set(student.enrollmentNo, student);
  }

  const subjects = cls.sections.flatMap((section) =>
    section.subjects.map((subject) => {
      const snapshot = subject.snapshots[0]?.data as unknown as SubjectAnalysis | undefined;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        section: section.name,
        classAverage: snapshot?.classAverageCurrMonth ?? null,
        passRate: snapshot?.midsemPassRate ?? null,
        computedAt: subject.snapshots[0]?.computedAt ?? null,
      };
    }),
  );

  return res.status(200).json({
    className: `${cls.program} — ${cls.year}, Sem ${cls.semester}`,
    totalStudents: uniqueStudents.size,
    subjects,
  });
}
