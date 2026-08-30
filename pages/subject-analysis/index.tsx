import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, ArrowLeft, ArrowRight, BarChart3 } from "lucide-react";

interface SubjectOption { id: string; sectionId: string; name: string; code: string; }
interface ClassOption { id: string; label: string; }
interface Props { teacherName: string; classes: ClassOption[]; subjects: SubjectOption[]; }

function formatClassLabel(department: string, classNumber: string, semester: number) {
  return `${department}-${classNumber} Sem ${semester}`;
}

export default function SubjectAnalysisChooser({ teacherName, classes, subjects }: Props) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || "");
  const selectedSubjects = subjects.filter((subject) => subject.sectionId === selectedClass);
  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex">
      <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:flex lg:min-h-screen lg:flex-col lg:fixed lg:inset-y-0 lg:left-0">
        <div className="px-5 pt-6"><Link href="/dashboard" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white shadow-[0_10px_25px_rgba(57,38,143,0.2)]"><BarChart3 size={21} strokeWidth={2.2} /></span><span className="text-[20px] font-extrabold tracking-[-0.7px]">ClassPulse</span></Link></div>
        <nav className="mt-8 space-y-1 px-3 text-sm font-medium text-[#626b80]"><Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><BarChart3 size={18} /> Dashboard</Link><Link href="/subject-analysis" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><BookOpen size={18} /> Subject Analysis</Link></nav>
      </aside>
      <main className="w-full lg:ml-[220px]"><div className="relative min-h-screen overflow-hidden"><div className="pointer-events-none absolute right-0 top-0 h-[330px] w-[650px] opacity-70" style={{ background: "radial-gradient(circle at 70% 20%, rgba(111,91,231,.16), transparent 48%), linear-gradient(145deg, transparent 35%, rgba(111,91,231,.07) 75%, transparent)" }} /><div className="relative mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b4ee6] hover:underline"><ArrowLeft size={16} /> Back to Dashboard</Link>
        <div className="mt-8"><p className="text-sm font-semibold text-[#5b4ee6]">Subject Analysis</p><h1 className="mt-2 text-[34px] font-extrabold tracking-[-1.4px] sm:text-[40px]">Choose a class and subject</h1><p className="mt-2 max-w-[650px] text-sm leading-6 text-[#6f7890]">Select a class you are assigned to, then choose one of your assigned subjects for that class.</p></div>
        <section className="mt-8 rounded-2xl border border-[#e5e4e1] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,0.05)] sm:p-8"><label htmlFor="class" className="block text-sm font-bold">Class</label><select id="class" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe2e8] bg-white px-4 py-3 text-sm outline-none focus:border-[#6b5be7] focus:ring-2 focus:ring-[#6b5be7]/10">{classes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <div className="mt-7"><div className="flex items-center justify-between"><label className="text-sm font-bold">Assigned Subjects</label><span className="text-xs text-[#8991a2]">{selectedSubjects.length} available</span></div>{selectedSubjects.length === 0 ? <div className="mt-3 rounded-xl border border-dashed border-[#dfe2e8] bg-[#fafafa] p-5 text-sm text-[#747d91]">No subjects are assigned to you for this class.</div> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{selectedSubjects.map((subject) => <Link key={subject.id} href={`/subject-analysis/${subject.id}`} className="group flex items-center gap-4 rounded-xl border border-[#e5e4e1] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#d9d2ff] hover:shadow-[0_8px_24px_rgba(57,38,143,0.08)]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff5e7] text-[#ee9412]"><BookOpen size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{subject.name}</span><span className="mt-1 block text-xs text-[#7a8295]">{subject.code}</span></span><ArrowRight size={18} className="text-[#626b80] transition group-hover:translate-x-1 group-hover:text-[#4b36a7]" /></Link>)}</div>}</div>
        </section><p className="mt-5 text-xs text-[#8991a2]">Signed in as {teacherName}. Only your assigned classes and subjects are shown.</p>
      </div></div></main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  const userId = (session.user as any).id; const role = (session.user as any).role;
  const subjectsRaw = await prisma.subject.findMany({ where: role === "ADMIN" ? {} : { assignments: { some: { teacherId: userId } } }, include: { section: { include: { class: { include: { department: true } } } } }, orderBy: [{ section: { class: { semester: "asc" } } }, { name: "asc" }] });
  const classMap = new Map<string, ClassOption>();
  for (const subject of subjectsRaw) { const c = subject.section.class; classMap.set(c.id, { id: c.id, label: formatClassLabel(c.department.name, subject.section.name, c.semester) }); }
  return { props: { teacherName: session.user.name || session.user.email, classes: Array.from(classMap.values()), subjects: subjectsRaw.map((subject) => ({ id: subject.id, sectionId: subject.section.class.id, name: subject.name, code: subject.code })) } };
};
