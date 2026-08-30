import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRoundPlus,
} from "lucide-react";

interface Props {
  teacherName: string;
  sections: { id: string; label: string }[];
  subjects: { id: string; label: string }[];
}

const quickActions = [
  { title: "Attendance Agent", description: "Take attendance for your current class", href: "/attendance-agent", icon: UserRoundPlus, tone: "bg-[#eef1ff] text-[#4b6bff]" },
  { title: "Timetable", description: "View your full class schedule", href: "/timetable", icon: CalendarDays, tone: "bg-[#eef7ff] text-[#4388d8]" },
  { title: "Class Analysis", description: "Analyze performance of a class", href: "/class-analysis", icon: BarChart3, tone: "bg-[#eaf9f1] text-[#159b62]" },
  { title: "Subject Analysis", description: "Deep dive into a subject", href: "/subject-analysis", icon: BookOpen, tone: "bg-[#fff5e7] text-[#ee9412]" },
];

const todaySchedule = [
  { time: "10:00 AM", end: "11:00 AM", subject: "Data Analysis (DA 338 T)", section: "Section A", room: "Room 104", active: true },
  { time: "11:15 AM", end: "12:15 PM", subject: "Discrete Structures (CS 203)", section: "Section B", room: "Room 203" },
  { time: "1:00 PM", end: "2:00 PM", subject: "Computer Networks (CS 302)", section: "Section A", room: "Room 105" },
  { time: "3:00 PM", end: "4:00 PM", subject: "Data Analysis (DA 338 T)", section: "Section B", room: "Room 104" },
];

const recentActivity = [
  { icon: CheckCircle2, tone: "text-[#159b62] bg-[#eaf9f1]", text: "Attendance recorded for DA 338 T — Section A", time: "10:05 AM" },
  { icon: FileText, tone: "text-[#6c55e8] bg-[#f0edff]", text: "Midsem marks updated for DA 338 T — Section A", time: "Yesterday, 4:30 PM" },
  { icon: CheckCircle2, tone: "text-[#159b62] bg-[#eaf9f1]", text: "Attendance recorded for CS 203 — Section B", time: "Aug 28, 12:20 PM" },
  { icon: BarChart3, tone: "text-[#ee9412] bg-[#fff5e7]", text: "Class analysis viewed for ECE — B.Tech ECE, Sem 7", time: "Aug 28, 11:15 AM" },
  { icon: CalendarDays, tone: "text-[#4388d8] bg-[#eef7ff]", text: "Timetable updated", time: "Aug 27, 3:45 PM" },
];

export default function Dashboard({ teacherName }: Props) {
  const initials = teacherName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex">
      <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:flex lg:min-h-screen lg:flex-col lg:fixed lg:inset-y-0 lg:left-0">
        <div className="px-5 pt-6"><Link href="/dashboard" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white"><BarChart3 size={21} strokeWidth={2.2} /></span><span className="text-[20px] font-extrabold tracking-[-0.7px]">ClassPulse</span></Link></div>
        <div className="mx-5 mt-7 flex items-center gap-3 border-b border-[#eeeeeb] pb-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eeeaff] text-sm font-bold text-[#4b36a7]">{initials || "T"}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{teacherName}</p><p className="text-xs text-[#7a8295]">Faculty</p></div></div>
        <nav className="mt-5 space-y-1 px-3 text-sm font-medium text-[#626b80]">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/attendance-agent" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><UserRoundPlus size={18} /> Attendance Agent</Link>
          <Link href="/timetable" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><CalendarDays size={18} /> Timetable</Link>
          <Link href="/class-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><BarChart3 size={18} /> Class Analysis</Link>
          <Link href="/subject-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><BookOpen size={18} /> Subject Analysis</Link>
          <Link href="/raw-data" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><Database size={18} /> Raw Data</Link>
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#f6f4ff] hover:text-[#38258e]"><Bell size={18} /> Notifications</button>
        </nav>
        <div className="mt-auto px-4 pb-5"><div className="rounded-2xl border border-[#ded8ff] bg-[#faf9ff] p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#5842e8]"><HelpCircle size={18} /></span><div><p className="text-xs font-bold">Need Help?</p><p className="mt-1 text-[11px] leading-5 text-[#7a8295]">Visit our help center or contact support.</p></div></div><button type="button" className="mt-3 w-full rounded-lg border border-[#9d91ff] bg-white px-3 py-2 text-xs font-semibold text-[#5842e8]">Help Center <ArrowRight size={13} className="ml-1 inline" /></button></div><button onClick={() => signOut({ callbackUrl: "/login" })} className="mt-5 flex w-full items-center gap-3 border-t border-[#eeeeeb] px-3 pt-5 text-sm font-medium text-[#626b80] hover:text-[#17223b]"><LogOut size={18} /> Sign out</button></div>
      </aside>
      <main className="w-full lg:ml-[220px]"><div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <header className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white"><BarChart3 size={20} /></span><span className="text-lg font-extrabold">ClassPulse</span></div><h1 className="mt-5 text-[28px] font-extrabold tracking-[-1.2px] sm:text-[32px] lg:mt-0">Welcome back, {teacherName}</h1><p className="mt-1 text-sm text-[#6f7890]">Here&apos;s an overview of your day.</p></div><div className="flex items-center gap-3"><button type="button" className="relative grid h-11 w-11 place-items-center rounded-xl border border-[#e3e3df] bg-white text-[#566078] shadow-sm"><Bell size={19} /><span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#ef4b4b] text-[10px] font-bold text-white">3</span></button><div className="hidden items-center gap-2 rounded-xl border border-[#e3e3df] bg-white px-4 py-3 text-sm font-medium text-[#3e465b] shadow-sm sm:flex"><CalendarDays size={17} className="text-[#5b4ee6]" />{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div><button type="button" className="grid h-11 w-11 place-items-center rounded-xl border border-[#e3e3df] bg-white text-[#566078] sm:hidden"><Menu size={19} /></button></div></header>
        <section className="mt-8 rounded-2xl border border-[#e5e4e1] bg-white p-5 shadow-[0_8px_25px_rgba(31,35,49,0.04)] sm:p-6"><div className="mb-5"><h2 className="text-lg font-bold">Quick Actions</h2><p className="mt-1 text-xs text-[#7b8498]">Jump straight into the tools you use most.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map((action) => { const Icon = action.icon; return <Link key={action.title} href={action.href} className="group flex min-h-[116px] items-center gap-4 rounded-xl border border-[#e6e6e5] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#d9d2ff] hover:shadow-[0_8px_24px_rgba(57,38,143,0.08)]"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${action.tone}`}><Icon size={23} strokeWidth={2} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#17223b]">{action.title}</span><span className="mt-1 block text-xs leading-5 text-[#747d91]">{action.description}</span></span><ArrowRight size={18} className="shrink-0 text-[#626b80] transition group-hover:translate-x-1 group-hover:text-[#4b36a7]" /></Link>; })}</div></section>
        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.18fr]"><div className="rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]"><div className="flex items-center justify-between border-b border-[#eeeeeb] px-5 py-5 sm:px-6"><div><h2 className="text-lg font-bold">Today&apos;s Timetable</h2><p className="mt-1 text-xs text-[#7b8498]">Your scheduled classes for today.</p></div><Link href="/timetable" className="text-xs font-semibold text-[#5b4ee6] hover:underline">View full timetable <ArrowRight size={13} className="ml-1 inline" /></Link></div><div className="p-5 sm:px-6">{todaySchedule.map((item, index) => <div key={`${item.time}-${item.subject}`} className="relative flex gap-4 pb-5 last:pb-0"><div className="flex w-[66px] shrink-0 flex-col text-right text-xs font-medium text-[#667088]"><span>{item.time}</span><span className="mt-1 text-[11px] text-[#9aa1af]">{item.end}</span></div><div className="relative flex-1 border-b border-[#eeeeeb] pb-5 pl-5 last:border-0"><span className={`absolute left-0 top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-white ${item.active ? "bg-[#5b4ee6]" : "bg-[#c8c3f5]"}`} />{index < todaySchedule.length - 1 && <span className="absolute left-0 top-3 h-full w-px -translate-x-1/2 bg-[#ddd9fb]" />}<p className="text-sm font-bold">{item.subject}</p><p className="mt-1 text-xs text-[#737d92]">{item.section} <span className="mx-1">•</span> {item.room}</p>{item.active && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f0edff] px-2 py-1 text-[10px] font-semibold text-[#5b4ee6]"><Clock3 size={11} /> Next class</span>}</div></div>)}</div></div><div className="rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]"><div className="border-b border-[#eeeeeb] px-5 py-5 sm:px-6"><h2 className="text-lg font-bold">Recent Activity</h2><p className="mt-1 text-xs text-[#7b8498]">Your latest activity.</p></div><div className="divide-y divide-[#eeeeeb] px-5 sm:px-6">{recentActivity.map((activity, index) => { const Icon = activity.icon; return <div key={`${activity.text}-${index}`} className="flex items-center gap-3 py-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${activity.tone}`}><Icon size={17} /></span><p className="min-w-0 flex-1 text-xs font-medium leading-5 text-[#3f485d]">{activity.text}</p><span className="shrink-0 text-[10px] font-medium text-[#8991a2]">{activity.time}</span></div>; })}</div></div></section>
        <footer className="py-7 text-center text-xs text-[#9aa1af]">© 2026 ClassPulse. All rights reserved.</footer>
      </div></main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const sectionsRaw = await prisma.section.findMany({ where: role === "ADMIN" ? undefined : { OR: [{ class: { proctorId: userId } }, { subjects: { some: { assignments: { some: { teacherId: userId } } } } }] }, include: { class: { include: { department: true } } } });
  const subjectsRaw = await prisma.subject.findMany({ where: role === "ADMIN" ? {} : { assignments: { some: { teacherId: userId } } }, include: { section: { include: { class: true } } } });
  const classMap = new Map<string, { id: string; label: string }>();
  for (const section of sectionsRaw) classMap.set(section.class.id, { id: section.class.id, label: `${section.class.department.name}-${section.name} Sem ${section.class.semester}` });
  return { props: { teacherName: session.user.name || session.user.email, sections: Array.from(classMap.values()), subjects: subjectsRaw.map((subject) => ({ id: subject.id, label: `${subject.name} (${subject.code})` })) } };
};
