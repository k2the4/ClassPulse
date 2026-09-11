import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";
import { fetchClassRoster } from "../../../lib/googleSheetsRoster";

const text = (v: unknown) => String(v ?? "").trim();
const isAdmin = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
};
const supa = () => {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for student account management.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await isAdmin(req, res))) return res.status(403).json({ error: "Admin access required" });
  try {
    const session = await getServerSession(req, res, authOptions);
    const collegeId = text((session?.user as any)?.collegeId);
    if (!collegeId) return res.status(400).json({ error: "Admin college could not be determined." });

    if (req.method === "GET") {
      const sections = await prisma.section.findMany({ where: { class: { department: { collegeId } } }, orderBy: [{ class: { program: "asc" } }, { name: "asc" }], include: { class: true, sheetLink: true } });
      const accounts = await prisma.studentAccount.findMany({ where: { collegeId }, select: { id: true, name: true, email: true, enrollmentNo: true, createdAt: true } });
      const accountByEnrollment = new Map(accounts.map(a => [a.enrollmentNo, a]));
      const students = (await Promise.all(sections.filter(s => s.sheetLink).map(async section => {
        const roster = await fetchClassRoster(section.sheetLink!.sheetId, section.sheetLink!.gid);
        return roster.map(student => ({ enrollmentNo: student.enrollmentNo, name: student.name, email: student.email, sectionId: section.id, sectionLabel: `${section.class.program} · Section ${section.name}`, account: accountByEnrollment.get(student.enrollmentNo) || null }));
      }))).flat();
      return res.status(200).json({ students });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const enrollmentNo = text(req.body?.enrollmentNo);
    const password = text(req.body?.password);
    if (!enrollmentNo || !password) return res.status(400).json({ error: "Enrollment number and password are required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await prisma.studentAccount.findUnique({ where: { enrollmentNo } })) return res.status(409).json({ error: "A student account already exists for this enrollment number." });

    const sections = await prisma.section.findMany({ where: { class: { department: { collegeId } } }, include: { class: true, sheetLink: true } });
    let match: { name: string; email: string; sectionId: string } | null = null;
    for (const section of sections) {
      if (!section.sheetLink) continue;
      const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
      const student = roster.find(s => s.enrollmentNo === enrollmentNo);
      if (student) { match = { name: student.name, email: student.email.toLowerCase(), sectionId: section.id }; break; }
    }
    if (!match) return res.status(404).json({ error: "Student enrollment number was not found in any linked Google Sheet roster." });
    if (!match.email) return res.status(400).json({ error: "This student has no email address in the Google Sheet roster." });
    if (await prisma.user.findUnique({ where: { email: match.email }, select: { id: true } })) return res.status(409).json({ error: "This email is already used by another ClassPulse account." });
    if (await prisma.studentAccount.findUnique({ where: { email: match.email }, select: { id: true } })) return res.status(409).json({ error: "This email is already linked to a student account." });

    const sb = supa();
    const created = await sb.auth.admin.createUser({ email: match.email, password, email_confirm: true, user_metadata: { name: match.name, role: "STUDENT", enrollmentNo } });
    if (created.error || !created.data.user) return res.status(400).json({ error: created.error?.message || "Student login account could not be created." });
    try {
      const account = await prisma.studentAccount.create({ data: { name: match.name, email: match.email, enrollmentNo, collegeId, authUserId: created.data.user.id }, select: { id: true, name: true, email: true, enrollmentNo: true } });
      return res.status(201).json(account);
    } catch (error) {
      await sb.auth.admin.deleteUser(created.data.user.id);
      throw error;
    }
  } catch (error: any) {
    console.error("Admin student account API error", error);
    if (error?.code === "P2002") return res.status(409).json({ error: "That student account already exists." });
    return res.status(500).json({ error: error?.message || "The student account operation could not be completed." });
  }
}
