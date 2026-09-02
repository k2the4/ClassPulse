import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { BarChart3, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, LayoutDashboard, LogOut, Trash2, UserRoundPlus } from "lucide-react";

type Student = { id: string; enrollmentNo: string; name: string; serialNo: number };
type Subject = { id: string; name: string; code: string; type: string };
type Section = { id: string; label: string; strength: number };
type Session = { id: string; subjectId: string; subjectName: string; subjectCode: string; slot: string; teacherId: string; teacherName: string; present: number; total: number; canEdit: boolean };

type Props = { teacherName: string; sections: Section[]; initialSectionId: string; initialStudents: Student[]; initialSubjects: Subject[]; };
type ApiData = { section: Section; subjects: Subject[]; students: Student[]; sessions: Session[] };

const TIME_SLOTS = [
  "8 to 9",
  "9 to 10",
  "10 to 11",
  "11 to 12",
  "12.30 to 1.30",
  "1.30 to 2.30",
  "2.30 to 3.30",
  "3.30 to 4.30",
];

function today() { return new Date().toLocaleDateString("en-CA"); }

function Sidebar({ teacherName }: { teacherName: string }) {
  const initials = teacherName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
  return <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:flex lg:min-h-screen lg:flex-col lg:fixed lg:inset-y-0 lg:left-0">
    <div className="px-5 pt-6"><Link href="/dashboard" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white shadow-[0_10px_25px_rgba(57,38,143,0.2)]"><BarChart3 size={21} strokeWidth={2.2} /></span><span className="text-[20px] font-extrabold tracking-[-0.7px]">ClassPulse</span></Link></div>
    <div className="mx-5 mt-7 flex items-center gap-3 border-b border-[#eeeeeb] pb-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-sm font-bold text-[#4b36a7]">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{teacherName}</p><p className="text-xs text-[#7a8295]">Faculty</p></div></div>
    <nav className="mt-5 space-y-1 px-3 text-sm font-medium text-[#626b80]"><Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><LayoutDashboard size={18}/> Dashboard</Link><Link href="/attendance-agent" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><UserRoundPlus size={18}/> Attendance Agent</Link><Link href="/timetable" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><CalendarDays size={18}/> Timetable</Link><Link href="/class-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><BarChart3 size={18}/> Class Analysis</Link><Link href="/subject-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><BookOpen size={18}/> Subject Analysis</Link></nav>
    <div className="mt-auto px-4 pb-5"><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-3 border-t border-[#eeeeeb] px-3 pt-5 text-sm font-medium text-[#626b80] hover:text-[#17223b]"><LogOut size={18}/> Sign out</button></div>
  </aside>;
}

export default function AttendanceAgent({ teacherName, sections, initialSectionId, initialStudents, initialSubjects }: Props) {
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [students, setStudents] = useState(initialStudents);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjectId, setSubjectId] = useState(initialSubjects[0]?.id || "");
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState("");
  const [present, setPresent] = useState<Set<string>>(new Set(initialStudents.map((student) => student.id)));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedSession = sessions.find((session) => session.subjectId === subjectId && session.slot === slot);
  const showStudentList = !selectedSession || editingId === selectedSession.id;
  const allPresent = students.length > 0 && present.size === students.length;
  const presentCount = students.filter((student) => present.has(student.id)).length;

  async function loadSection(nextSectionId: string, nextDate = date) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/attendance-agent?sectionId=${encodeURIComponent(nextSectionId)}&date=${encodeURIComponent(nextDate)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load class");
      const result = data as ApiData;
      setStudents(result.students); setSubjects(result.subjects); setSessions(result.sessions);
      setSubjectId((current) => result.subjects.some((subject) => subject.id === current) ? current : result.subjects[0]?.id || "");
      setPresent(new Set(result.students.map((student) => student.id))); setEditingId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load class"); }
    finally { setLoading(false); }
  }

  async function loadDate(nextDate: string) {
    setDate(nextDate); await loadSection(sectionId, nextDate);
  }

  useEffect(() => { loadSection(initialSectionId, date); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(studentId: string) {
    setPresent((current) => { const next = new Set(current); if (next.has(studentId)) next.delete(studentId); else next.add(studentId); return next; });
  }

  function toggleAll() {
    setPresent(allPresent ? new Set() : new Set(students.map((student) => student.id)));
  }

  async function editSession(session: Session) {
    if (!session.canEdit) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/attendance-agent?sectionId=${encodeURIComponent(sectionId)}&date=${encodeURIComponent(date)}&sessionId=${encodeURIComponent(session.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load attendance");
      setSubjectId(session.subjectId); setSlot(session.slot); setPresent(new Set(data.presentStudentIds)); setEditingId(session.id); setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load attendance"); }
    finally { setLoading(false); }
  }

  async function deleteSession(session: Session) {
    if (!session.canEdit || deletingId) return;
    const confirmed = window.confirm(`Delete attendance for ${session.subjectName} (${session.subjectCode}) at ${session.slot}?\n\nThis will permanently remove this attendance session from ClassPulse and the Teacher Diary. This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(session.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance-agent", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId, sessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete attendance");
      if (editingId === session.id) setEditingId("");
      setMessage(`Attendance deleted — ${session.subjectName} · ${session.slot}.`);
      await loadSection(sectionId, date);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete attendance"); }
    finally { setDeletingId(""); }
  }

  async function submit() {
    if (!subjectId || !slot || students.length === 0) { setError("Choose a subject and time slot before saving."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/attendance-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId, subjectId, date, slot, presentStudentIds: [...present] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save attendance");
      setMessage(`Attendance saved — ${data.present} present, ${data.total - data.present} absent.`); setEditingId("");
      await loadSection(sectionId, date);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save attendance"); }
    finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex"><Sidebar teacherName={teacherName}/><main className="w-full lg:ml-[220px]"><div className="relative min-h-screen overflow-hidden"><div className="pointer-events-none absolute right-0 top-0 h-[330px] w-[650px] opacity-70" style={{ background: "radial-gradient(circle at 70% 20%, rgba(111,91,231,.16), transparent 48%), linear-gradient(145deg, transparent 35%, rgba(111,91,231,.07) 75%, transparent)" }}/><div className="relative mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b4ee6] hover:underline">← Back to Dashboard</Link>
    <div className="mt-8"><p className="text-sm font-semibold text-[#5b4ee6]">Attendance Agent</p><h1 className="mt-2 text-[34px] font-extrabold tracking-[-1.4px] sm:text-[40px]">Take attendance</h1><p className="mt-2 text-sm leading-6 text-[#6f7890]">Record attendance for a class session. Present students are marked LA = 1 and every student in the session receives LH = 1.</p></div>

    <section className="mt-8 rounded-2xl border border-[#e5e4e1] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,0.05)] sm:p-8">
      <div className="grid gap-5 md:grid-cols-2"><Field label="Class"><div className="relative"><select value={sectionId} onChange={(e) => { setSectionId(e.target.value); loadSection(e.target.value); }} className="input"><option value="">Select class</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-3.5 text-[#68738a]" size={17}/></div></Field><Field label="Date"><input type="date" value={date} onChange={(e) => loadDate(e.target.value)} className="input"/></Field><Field label="Subject"><div className="relative"><select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setEditingId(""); }} className="input"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-3.5 text-[#68738a]" size={17}/></div></Field><Field label="Time slot"><div className="relative"><select value={slot} onChange={(e) => { setSlot(e.target.value); setEditingId(""); }} className="input"><option value="">Select time slot</option>{TIME_SLOTS.map((timeSlot) => <option key={timeSlot} value={timeSlot}>{timeSlot}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-3.5 text-[#68738a]" size={17}/></div></Field></div>
      {selectedSubject && <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#faf9ff] px-4 py-3 text-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eeeaff] text-[#5842e8]"><BookOpen size={17}/></span><div><p className="font-semibold">{selectedSubject.name}</p><p className="text-xs text-[#7a8295]">{selectedSubject.code} · {selectedSubject.type === "LAB" ? "Lab" : "Theory"}</p></div></div>}
    </section>

    <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_30px_rgba(31,35,49,0.05)]">
      {showStudentList ? <>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eeeeeb] px-6 py-5 sm:px-8"><div><h2 className="text-lg font-bold">Students</h2><p className="mt-1 text-xs text-[#7b8498]">{presentCount} of {students.length} marked present</p></div><button type="button" onClick={toggleAll} className="rounded-lg border border-[#d9d5ef] px-3 py-2 text-xs font-semibold text-[#4b36a7] hover:bg-[#faf9ff]">{allPresent ? "Mark all absent" : "Mark all present"}</button></div>
        <div className="max-h-[520px] overflow-y-auto divide-y divide-[#eeeeeb]">{loading ? <div className="px-6 py-10 text-center text-sm text-[#7a8295]">Loading class…</div> : students.map((student) => { const isPresent = present.has(student.id); return <button type="button" key={student.id} onClick={() => toggle(student.id)} className="flex w-full items-center gap-4 px-6 py-3.5 text-left transition hover:bg-[#faf9ff] sm:px-8"><span className="w-8 text-xs font-semibold text-[#68738a]">{student.serialNo}</span><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isPresent ? "bg-[#eaf9f1] text-[#159b62]" : "bg-[#f5f5f4] text-[#a2a7b1]"}`}>{isPresent ? <Check size={17} strokeWidth={2.5}/> : null}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{student.name}</span><span className="mt-0.5 block text-xs text-[#7d8698]">{student.enrollmentNo}</span></span><span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isPresent ? "bg-[#eaf9f1] text-[#159b62]" : "bg-[#fff0f0] text-[#d95757]"}`}>{isPresent ? "Present" : "Absent"}</span></button>; })}</div>
        <div className="flex flex-col gap-3 border-t border-[#eeeeeb] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div>{error && <p className="text-sm font-medium text-[#d34f4f]">{error}</p>}{message && <p className="flex items-center gap-2 text-sm font-medium text-[#159b62]"><CheckCircle2 size={16}/>{message}</p>}{editingId && !error && <p className="text-xs text-[#7b8498]">Editing an existing attendance session.</p>}</div><button type="button" disabled={saving || loading || !!deletingId} onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4b36a7] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(75,54,167,0.18)] transition hover:bg-[#3f2d93] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : editingId ? "Update attendance" : "Save attendance"}</button></div>
      </> : <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf9f1] text-[#159b62]"><CheckCircle2 size={17}/></span><div><p className="text-sm font-semibold">Attendance recorded</p><p className="mt-1 text-xs text-[#7a8295]">{selectedSession?.present}/{selectedSession?.total} present · {selectedSession?.slot}</p></div></div>{selectedSession?.canEdit && <div className="flex items-center gap-2"><button type="button" disabled={!!deletingId} onClick={() => editSession(selectedSession)} className="rounded-lg border border-[#d9d5ef] px-4 py-2 text-xs font-semibold text-[#4b36a7] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-50">Edit attendance</button><button type="button" disabled={!!deletingId} onClick={() => deleteSession(selectedSession)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0caca] px-4 py-2 text-xs font-semibold text-[#c94747] hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-50">{deletingId === selectedSession.id ? "Deleting…" : <><Trash2 size={14}/> Delete</>}</button></div>}</div>}
    </section>

    <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_30px_rgba(31,35,49,0.05)]"><div className="border-b border-[#eeeeeb] px-6 py-5 sm:px-8"><h2 className="text-lg font-bold">Attendance recorded for this date</h2><p className="mt-1 text-xs text-[#7b8498]">Each class period is stored as a separate attendance session.</p></div>{sessions.length === 0 ? <div className="px-6 py-8 text-sm text-[#7a8295] sm:px-8">No attendance has been recorded for this class on this date.</div> : <div className="divide-y divide-[#eeeeeb]">{sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center gap-4 px-6 py-4 sm:px-8"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#5b4ee6]"><Clock3 size={17}/></span><div className="min-w-[180px] flex-1"><p className="text-sm font-semibold">{session.subjectName} <span className="text-[#8a92a3]">({session.subjectCode})</span></p><p className="mt-1 text-xs text-[#7a8295]">{session.slot} · {session.teacherName}</p></div><span className="rounded-full bg-[#eaf9f1] px-3 py-1 text-[11px] font-semibold text-[#159b62]">{session.present}/{session.total} present</span>{session.canEdit && <div className="flex items-center gap-2"><button type="button" disabled={!!deletingId} onClick={() => editSession(session)} className="rounded-lg border border-[#d9d5ef] px-3 py-2 text-xs font-semibold text-[#4b36a7] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-50">Edit</button><button type="button" disabled={!!deletingId} onClick={() => deleteSession(session)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0caca] px-3 py-2 text-xs font-semibold text-[#c94747] hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-50">{deletingId === session.id ? "Deleting…" : <><Trash2 size={14}/> Delete</>}</button></div>}</div>)}</div>}</section>
    <p className="mt-5 text-xs text-[#8991a2]">Signed in as {teacherName}. Only your assigned classes and subjects are available.</p>
  </div></div></main><style jsx>{`.input{width:100%;border:1px solid #dfe2e8;border-radius:12px;background:#fff;padding:12px 42px 12px 14px;font-size:14px;outline:none;color:#17223b}.input:focus{border-color:#6b5be7;box-shadow:0 0 0 3px rgba(107,91,231,.1)}select.input{appearance:none}`}</style></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const sections = await prisma.section.findMany({ where: role === "ADMIN" ? undefined : { OR: [{ class: { proctorId: userId } }, { subjects: { some: { assignments: { some: { teacherId: userId } } } } }] }, include: { class: { include: { department: true } }, subjects: { include: { assignments: true }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } });
  const visibleSections = sections.map((section) => ({ id: section.id, label: `${section.class.department.name}-${section.name} Sem ${section.class.semester}`, strength: section.strength }));
  const initialSectionId = visibleSections[0]?.id || "";
  const initial = sections.find((section) => section.id === initialSectionId);
  const visibleSubjects = initial ? (role === "ADMIN" ? initial.subjects : initial.subjects.filter((subject) => subject.assignments.some((assignment) => assignment.teacherId === userId))) : [];
  const students = initial ? await prisma.student.findMany({ where: { sectionId: initial.id }, orderBy: { enrollmentNo: "asc" } }) : [];
  return { props: { teacherName: session.user.name || session.user.email || "Faculty", sections: visibleSections, initialSectionId, initialStudents: students.map((student, index) => ({ id: student.id, enrollmentNo: student.enrollmentNo, name: student.name, serialNo: index + 1 })), initialSubjects: visibleSubjects.map((subject) => ({ id: subject.id, name: subject.name, code: subject.code, type: subject.type })) } };
};
