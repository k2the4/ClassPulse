import { useMemo, useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { prisma } from "../lib/prisma";

type Department = { id: string; name: string; collegeId: string };
type Section = { id: string; name: string };
type ClassOption = { id: string; program: string; semester: number; departmentId: string; department: { name: string }; sections: Section[] };
type Props = { departments: Department[]; classes: ClassOption[] };

const ALLOWED_SECTIONS = ["1", "2", "E"];

export default function SignupPage({ departments, classes }: Props) {
  const [role, setRole] = useState<"" | "STUDENT" | "TEACHER">("");
  const [departmentId, setDepartmentId] = useState("");
  const [semester, setSemester] = useState("");
  const [section, setSection] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const semesters = [1, 3, 5, 7];
  const availableClasses = useMemo(() => classes.filter((item) => item.departmentId === departmentId && (!semester || item.semester === Number(semester))), [classes, departmentId, semester]);
  const availableSections = useMemo(() => {
    const seen = new Set<string>();
    return availableClasses.flatMap((item) => item.sections).filter((item) => {
      const normalized = item.name.trim().toUpperCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return ALLOWED_SECTIONS.includes(normalized);
    }).sort((a, b) => ALLOWED_SECTIONS.indexOf(a.name.trim().toUpperCase()) - ALLOWED_SECTIONS.indexOf(b.name.trim().toUpperCase()));
  }, [availableClasses]);

  function chooseRole(next: "STUDENT" | "TEACHER") {
    setRole(next); setError(""); setMessage(""); setSemester(""); setSection("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, departmentId, semester: Number(semester), section, name, email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Signup could not be completed.");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup could not be completed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="mb-7"><h1 className="text-xl font-semibold text-gray-900">ClassPulse</h1><p className="text-sm text-gray-500 mt-1">Create your ClassPulse account</p></div>
        {!role ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-4">Sign up as</p>
            <button type="button" onClick={() => chooseRole("STUDENT")} className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-gray-400"><strong className="block text-sm text-gray-900">Student</strong><span className="text-xs text-gray-500">Verify your class and college email against the roster.</span></button>
            <button type="button" onClick={() => chooseRole("TEACHER")} className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-gray-400"><strong className="block text-sm text-gray-900">Teacher</strong><span className="text-xs text-gray-500">Verify your department and registered college email.</span></button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center justify-between mb-5"><div><p className="text-xs uppercase tracking-wide text-gray-400">Sign up as</p><h2 className="font-semibold text-gray-900">{role === "STUDENT" ? "Student" : "Teacher"}</h2></div><button type="button" onClick={() => setRole("")} className="text-xs text-gray-500 hover:text-gray-900">Change</button></div>
            <label className="block text-sm text-gray-600">Department<select required value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setSemester(""); setSection(""); }} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            {role === "STUDENT" && <>
              <label className="block text-sm text-gray-600">Semester<select required value={semester} onChange={(e) => { setSemester(e.target.value); setSection(""); }} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"><option value="">Select semester</option>{semesters.map((value) => <option key={value} value={value}>Semester {value}</option>)}</select></label>
              <label className="block text-sm text-gray-600">Section<select required value={section} onChange={(e) => setSection(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"><option value="">Select section</option>{availableSections.map((item) => <option key={item.id} value={item.name.trim().toUpperCase()}>{item.name.trim().toUpperCase()}</option>)}</select></label>
            </>}
            <label className="block text-sm text-gray-600">Full name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" placeholder="Your full name" /></label>
            <label className="block text-sm text-gray-600">College email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" placeholder="you@college.edu" /></label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-sm text-green-700">{message}</div>}
            <button type="submit" disabled={busy || !!message} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">{busy ? "Checking..." : "Continue"}</button>
          </form>
        )}
        <p className="text-center text-sm text-gray-500 mt-7">Already have an account? <Link href="/login" className="text-gray-900 font-medium">Log in</Link></p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const [departments, classes] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, collegeId: true } }),
    prisma.class.findMany({ where: { semester: { in: [1, 3, 5, 7] }, sections: { some: { name: { in: ALLOWED_SECTIONS } } } }, orderBy: [{ semester: "asc" }, { program: "asc" }], select: { id: true, program: true, semester: true, departmentId: true, department: { select: { name: true } }, sections: { where: { name: { in: ALLOWED_SECTIONS } }, select: { id: true, name: true } } } }),
  ]);
  return { props: { departments, classes } };
};
