import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSubject } from "../../../../lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const subjectId = req.query.subjectId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const allowed = await assertTeacherCanViewSubject(userId, role, subjectId);
  if (!allowed) return res.status(403).json({ error: "Not authorized for this subject" });

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { section: { include: { class: { include: { department: true } } } } },
  });

  if (!subject) return res.status(404).json({ error: "Subject not found" });

  return res.status(200).json({
    className: `${subject.section.class.department.name}-${subject.section.name} Sem ${subject.section.class.semester}`,
    subjectName: subject.name,
    subjectCode: subject.code,
  });
}
