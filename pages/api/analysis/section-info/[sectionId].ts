import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSection } from "../../../../lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const sectionId = req.query.sectionId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const allowed = await assertTeacherCanViewSection(userId, role, sectionId);
  if (!allowed) return res.status(403).json({ error: "Not authorized for this class" });

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { class: { include: { department: true } } },
  });

  if (!section) return res.status(404).json({ error: "Class not found" });

  return res.status(200).json({
    className: `${section.class.department.name}-${section.name} Sem ${section.class.semester}`,
  });
}
