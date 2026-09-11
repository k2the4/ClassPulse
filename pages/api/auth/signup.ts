import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../../lib/prisma";
import { fetchClassRoster } from "../../../lib/googleSheetsRoster";

const text = (value: unknown) => String(value ?? "").trim();
const emailOf = (value: unknown) => text(value).toLowerCase();
const ALLOWED_SECTIONS = ["1", "2"];

function normalizeSupabaseUrl(raw: string) {
  const value = raw.trim();
  if (!value) throw new Error("Supabase server URL is not configured.");
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    throw new Error("Supabase server URL is invalid. Use the project URL, e.g. https://<project-ref>.supabase.co");
  }
}

function getSupabaseAdmin() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function siteUrl(req: NextApiRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://${req.headers.host || "localhost:3000"}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const departments = await prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, collegeId: true } });
      const classes = await prisma.class.findMany({
        where: { semester: { in: [1, 3, 5, 7] }, sections: { some: { name: { in: ALLOWED_SECTIONS } } } },
        orderBy: [{ semester: "asc" }, { program: "asc" }],
        select: {
          id: true,
          program: true,
          semester: true,
          departmentId: true,
          department: { select: { name: true } },
          sections: { where: { name: { in: ALLOWED_SECTIONS } }, orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      });
      return res.status(200).json({ departments, classes });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const role = text(req.body?.role).toUpperCase();
    const name = text(req.body?.name);
    const email = emailOf(req.body?.email);
    const departmentId = text(req.body?.departmentId);
    if (!name || !email || !departmentId) return res.status(400).json({ error: "Name, department and email are required." });
    if (role !== "STUDENT" && role !== "TEACHER") return res.status(400).json({ error: "Choose Student or Teacher." });

    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true, collegeId: true } });
    if (!department) return res.status(400).json({ error: "Department not found." });

    const supabase = getSupabaseAdmin();
    const redirectTo = `${siteUrl(req)}/auth/finish-signup`;

    if (role === "STUDENT") {
      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      const existingStudent = await prisma.studentAccount.findUnique({ where: { email }, select: { id: true } });
      if (existingUser || existingStudent) return res.status(409).json({ error: "An account already exists for this email. Please use Log in or Forgot password." });

      const semester = Number(req.body?.semester);
      const sectionName = text(req.body?.section);
      if (![1, 3, 5, 7].includes(semester) || !ALLOWED_SECTIONS.includes(sectionName)) return res.status(400).json({ error: "Choose a valid semester and section." });

      const section = await prisma.section.findFirst({ where: { name: sectionName, class: { departmentId, semester } }, select: { id: true, name: true, sheetLink: { select: { sheetId: true, gid: true } } } });
      if (!section) return res.status(404).json({ error: "That class or section is not configured yet." });
      if (!section.sheetLink) return res.status(400).json({ error: "This class does not have a linked Google Sheet yet." });

      const roster = await fetchClassRoster(section.sheetLink.sheetId, section.sheetLink.gid);
      const student = roster.find((row) => row.email.trim().toLowerCase() === email);
      if (!student) return res.status(403).json({ error: "This email was not found in the selected class roster." });

      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { name: student.name, role: "STUDENT", enrollmentNo: student.enrollmentNo }, redirectTo });
      if (error || !data.user) return res.status(400).json({ error: error?.message || "We could not send the verification email." });

      try {
        await prisma.studentAccount.create({ data: { name: student.name, email, enrollmentNo: student.enrollmentNo, collegeId: department.collegeId, authUserId: data.user.id } });
      } catch (error) {
        await supabase.auth.admin.deleteUser(data.user.id);
        throw error;
      }
      return res.status(201).json({ ok: true, message: "Verification email sent. Open it to finish setting your password." });
    }

    let teacher = await prisma.user.findFirst({ where: { role: "TEACHER", email, collegeId: department.collegeId }, select: { id: true, name: true, email: true, authUserId: true, departmentId: true } });
    if (!teacher || (teacher.departmentId && teacher.departmentId !== department.id)) return res.status(403).json({ error: "This email is not registered as a teacher for the selected department." });
    if (teacher.authUserId) return res.status(409).json({ error: "This teacher already has an account. Please use Log in or Forgot password." });

    if (!teacher.departmentId) teacher = await prisma.user.update({ where: { id: teacher.id }, data: { departmentId: department.id }, select: { id: true, name: true, email: true, authUserId: true, departmentId: true } });

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { data: { name: teacher.name || name, role: "TEACHER", departmentId: department.id }, redirectTo });
    if (error || !data.user) return res.status(400).json({ error: error?.message || "We could not send the verification email." });

    try {
      await prisma.user.update({ where: { id: teacher.id }, data: { authUserId: data.user.id, name: teacher.name || name, departmentId: department.id } });
    } catch (error) {
      await supabase.auth.admin.deleteUser(data.user.id);
      throw error;
    }
    return res.status(201).json({ ok: true, message: "Verification email sent. Open it to finish setting your password." });
  } catch (error: any) {
    console.error("Signup API error", error);
    if (error?.code === "P2002") return res.status(409).json({ error: "An account already exists for this email or enrollment number." });
    return res.status(500).json({ error: error?.message || "Signup could not be completed." });
  }
}
