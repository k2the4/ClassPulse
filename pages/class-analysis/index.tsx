import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarDays, LayoutDashboard, LogOut, UserRoundPlus } from "lucide-react";
import { signOut } from "next-auth/react";

type ClassOption = { id: string; label: string };
type Props = { classes: ClassOption[]; teacherName: string };

function formatClassLabel(department: string, semester: number, classNumber: string) {
  return `${department}-${classNumber} Sem ${semester}`;
}

export default function ClassAnalysisIndex({ classes, teacherName }: Props) {
  const initials = teacherName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";

  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex">
      <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:flex lg:min-h-screen lg:flex-col lg:fixed lg:inset-y-0 lg:left-0">
        <div className="px-5 pt-6"><Link href="/dashboard" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white shadow-[0_10px_25px_rgba(57,38,143,0.2)]"><BarChart3 size={21} strokeWidth={2.2} /></span><span className="text-[20px] font-extrabold tracking-[-0.7px]">ClassPulse</span></Link></div>
        <div className="mx-5 mt-7 flex items-center gap-3 border-b border-[#eeeeeb] pb-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eeeaff] text-sm font-bold text-[#4b36a7]">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{teacherName}</p><p className="text-xs text-[#7a8295]">Faculty</p></div></div>
        <nav className="mt-5 space-y-1 px-3 text-sm font-medium text-[#626b80]"><Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><LayoutDashboard size={18} /> Dashboard</Link><Link href="/attendance-agent" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><UserRoundPlus size={18} /> Attendance Agent</Link><Link href="/timetable" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><CalendarDays size={18} /> Timetable</Link><Link href="/class-analysis" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><BarChart3 size={18} /> Class Analysis</Link><Link href="/subject-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6f4ff] hover:text-[#38258e]"><BookOpen size={18} /> Subject Analysis</Link></nav>
        <div className="mt-auto px-4 pb-5"><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-3 border-t border-[#eeeeeb] px-3 pt-5 text-sm font-medium text-[#626b80] hover:text-[#17223b]"><LogOut size={18} /> Sign out</button></div>
      </aside>
      <main className="w-full lg:ml-[220px]"><div className="relative min-h-screen overflow-hidden"><div className="pointer-events-none absolute right-0 top-0 h-[330px] w-[650px] opacity-70" style={{ background: "radial-gradient(circle at 70% 20%, rgba(111,91,231,.16), transparent 48%), linear-gradient(145deg, transparent 35%, rgba(111,91,231,.07) 75%, transparent)" }} /><div className="relative mx-auto max-w-[1200px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b4ee6] hover:underline"><ArrowLeft size={16} /> Back to Dashboard</Link>
        <div className="mt-8"><h1 className="mt-2 text-[34px] font-extrabold tracking-[-1.4px] sm:text-[40px]">Choose a class</h1><p className="mt-2 max-w-[650px] text-sm leading-6 text-[#6f7890]">Select a class assigned to you to open its analysis.</p></div>
        <section className="mt-8 min-h-[430px] rounded-2xl border border-[#e5e4e1] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,0.05)] sm:p-8"><div className="space-y-3">{classes.map((classOption) => <Link key={classOption.id} href={`/class-analysis/${classOption.id}`} className="group flex items-center gap-4 rounded-xl border border-[#e4e4e8] bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-[#cfc7ff] hover:bg-[#fcfbff] hover:shadow-[0_8px_24px_rgba(57,38,143,0.08)]"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6b55df]"><BookOpen size={21} /></span><span className="min-w-0 flex-1"><span className="block text-[16px] font-bold text-[#17223b]">{classOption.label}</span><span className="mt-1 block text-xs text-[#7a8295]">Open attendance, academic and student analysis</span></span><ArrowRight size={19} className="text-[#747d91] transition group-hover:translate-x-1 group-hover:text-[#4b36a7]" /></Link>)}{!classes.length && <div className="rounded-xl border border-dashed border-[#dfe2e8] bg-[#fafafa] p-6 text-sm text-[#747d91]">No classes are assigned to you.</div>}</div></section>
      </div></div></main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  const userId = (session.user as any).id; const role = (session.user as any).role;
  const sections = await prisma.section.findMany({ where: role === "ADMIN" ? undefined : { OR: [{ class: { proctorId: userId } }, { subjects: { some: { assignments: { some: { teacherId: userId } } } } }] }, include: { class: { include: { department: true } } } });
  const classes = new Map<string, ClassOption>();
  for (const section of sections) classes.set(section.class.id, { id: section.class.id, label: formatClassLabel(section.class.department.name, section.class.semester, section.name) });
  return { props: { classes: Array.from(classes.values()), teacherName: session.user.name || session.user.email } };
};
