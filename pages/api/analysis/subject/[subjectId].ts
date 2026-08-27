import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSubject } from "../../../../lib/access";
import { fetchClassRawData } from "../../../../lib/googleSheetsClass";
import { computeSubjectAnalysis } from "../../../../lib/analysis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const subjectId = req.query.subjectId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const allowed = await assertTeacherCanViewSubject(userId, role, subjectId);
  if (!allowed) return res.status(403).json({ error: "Not authorized for this subject" });

  const forceSync = req.query.sync === "1";
  const previousMonth = typeof req.query.previousMonth === "string" ? req.query.previousMonth : undefined;
  const currentMonth = typeof req.query.currentMonth === "string" ? req.query.currentMonth : undefined;
  const trendCriteria = req.query.trendCriteria ? Number(req.query.trendCriteria) : undefined;
  const hasCustomSettings = previousMonth !== undefined || currentMonth !== undefined || trendCriteria !== undefined;

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return res.status(404).json({ error: "Subject not found" });

  // Subject analysis now reads from the SAME combined sheet as the
  // section — prefer the section's SheetLink; only fall back to the
  // subject's own (likely stale/separate) link if the section has none.
  const sectionLink = await prisma.sheetLink.findUnique({ where: { sectionId: subject.sectionId } });
  const subjectLink = await prisma.sheetLink.findUnique({ where: { subjectId } });
  const link = sectionLink || subjectLink;

  if (!link) return res.status(404).json({ error: "No Google Sheet linked to this subject's section yet" });

  // Always recompute from the linked Google Sheet.
  // Older snapshots can contain results calculated before the subject-code
  // matching fix and therefore leave every subject value at 0. Returning
  // those snapshots makes the dashboard look broken even after the parser
  // has been fixed.
  try {
    const raw = await fetchClassRawData(link.sheetId);
    const analysis = computeSubjectAnalysis(raw, subject.code, { previousMonth, currentMonth, trendCriteria });

    const snapshot = await prisma.analysisSnapshot.create({
      data: { subjectId, data: analysis as any },
    });

    if (sectionLink) {
      await prisma.sheetLink.update({ where: { sectionId: subject.sectionId }, data: { lastSyncAt: new Date() } });
    } else if (subjectLink) {
      await prisma.sheetLink.update({ where: { subjectId }, data: { lastSyncAt: new Date() } });
    }

    return res
      .status(200)
      .json({ cached: false, computedAt: snapshot.computedAt, sheetId: link.sheetId, data: analysis });
  } catch (err: any) {
    console.error(err);
    return res.status(502).json({
      error: "Failed to sync from Google Sheets. Check that the sheet is shared with the service account.",
      detail: err.message,
    });
  }
}
