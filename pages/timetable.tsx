import type { GetServerSideProps } from "next";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, LogOut, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { authOptions } from "../lib/authOptions";

type Subject = { id: string; name: string; code: string; teachers: { id: string; name: string }[] };
type Section = { id: string; label: string; subjects: Subject[] };
type Entry = { id: string; sectionId: string; subjectId: string; teacherId: string | null; dayOfWeek: number; startTime: string; endTime: string; room: string | null; note: string | null; sectionLabel: string; subjectName: string; subjectCode: string; teacherName: string };
type FormState = { id?: string; sectionId: string; subjectId: string; teacherId: string; dayOfWeek: number; startTime: string; endTime: string; room: string; note: string };
const DAYS = [{ id: 1, label: "Monday" }, { id: 2, label: "Tuesday" }, { id: 3, label: "Wednesday" }, { id: 4, label: "Thursday" }, { id: 5, label: "Friday" }, { id: 6, label: "Saturday" }];
const EMPTY: FormState = { sectionId: "", subjectId: "", teacherId: "", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", room: "", note: "" };
const formatTime = (value: string) => { const parts = value.split(":").map(Number); return String(parts[0] % 12 || 12) + ":" + String(parts[1]).padStart(2, "0") + " " + (parts[0] >= 12 ? "PM" : "AM"); };

export default function TimetablePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState(1);
  const [view, setView] = useState<"week" | "day">("week");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/timetable", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load timetable");
      setEntries(data.entries); setSections(data.sections); setCanManage(data.canManage);
      setForm((current) => ({ ...current, sectionId: current.sectionId || data.sections[0]?.id || "", subjectId: current.subjectId || data.sections[0]?.subjects[0]?.id || "" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load timetable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => entries.filter((entry) => filter === "all" || entry.sectionId === filter), [entries, filter]);
  const activeSection = sections.find((item) => item.id === form.sectionId);
  const activeSubject = activeSection?.subjects.find((item) => item.id === form.subjectId);
  const forDay = (dayNumber: number) => visible.filter((entry) => entry.dayOfWeek === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const create = (dayNumber = day) => { setForm({ ...EMPTY, sectionId: sections[0]?.id || "", subjectId: sections[0]?.subjects[0]?.id || "", dayOfWeek: dayNumber }); setError(""); setModal(true); };
  const edit = (entry: Entry) => { setForm({ id: entry.id, sectionId: entry.sectionId, subjectId: entry.subjectId, teacherId: entry.teacherId || "", dayOfWeek: entry.dayOfWeek, startTime: entry.startTime, endTime: entry.endTime, room: entry.room || "", note: entry.note || "" }); setError(""); setModal(true); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/timetable", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save timetable slot");
      setModal(false); setNotice("Timetable saved."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save timetable slot"); }
    finally { setSaving(false); }
  };
  const remove = async (entry: Entry) => {
    if (!window.confirm("Delete " + entry.subjectName + " from " + DAYS[entry.dayOfWeek - 1].label + "?")) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/timetable?id=" + encodeURIComponent(entry.id), { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not delete slot");
      setNotice("Timetable slot deleted."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete slot"); }
  };
  const card = (entry: Entry) => <article key={entry.id} className="rounded-xl border border-[#e7e5f2] bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2"><span className="rounded-md bg-[#eeeaff] px-2 py-1 text-[11px] font-semibold text-[#4b36a7]">{entry.subjectCode}</span>{canManage && <div className="flex gap-2"><button onClick={() => edit(entry)} className="text-xs font-semibold text-[#4b36a7]">Edit</button><button onClick={() => void remove(entry)} aria-label="Delete timetable slot" className="text-[#9a4b55]"><Trash2 size={14}/></button></div>}</div>
    <h3 className="mt-2 text-sm font-bold">{entry.subjectName}</h3><p className="mt-1 text-xs text-[#677187]">{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</p><p className="mt-1 text-xs text-[#677187]">{entry.sectionLabel}</p><p className="mt-1 text-xs text-[#677187]">Teacher: {entry.teacherName}{entry.room ? " · " + entry.room : ""}</p>{entry.note && <p className="mt-2 border-t pt-2 text-xs text-[#7b8498]">{entry.note}</p>}
  </article>;

  return <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex">
    <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:flex lg:min-h-screen lg:flex-col lg:fixed lg:inset-y-0 lg:left-0"><div className="px-5 pt-6"><Link href="/dashboard" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white"><Activity size={21}/></span><span className="text-xl font-extrabold">ClassPulse</span></Link></div><nav className="mt-8 space-y-1 px-3 text-sm font-medium text-[#626b80]"><Link href="/dashboard" className="block rounded-xl px-3 py-3 hover:bg-[#f6f4ff]">Dashboard</Link><Link href="/attendance-agent" className="block rounded-xl px-3 py-3 hover:bg-[#f6f4ff]">Attendance Agent</Link><Link href="/timetable" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><CalendarDays size={18}/>Timetable</Link><Link href="/class-analysis" className="block rounded-xl px-3 py-3 hover:bg-[#f6f4ff]">Class Analysis</Link><Link href="/subject-analysis" className="block rounded-xl px-3 py-3 hover:bg-[#f6f4ff]">Subject Analysis</Link></nav><div className="mt-auto px-4 pb-5"><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-3 border-t border-[#eeeeeb] px-3 pt-5 text-sm"><LogOut size={18}/>Sign out</button></div></aside>
    <main className="w-full lg:ml-[220px]"><div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[1.8px] text-[#5b4ee6]">Academic management</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Timetable</h1><p className="mt-2 text-sm text-[#70798e]">Manage weekly teaching slots and prevent section and teacher clashes.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button>{canManage && <button onClick={() => create()} disabled={!sections.length} className="inline-flex items-center gap-2 rounded-xl bg-[#39268f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16}/>Add class slot</button>}</div></header>
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#737d92]">Scheduled slots</p><p className="mt-2 text-2xl font-extrabold">{visible.length}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#737d92]">Sections with classes</p><p className="mt-2 text-2xl font-extrabold">{new Set(visible.map((entry) => entry.sectionId)).size}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#737d92]">Teaching days</p><p className="mt-2 text-2xl font-extrabold">{new Set(visible.map((entry) => entry.dayOfWeek)).size} / 6</p></div></section>
      <section className="mt-5 rounded-2xl border border-[#e8e7e3] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Weekly schedule</h2><p className="mt-1 text-xs text-[#7b8498]">{canManage ? "Choose a section, then add or edit its teaching slots." : "Your assigned teaching schedule."}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Filter by section" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="all">All available sections</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select><div className="flex rounded-lg border p-1"><button onClick={() => setView("week")} className={"rounded-md px-3 py-1.5 text-sm " + (view === "week" ? "bg-[#eeeaff] font-bold text-[#4b36a7]" : "text-[#737d92]")}>Week</button><button onClick={() => setView("day")} className={"rounded-md px-3 py-1.5 text-sm " + (view === "day" ? "bg-[#eeeaff] font-bold text-[#4b36a7]" : "text-[#737d92]")}>Day</button></div></div></div>
        {view === "day" && <div className="mt-4 flex items-center justify-between rounded-lg bg-[#f8f7ff] p-2"><button onClick={() => setDay((value) => Math.max(1, value - 1))} disabled={day === 1} className="rounded-md p-2 disabled:opacity-30"><ChevronLeft size={18}/></button><strong className="text-sm">{DAYS[day - 1].label}</strong><button onClick={() => setDay((value) => Math.min(6, value + 1))} disabled={day === 6} className="rounded-md p-2 disabled:opacity-30"><ChevronRight size={18}/></button></div>}
        {error && !modal && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <p className="py-12 text-center text-sm text-[#737d92]">Loading timetable…</p> : visible.length === 0 ? <div className="py-14 text-center"><CalendarDays size={34} className="mx-auto text-[#aaa4d7]"/><h3 className="mt-3 font-bold">No timetable entries yet</h3><p className="mt-1 text-sm text-[#737d92]">{canManage ? "Add the first class slot to build your weekly schedule." : "Your schedule will appear once an administrator adds classes."}</p>{canManage && <button onClick={() => create()} disabled={!sections.length} className="mt-4 rounded-lg bg-[#39268f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} className="mr-1 inline"/>Add first slot</button>}</div> : <div className={"mt-5 grid gap-3 " + (view === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>{DAYS.filter((item) => view === "week" || item.id === day).map((item) => <section key={item.id} className="min-w-0 rounded-xl border border-[#eceaf3] bg-[#fcfbff] p-3"><div className="mb-3 flex items-center justify-between border-b border-[#eae8f2] pb-2"><div><h3 className="font-bold">{item.label}</h3><p className="text-[11px] text-[#8a91a2]">{forDay(item.id).length} classes</p></div>{canManage && <button onClick={() => create(item.id)} aria-label={"Add class on " + item.label} className="rounded-lg p-2 text-[#4b36a7] hover:bg-[#eeeaff]"><Plus size={16}/></button>}</div><div className="space-y-2">{forDay(item.id).length ? forDay(item.id).map(card) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-[#9a9fb0]">No classes</p>}</div></section>)}</div>}
      </section>{notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    </div></main>
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111827]/50 p-4"><form onSubmit={save} className="my-6 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">{form.id ? "Edit timetable slot" : "Add timetable slot"}</h2><p className="mt-1 text-sm text-[#737d92]">Conflicts are checked before saving.</p></div><button type="button" onClick={() => setModal(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-gray-100"><X size={18}/></button></div>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Section<select required value={form.sectionId} onChange={(e) => { const next = sections.find((item) => item.id === e.target.value); setForm((current) => ({ ...current, sectionId: e.target.value, subjectId: next?.subjects[0]?.id || "", teacherId: "" })); }} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Subject<select required value={form.subjectId} onChange={(e) => setForm((current) => ({ ...current, subjectId: e.target.value, teacherId: activeSection?.subjects.find((item) => item.id === e.target.value)?.teachers[0]?.id || "" }))} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"><option value="">Choose subject</option>{(activeSection?.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}</select></label>
      <label className="text-sm font-semibold">Teacher<select value={form.teacherId} onChange={(e) => setForm((current) => ({ ...current, teacherId: e.target.value }))} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"><option value="">Use assigned teacher</option>{(activeSubject?.teachers || []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Day<select value={form.dayOfWeek} onChange={(e) => setForm((current) => ({ ...current, dayOfWeek: Number(e.target.value) }))} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal">{DAYS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Start time<input required type="time" value={form.startTime} onChange={(e) => setForm((current) => ({ ...current, startTime: e.target.value }))} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">End time<input required type="time" min={form.startTime} value={form.endTime} onChange={(e) => setForm((current) => ({ ...current, endTime: e.target.value }))} className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">Room / Lab<input maxLength={80} value={form.room} onChange={(e) => setForm((current) => ({ ...current, room: e.target.value }))} placeholder="e.g. ECE-204" className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"/></label>
      <label className="text-sm font-semibold">Note<input maxLength={300} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="Optional" className="mt-1 block w-full rounded-lg border px-3 py-2.5 font-normal"/></label></div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-[#39268f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : form.id ? "Save changes" : "Create slot"}</button></div></form></div>}
  </div>;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  if ((session.user as any).role === "STUDENT") return { redirect: { destination: "/student", permanent: false } };
  return { props: {} };
};