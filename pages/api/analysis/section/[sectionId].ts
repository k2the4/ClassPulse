import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireSession, assertTeacherCanViewSection } from "../../../../lib/access";
import { fetchClassRawData } from "../../../../lib/googleSheetsClass";
import { computeSectionAnalysis } from "../../../../lib/analysisClass";

function formatStudentName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeSubjectCode(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function subjectCodeVariants(value: unknown): string[] {
  const raw = String(value ?? "").trim();
  const normalized = normalizeSubjectCode(raw);
  const firstToken = raw
    .toUpperCase()
    .split(/[\s(\[]+/)[0]
    .replace(/[^A-Z0-9]/g, "");
  return Array.from(new Set([normalized, firstToken].filter(Boolean)));
}

function enrichAnalysis(analysis: any, subjectNames: Record<string, string>) {
  const students = (analysis?.students || []).map((student: any) => ({
    ...student,
    name: formatStudentName(student.name),
    examMarks: {
      ...student.examMarks,
      midsem1Subjects: (student.examMarks?.midsem1Subjects || []).map((subject: any) => ({
        ...subject,
        name: subjectNames[normalizeSubjectCode(subject.code)] || subject.name || subject.code,
      })),
      midsem2Subjects: (student.examMarks?.midsem2Subjects || []).map((subject: any) => ({
        ...subject,
        name: subjectNames[normalizeSubjectCode(subject.code)] || subject.name || subject.code,
      })),
    },
  }));

  return { ...analysis, students, subjectNames };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;

  const requestedId = req.query.sectionId as string;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

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
  const allowed = await assertTeacherCanViewSection(userId, role, sectionId);
  if (!allowed) {
    return res.status(403).json({ error: "Not authorized for this section" });
  }

  const forceSync = req.query.sync === "1";
  const previousMonth = typeof req.query.previousMonth === "string" ? req.query.previousMonth : undefined;
  const currentMonth = typeof req.query.currentMonth === "string" ? req.query.currentMonth : undefined;
  const criteriaValue = typeof req.query.criteria === "string" ? req.query.criteria : typeof req.query.trendCriteria === "string" ? req.query.trendCriteria : undefined;
  const criteria = criteriaValue !== undefined ? Number(criteriaValue) : undefined;
  const hasCustomTrendSettings = previousMonth !== undefined || currentMonth !== undefined || criteria !== undefined;

  const link = await prisma.sheetLink.findUnique({ where: { sectionId } });
  if (!link) {
    return res.status(404).json({ error: "No combined Google Sheet linked to this section yet" });
  }

  const subjects = await prisma.subject.findMany({
    where: { sectionId },
    select: { code: true, name: true },
  });
  const subjectNames: Record<string, string> = {};
  for (const subject of subjects) {
    for (const variant of subjectCodeVariants(subject.code)) {
      subjectNames[variant] = subject.name;
    }
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
        data: enrichAnalysis(latest.data, subjectNames),
      });
    }
  }

  try {
    const raw = await fetchClassRawData(link.sheetId);
    const analysis = computeSectionAnalysis(raw, { previousMonth, currentMonth, criteria });
    const enriched = enrichAnalysis(analysis, subjectNames);
    const snapshot = await prisma.analysisSnapshot.create({
      data: { sectionId, data: enriched as any },
    });
    await prisma.sheetLink.update({ where: { sectionId }, data: { lastSyncAt: new Date() } });

    return res.status(200).json({
      cached: false,
      computedAt: snapshot.computedAt,
      sheetId: link.sheetId,
      data: enriched,
    });
  } catch (err: any) {
    console.error("Section analysis sync failed:", err);
    return res.status(502).json({
      error: "Failed to sync from Google Sheets.",
      detail: err?.message || "Unknown Google Sheets error.",
    });
  }
}
