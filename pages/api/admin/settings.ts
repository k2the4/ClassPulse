import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";

const defaults = {
  institutionName: "ClassPulse",
  academicYear: "2026-27",
  attendanceThreshold: 75,
  atRiskThreshold: 65,
  autoSyncSheets: true,
  syncIntervalHours: 6,
  emailNotifications: true,
  maintenanceMode: false,
};

async function isAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

function normalize(input: any) {
  const settings = { ...defaults, ...(input || {}) };
  settings.institutionName = String(settings.institutionName || defaults.institutionName).trim().slice(0, 120);
  settings.academicYear = String(settings.academicYear || defaults.academicYear).trim().slice(0, 30);
  settings.attendanceThreshold = Math.min(100, Math.max(0, Number(settings.attendanceThreshold)));
  settings.atRiskThreshold = Math.min(100, Math.max(0, Number(settings.atRiskThreshold)));
  settings.syncIntervalHours = Math.min(24, Math.max(1, Number(settings.syncIntervalHours)));
  settings.autoSyncSheets = Boolean(settings.autoSyncSheets);
  settings.emailNotifications = Boolean(settings.emailNotifications);
  settings.maintenanceMode = Boolean(settings.maintenanceMode);
  if (![settings.attendanceThreshold, settings.atRiskThreshold, settings.syncIntervalHours].every(Number.isFinite)) throw new Error("Numeric settings are invalid.");
  if (settings.atRiskThreshold > settings.attendanceThreshold) throw new Error("At-risk threshold cannot exceed the attendance threshold.");
  return settings;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });

  try {
    if (req.method === "GET") {
      const rows = await prisma.systemSetting.findMany();
      const stored = rows.reduce<Record<string, any>>((acc, row) => { acc[row.key] = row.value; return acc; }, {});
      return res.status(200).json(normalize({ ...defaults, ...stored }));
    }

    if (req.method === "PUT") {
      const settings = normalize(req.body);
      await prisma.$transaction(
        Object.entries(settings).map(([key, value]) =>
          prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          }),
        ),
      );
      return res.status(200).json(settings);
    }

    if (req.method === "POST") {
      const settings = normalize(defaults);
      await prisma.$transaction(
        Object.entries(settings).map(([key, value]) =>
          prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          }),
        ),
      );
      return res.status(200).json(settings);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Unable to update system settings." });
  }
}
