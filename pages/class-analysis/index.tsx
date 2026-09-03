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
    <div className="analysis-chooser">
      <aside>
        <div className="chooser-brand"><Link href="/dashboard"><span className="chooser-brand-mark"><BarChart3 size={21} strokeWidth={2.2} /></span><span>ClassPulse</span></Link></div>
        <div className="chooser-profile"><span>{initials}</span><div><p>{teacherName}</p><small>Faculty</small></div></div>
        <nav>
          <Link href="/dashboard"><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/attendance-agent"><UserRoundPlus size={18} /> Attendance Agent</Link>
          <Link href="/timetable"><CalendarDays size={18} /> Timetable</Link>
          <Link href="/class-analysis" className="active"><BarChart3 size={18} /> Class Analysis</Link>
          <Link href="/subject-analysis"><BookOpen size={18} /> Subject Analysis</Link>
        </nav>
        <button className="chooser-signout" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={18} /> Sign out</button>
      </aside>
      <main>
        <div className="chooser-glow" />
        <div className="chooser-content">
          <Link href="/dashboard" className="chooser-back"><ArrowLeft size={16} /> Back to Dashboard</Link>
          <div className="chooser-heading"><h1>Choose a class</h1><p>Select a class assigned to you to open its analysis.</p></div>
          <section className="chooser-panel">
            <div className="chooser-list">
              {classes.map((classOption) => (
                <Link key={classOption.id} href={`/class-analysis/${classOption.id}`} className="chooser-class-card">
                  <span className="chooser-class-icon"><BookOpen size={21} /></span>
                  <span className="chooser-class-copy"><strong>{classOption.label}</strong><small>Open attendance, academic and student analysis</small></span>
                  <ArrowRight size={19} className="chooser-arrow" />
                </Link>
              ))}
              {!classes.length && <div className="chooser-empty">No classes are assigned to you.</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  const userId = (session.user as any).id; const role = (session.user as any).role;
  const sections = await prisma.section.findMany({
    where: role === "ADMIN" ? undefined : { class: { classAccess: { some: { teacherId: userId } } } },
    include: { class: { include: { department: true } } },
  });
  const classes = new Map<string, ClassOption>();
  for (const section of sections) classes.set(section.class.id, { id: section.class.id, label: formatClassLabel(section.class.department.name, section.class.semester, section.name) });
  return { props: { classes: Array.from(classes.values()), teacherName: session.user.name || session.user.email } };
};