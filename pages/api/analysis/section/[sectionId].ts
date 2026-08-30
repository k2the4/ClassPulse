import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSection } from "../../../../lib/access";
import { fetchClassRawData } from "../../../../lib/googleSheetsClass";
import { computeSectionAnalysis } from "../../../../lib/analysisClass";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const requestedId = req.query.sectionId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  // The analysis UI is section-based, but older dashboard/class-analysis links
  // may still provide a class id. Resolve a direct section id first. If the id
  // is a class id, resolve to a section the current teacher is actually allowed
  // to view instead of blindly selecting the first section in that class.
  let resolvedSection = await prisma.section.findUnique({
    where: { id: requestedId },
  });

  if (!resolvedSection) {
    if (role === "ADMIN") {
      resolvedSection = await prisma.section.findFirst({
        where: { classId: requestedId },
      });
    } else {
      resolvedSection = await prisma.section.findFirst({
        where: {
          classId: requestedId,
          OR: [
            { class: { proctorId: userId } },
            {
              subjects: {
                some: {
                  assignments: {
                    some: { teacherId: userId },
                  },
                },
              },
            },
          ],
        },
      });
    }
  }

  if (!resolvedSection) {
    return res.status(404).json({ error: "Section not found or not assigned to you" });
  }

  const sectionId = resolvedSection.id;

  // Keep the existing authorization check for direct section URLs as the final
  // guard. This does not weaken access; it only fixes legacy class-id routing.
  const allowed = await assertTeacherCanViewSection(userId, role, sectionId);
  if (!allowed) {
    return res.status(403).json({ error: "Not authorized for this section" });
  }

  const forceSync = req.query.sync === "1";
  const previousMonth = typeof req.query.previousMonth === "string" ? req.query.previousMonth : undefined;
  const currentMonth = typeof req.query.currentMonth === "string" ? req.query.currentMonth : undefined;

  const criteriaValue =
    typeof req.query.criteria === "string"
      ? req.query.criteria
      : typeof req.query.trendCriteria === "string"
        ? req.query.trendCriteria
        : undefined;
  const criteria = criteriaValue !== undefined ? Number(criteriaValue) : undefined;
  const hasCustomTrendSettings = previousMonth !== undefined || currentMonth !== undefined || criteria !== undefined;

  const link = await prisma.sheetLink.findUnique({ where: { sectionId } });
  if (!link) {
    return res.status(404).json({ error: "No combined Google Sheet linked to this section yet" });
  }

  if (!forceSync && !hasCustomTrendSettings) {
    const latest = await prisma.analysisSnapshot.findFirst({
      where: { sectionId },
      orderBy: { computedAt: "desc" },
    });
    if (latest) {
      return res.status(200).json({
        cached: true,
        computedAt: latest.computedAt,
        sheetId: link.sheetId,
        data: latest.data,
      });
    }
  }

  try {
    const raw = await fetchClassRawData(link.sheetId);
    const analysis = computeSectionAnalysis(raw, { previousMonth, currentMonth, criteria });
    const snapshot = await prisma.analysisSnapshot.create({
      data: { sectionId, data: analysis as any },
    });
    await prisma.sheetLink.update({ where: { sectionId }, data: { lastSyncAt: new Date() } });

    return res.status(200).json({
      cached: false,
      computedAt: snapshot.computedAt,
      sheetId: link.sheetId,
      data: analysis,
    });
  } catch (err: any) {
    console.error("Section analysis sync failed:", err);
    return res.status(502).json({
      error: "Failed to sync from Google Sheets.",
      detail: err?.message || "Unknown Google Sheets error.",
    });
  }
}
