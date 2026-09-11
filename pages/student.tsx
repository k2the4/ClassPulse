import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, LogOut, User, XCircle } from "lucide-react";
import { authOptions } from "../lib/authOptions";

type Daily = { id: string; subjectCode: string; subjectName: string; date: string; slot: string; teacherName: string; present: boolean };
type Report = { code: string; name: string; type: string; attended: number; total: number; missed: number; percentage: number | null };
type Data = { student: { name: string; email: string; enrollmentNo: string }; class: { program: string; department: string; semester: number; section: string }; summary: { attended: number; total: number; missed: number; percentage: number | null }; daily: Daily[]; report: Report[] };

const today = () => new Date().toLocaleDateString("en-CA");
const displayDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function StudentPage({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/student?date=${date}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load attendance"); return d as Data; })
      .then(d => { if (active) { setData(d); setError(""); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load attendance"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  if (loading && !data) return <main className="min-h-screen bg-[#fffdf8] p-6 text-[#17223b]"><div className="mx-auto max-w-6xl">Loading your attendance...</div></main>;
  if (error && !data) return <main className="min-h-screen bg-[#fffdf8] p-6 text-[#17223b]"><div className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-white p-8"><h1 className="text-xl font-bold">Unable to load your portal</h1><p className="mt-2 text-sm text-[#6f7890]">{error}</p><button onClick={() => location.reload()} className="mt-5 rounded-xl bg-[#39268f] px-4 py-2 text-sm font-semibold text-white">Retry</button></div></main>;
  if (!data) return null;

  const pct = data.summary.percentage;
  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#17223b]">
      <header className="border-b border-[#e8e7e3] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/student" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white">CP</span><span className="text-xl font-extrabold tracking-[-0.7px]">ClassPulse</span></Link>
          <div className="flex items-center gap-4"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{data.student.name}</p><p className="text-xs text-[#7a8295]">{data.student.enrollmentNo}</p></div><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 rounded-xl border border-[#e3e3df] bg-white px-3 py-2 text-sm font-medium text-[#626b80]"><LogOut size={16}/> Sign out</button></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:py-9">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6657d9]">Student Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-1.2px]">Welcome, {data.student.name.split(" ")[0]}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#737d92]">
            <span className="font-semibold text-[#17223b]">Class: {data.class.program}</span>
            <span aria-hidden="true">·</span>
            <span>{data.class.department} Department</span>
            <span aria-hidden="true">·</span>
            <span>Semester {data.class.semester}</span>
            <span aria-hidden="true">·</span>
            <span>Section {data.class.section}</span>
          </div>
        </section>

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e5e4e1] bg-white p-5 shadow-[0_8px_25px_rgba(31,35,49,0.04)]"><p className="text-xs font-semibold text-[#7a8295]">Overall attendance</p><p className="mt-2 text-3xl font-extrabold">{pct === null ? "—" : `${pct}%`}</p><p className="mt-1 text-xs text-[#7a8295]">{data.summary.attended} attended of {data.summary.total} classes</p></div>
          <div className="rounded-2xl border border-[#e5e4e1] bg-white p-5 shadow-[0_8px_25px_rgba(31,35,49,0.04)]"><p className="text-xs font-semibold text-[#7a8295]">Classes attended</p><p className="mt-2 text-3xl font-extrabold text-[#159b62]">{data.summary.attended}</p><p className="mt-1 text-xs text-[#7a8295]">Across all recorded subjects</p></div>
          <div className="rounded-2xl border border-[#e5e4e1] bg-white p-5 shadow-[0_8px_25px_rgba(31,35,49,0.04)]"><p className="text-xs font-semibold text-[#7a8295]">Classes missed</p><p className="mt-2 text-3xl font-extrabold text-[#ef4b4b]">{data.summary.missed}</p><p className="mt-1 text-xs text-[#7a8295]">Across all recorded subjects</p></div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]">
          <div className="flex flex-col gap-4 border-b border-[#eeeeeb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="text-lg font-bold">Daily Attendance</h2><p className="mt-1 text-xs text-[#7b8498]">Attendance recorded for {displayDate(date)}.</p></div><label className="flex items-center gap-2 rounded-xl border border-[#e3e3df] bg-white px-3 py-2 text-sm"><CalendarDays size={16} className="text-[#5b4ee6]"/><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
          <div className="divide-y divide-[#eeeeeb]">{data.daily.length ? data.daily.map(item => <div key={item.id} className="flex items-center gap-4 px-5 py-4 sm:px-6"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.present ? "bg-[#eaf9f1] text-[#159b62]" : "bg-[#fff0ed] text-[#ef4b4b]"}`}>{item.present ? <CheckCircle2 size={19}/> : <XCircle size={19}/>}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.subjectName}</p><p className="mt-1 text-xs text-[#7a8295]">{item.subjectCode} · {item.slot} · {item.teacherName}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${item.present ? "bg-[#eaf9f1] text-[#159b62]" : "bg-[#fff0ed] text-[#d94b3f]"}`}>{item.present ? "Present" : "Absent"}</span></div>) : <div className="px-6 py-10 text-center"><p className="text-sm font-semibold">No attendance recorded for this date.</p><p className="mt-1 text-xs text-[#8a92a3]">Try another date once classes have been marked.</p></div>}</div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]">
          <div className="border-b border-[#eeeeeb] px-5 py-5 sm:px-6"><h2 className="text-lg font-bold">Subject Attendance Report</h2><p className="mt-1 text-xs text-[#7b8498]">Your attendance performance for every subject.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-[#eeeeeb] text-xs font-bold uppercase tracking-wide text-[#8a92a3]"><th className="px-5 py-3 sm:px-6">Subject</th><th className="px-5 py-3">Classes</th><th className="px-5 py-3">Attended</th><th className="px-5 py-3">Missed</th><th className="px-5 py-3">Attendance</th></tr></thead><tbody>{data.report.map(item => <tr key={item.code} className="border-b border-[#f0efed] last:border-0"><td className="px-5 py-4 sm:px-6"><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-[#8a92a3]">{item.code} · {item.type}</p></td><td className="px-5 py-4 text-sm">{item.total}</td><td className="px-5 py-4 text-sm font-semibold text-[#159b62]">{item.attended}</td><td className="px-5 py-4 text-sm font-semibold text-[#ef4b4b]">{item.missed}</td><td className="px-5 py-4 text-sm font-extrabold">{item.percentage === null ? "—" : `${item.percentage}%`}</td></tr>)}</tbody></table></div>
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  if ((session.user as any).role !== "STUDENT") return { redirect: { destination: (session.user as any).role === "ADMIN" ? "/admin" : "/dashboard", permanent: false } };
  return { props: { initialDate: today() } };
};
