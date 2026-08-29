import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewClass } from "../../../../lib/access";
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
      department: true,
      sections: {
        include: {
          students: true,
          subjects: {
            include: {
              snapshots: { orderBy: { computedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const totalStudents = cls.sections.reduce((s, sec) => s + sec.students.length, 0);

  const subjects = cls.sections.flatMap((sec) =>
    sec.subjects.map((subj) => {
      const snapshot = subj.snapshots[0]?.data as unknown as SubjectAnalysis | undefined;
      return {
        subjectId: subj.id,
        subjectName: subj.name,
        classAverage: snapshot?.classAverageCurrMonth ?? null,
        passRate: snapshot?.midsemPassRate ?? null,
        computedAt: subj.snapshots[0]?.computedAt ?? null,
      };
    })
  );

  // The teacher-facing class name is the single class identity used by
  // ClassPulse: department + class number + semester. Internal Section
  // records are not exposed in the UI.
  const classNumber = cls.sections.length === 1 ? cls.sections[0].name : "";
  const className = `${cls.department.name}${classNumber} Sem ${cls.semester}`;

  return res.status(200).json({
    className,
    totalStudents,
    subjects,
  });
}
