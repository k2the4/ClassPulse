import { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";

interface ClassRow {
  id: string;
  label: string;
  department: string;
  semester: number;
  section: string;
  students: number;
  teachers: number;
  subjects: number;
  updated: string;
}

interface ActivityRow {
  text: string;
  detail: string;
  date: string;
}

interface Props {
  adminName: string;
  counts: { students: number; teachers: number; classes: number; subjects: number };
  system: {
    database: boolean;
    sheetsLinked: number;
    lastSync: string | null;
    unlinkedSections: number;
    unlinkedSubjects: number;
  };
  classes: ClassRow[];
  activity: ActivityRow[];
}

const formatDate = (value: Date | null) =>
  value
    ? value.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "Never";

export default function AdminDashboard({ adminName, counts, system, classes, activity }: Props) {
  const initials = adminName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
  const issueCount = system.unlinkedSections + system.unlinkedSubjects;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-mark">⌁</span>
          <span>ClassPulse</span>
        </Link>
        <p className="admin-portal-label">ADMIN PORTAL</p>

        <nav className="admin-nav">
          <Link href="/admin" className="admin-nav-link active"><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/admin/classes" className="admin-nav-link"><BookOpen size={18} /> Classes</Link>
          <Link href="/admin/students" className="admin-nav-link"><GraduationCap size={18} /> Students</Link>
          <Link href="/admin/teachers" className="admin-nav-link"><Users size={18} /> Teachers</Link>
          <Link href="/admin/subjects" className="admin-nav-link"><BookOpen size={18} /> Subjects</Link>
          <Link href="/admin/assignments" className="admin-nav-link"><Link2 size={18} /> Assignments</Link>
          <Link href="/admin/settings" className="admin-nav-link"><Settings size={18} /> System Settings</Link>
        </nav>

        <div className="admin-user-block">
          <div className="admin-user">
            <span className="admin-avatar">{initials}</span>
            <span><strong>{adminName}</strong><small>Administrator</small></span>
          </div>
          <button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <div className="admin-mobile-brand"><span className="admin-brand-mark">⌁</span><strong>ClassPulse</strong></div>
            <h1>Good evening, {adminName.split(" ")[0]}</h1>
            <p>Manage your institution&apos;s data and system.</p>
          </div>
          <div className="admin-header-actions">
            <label className="admin-search">
              <span>⌕</span>
              <input placeholder="Search students, teachers, classes..." aria-label="Search" />
            </label>
            <button className="admin-icon-button" aria-label="Notifications">•</button>
            <button className="admin-menu-button" aria-label="Open menu"><Menu size={19} /></button>
          </div>
        </header>

        <section className="admin-stats" aria-label="Institution totals">
          <Link href="/admin/students" className="admin-stat-card student"><span className="admin-stat-icon"><Users size={21} /></span><span><strong>{counts.students}</strong><small>Students</small></span><ArrowRight size={17} /></Link>
          <Link href="/admin/teachers" className="admin-stat-card teacher"><span className="admin-stat-icon"><GraduationCap size={21} /></span><span><strong>{counts.teachers}</strong><small>Teachers</small></span><ArrowRight size={17} /></Link>
          <Link href="/admin/classes" className="admin-stat-card class"><span className="admin-stat-icon"><BookOpen size={21} /></span><span><strong>{counts.classes}</strong><small>Classes</small></span><ArrowRight size={17} /></Link>
          <Link href="/admin/subjects" className="admin-stat-card subject"><span className="admin-stat-icon"><ShieldCheck size={21} /></span><span><strong>{counts.subjects}</strong><small>Subjects</small></span><ArrowRight size={17} /></Link>
        </section>

        <section className="admin-grid-top">
          <div className="admin-panel">
            <div className="admin-panel-heading">
              <div><h2>System status</h2><p>Basic health and data connection checks.</p></div>
              <Link href="/admin/settings">Manage <ArrowRight size={14} /></Link>
            </div>
            <div className="status-list">
              <div className="status-row"><span className="status-label"><span className="status-symbol">G</span> Google Sheets</span><span className="status-value"><i className="status-dot good" /> {system.sheetsLinked > 0 ? "Connected" : "Not configured"}</span><small>{system.sheetsLinked} linked sheets · Last sync {system.lastSync || "never"}</small></div>
              <div className="status-row"><span className="status-label"><span className="status-symbol database">●</span> Database</span><span className="status-value"><i className={`status-dot ${system.database ? "good" : "bad"}`} /> {system.database ? "Operational" : "Unavailable"}</span><small>ClassPulse data store</small></div>
              <div className="status-row"><span className="status-label"><span className="status-symbol shield">✓</span> Data structure</span><span className="status-value"><i className={`status-dot ${issueCount === 0 ? "good" : "warn"}`} /> {issueCount === 0 ? "Healthy" : `${issueCount} issues`}</span><small>{system.unlinkedSections} sections and {system.unlinkedSubjects} subjects without sheet links</small></div>
            </div>
          </div>

          <div className="admin-panel quick-panel">
            <div className="admin-panel-heading"><div><h2>Quick actions</h2><p>Common backend tasks.</p></div></div>
            <div className="quick-actions">
              <Link href="/admin/students/new">Add Student <ArrowRight size={15} /></Link>
              <Link href="/admin/teachers/new">Add Teacher <ArrowRight size={15} /></Link>
              <Link href="/admin/classes/new">Create Class <ArrowRight size={15} /></Link>
              <Link href="/admin/assignments">Manage Assignments <ArrowRight size={15} /></Link>
            </div>
          </div>
        </section>

        <section className="admin-grid-bottom">
          <div className="admin-panel class-panel">
            <div className="admin-panel-heading"><div><h2>Classes</h2><p>Recently created or updated class groups.</p></div><Link href="/admin/classes">View all <ArrowRight size={14} /></Link></div>
            <div className="admin-table-wrap">
              <table className="admin-table"><thead><tr><th>Class</th><th>Semester</th><th>Students</th><th>Teachers</th><th>Subjects</th></tr></thead><tbody>
                {classes.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><small>{item.department} · Section {item.section}</small></td><td>{item.semester}</td><td>{item.students}</td><td>{item.teachers}</td><td>{item.subjects}</td></tr>)}
              </tbody></table>
            </div>
          </div>

          <div className="admin-panel activity-panel">
            <div className="admin-panel-heading"><div><h2>Recent activity</h2><p>Latest changes in ClassPulse.</p></div></div>
            <div className="activity-list">
              {activity.map((item, index) => <div className="activity-row" key={`${item.text}-${index}`}><span className="activity-dot"><CheckCircle2 size={16} /></span><div><strong>{item.text}</strong><small>{item.detail}</small></div><time>{item.date}</time></div>)}
            </div>
          </div>
        </section>

        <div className={`admin-footer-status ${issueCount === 0 ? "healthy" : "attention"}`}>
          {issueCount === 0 ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
          <span>{issueCount === 0 ? "All connected data looks healthy." : `${issueCount} data connection${issueCount === 1 ? "" : "s"} need attention.`}</span>
          <Link href="/admin/settings">Review <ArrowRight size={14} /></Link>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };

  const role = (session.user as any).role;
  if (role !== "ADMIN") return { redirect: { destination: "/dashboard", permanent: false } };

  try {
    const [students, teachers, classesCount, subjects, sections, linkedSections, linkedSubjects] = await Promise.all([
      prisma.student.count(),
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.section.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          class: { include: { department: true } },
          students: { select: { id: true } },
          subjects: { include: { assignments: { select: { teacherId: true } } } },
        },
      }),
      prisma.sheetLink.count({ where: { sectionId: { not: null } } }),
      prisma.sheetLink.count({ where: { subjectId: { not: null } } }),
    ]);

    const [totalSections, totalSubjectsWithLinks, latestSync] = await Promise.all([
      prisma.section.count(),
      prisma.subject.count(),
      prisma.sheetLink.findFirst({ orderBy: { lastSyncAt: "desc" }, select: { lastSyncAt: true } }),
    ]);

    const classRows: ClassRow[] = sections.map((section) => {
      const teacherIds = new Set(section.subjects.flatMap((subject) => subject.assignments.map((assignment) => assignment.teacherId)));
      return {
        id: section.id,
        label: `${section.class.department.name} ${section.class.semester} — Section ${section.name}`,
        department: section.class.department.name,
        semester: section.class.semester,
        section: section.name,
        students: section.students.length,
        teachers: teacherIds.size,
        subjects: section.subjects.length,
        updated: section.createdAt.toISOString(),
      };
    });

    const activity: ActivityRow[] = sections.slice(0, 5).map((section) => ({
      text: "Class structure available",
      detail: `${section.class.department.name} Sem ${section.class.semester} · Section ${section.name}`,
      date: formatDate(section.createdAt),
    }));

    return {
      props: {
        adminName: session.user.name || session.user.email || "Administrator",
        counts: { students, teachers, classes: classesCount, subjects },
        system: {
          database: true,
          sheetsLinked: linkedSections + linkedSubjects,
          lastSync: formatDate(latestSync?.lastSyncAt || null),
          unlinkedSections: Math.max(totalSections - linkedSections, 0),
          unlinkedSubjects: Math.max(totalSubjectsWithLinks - linkedSubjects, 0),
        },
        classes: classRows,
        activity,
      },
    };
  } catch {
    return { redirect: { destination: "/login", permanent: false } };
  }
};
