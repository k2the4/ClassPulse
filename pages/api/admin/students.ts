import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";
import { appendClassRosterStudent, fetchClassRoster } from "../../../lib/googleSheetsRoster";

const text = (v: unknown) => String(v ?? "").trim();

async function isAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sectionId = text(req.body?.sectionId);
    const enrollmentNo = text(req.body?.enrollmentNo);
    const name = text(req.body?.name);
    const email = text(req.body?.email);
    if (!sectionId || !enrollmentNo || !name || !email) return res.status(400).json({ error: "Section, enrollment number, name and email are required." });

    const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { sheetLink: true } });
    if (!section) return res.status(404).json({ error: "Section not found." });
    if (!section.sheetLink) return res.status(409).json({ error: "No Google Sheet is linked to this section." });

    const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
    if (roster.some((student) => student.enrollmentNo === enrollmentNo)) return res.status(409).json({ error: "That enrollment number is already in the Google Sheet." });

    await appendClassRosterStudent(section.sheetLink.sheetId, section.sheetLink.gid, { enrollmentNo, name, email });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Admin student API error", error);
    return res.status(500).json({ error: "The student could not be added to the Google Sheet." });
  }
}
