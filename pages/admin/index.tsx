import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import {
  Activity,
  ArrowRight,
  Bell,
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
  UserPlus,
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
    ? value.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

const formatUpdated = (value: string) => formatDate(new Date(value));

export default function AdminDashboard({ adminName, counts, system, classes, activity }: Props) {
  const firstName = adminName.split(" ")[0] || "Admin";
  const initials =
    adminName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";
  const issueCount = system.unlinkedSections + system.unlinkedSubjects;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand" aria-label="ClassPulse Admin Dashboard">
          <span className="admin-brand-mark"><Activity size={22} strokeWidth={2.5} /></span>
          <span>ClassPulse</span>
        </Link>
        <p className="admin-portal-label">ADMIN PORTAL</p>

        <nav className="admin-nav" aria-label="Admin navigation">
          <Link href="/admin" className="admin-nav-link active"><LayoutDashboard size={19} /> Dashboard</Link>
          <Link href="/admin/classes" className="admin-nav-link"><BookOpen size={19} /> Classes</Link>
          <Link href="/admin/students" className="admin-nav-link"><Users size={19} /> Students</Link>
          <Link href="/admin/teachers" className="admin-nav-link"><GraduationCap size={19} /> Teachers</Link>
          <Link href="/admin/subjects" className="admin-nav-link"><BookOpen size={19} /> Subjects</Link>
          <Link href="/admin/assignments" className="admin-nav-link"><Link2 size={19} /> Assignments</Link>
          <Link href="/admin/settings" className="admin-nav-link"><Settings size={19} /> System Settings</Link>
        </nav>

        <div className="admin-user-block">
          <div className="admin-user">
            <span className="admin-avatar">{initials}</span>
            <span>
              <strong>{adminName}</strong>
              <small>Administrator</small>
            </span>
          </div>
          <button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <div className="admin-mobile-brand">
              <span className="admin-brand-mark"><Activity size={18} /></span>
              <strong>ClassPulse</strong>
            </div>
            <h1>Good evening, {firstName}</h1>
            <p>Here&apos;s a quick overview of your institution and system.</p>
          </div>
          <div className="admin-header-actions">
            <label className="admin-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.2 4.2" /></svg>
              <input placeholder="Search for students, teachers, classes..." aria-label="Search" />
            </label>
            <button className="admin-icon-button" aria-label="Notifications">
              <Bell size={20} />
              <span className="notification-dot" />
            </button>
            <button className="admin-menu-button" aria-label="Open menu"><Menu size={20} /></button>
          </div>
        </header>

        <section className="admin-stats" aria-label="Institution overview">
          <Link href="/admin/students" className="admin-stat-card student">
            <span className="admin-stat-icon"><Users size={23} /></span>
            <span><strong>{counts.students}</strong><small>Students</small></span>
            <ArrowRight size={17} />
          </Link>
          <Link href="/admin/teachers" className="admin-stat-card teacher">
            <span className="admin-stat-icon"><GraduationCap size={23} /></span>
            <span><strong>{counts.teachers}</strong><small>Teachers</small></span>
            <ArrowRight size={17} />
          </Link>
          <Link href="/admin/classes" className="admin-stat-card class">
            <span className="admin-stat-icon"><BookOpen size={23} /></span>
            <span><strong>{counts.classes}</strong><small>Classes</small></span>
            <ArrowRight size={17} />
          </Link>
          <Link href="/admin/subjects" className="admin-stat-card subject">
            <span className="admin-stat-icon"><BookOpen size={23} /></span>
            <span><strong>{counts.subjects}</strong><small>Subjects</small></span>
            <ArrowRight size={17} />
          </Link>
        </section>

        <section className="admin-grid-top">
          <div className="admin-panel">
            <div className="admin-panel-heading">
              <div><h2><span className="heading-status-dot" /> System Status</h2></div>
              <Link href="/admin/settings">Manage <ArrowRight size={14} /></Link>
            </div>
            <div className="status-list">
              <div className="status-row">
                <span className="status-label"><span className="status-symbol sheets">G</span> Google Sheets</span>
                <span className="status-value"><i className="status-dot good" /> {system.sheetsLinked > 0 ? "Connected" : "Not configured"}</span>
                <small>Last sync<br />{system.lastSync || "Never"}</small>
                <span className="status-more">⋮</span>
              </div>
              <div className="status-row">
                <span className="status-label"><span className="status-symbol database">●</span> Database</span>
                <span className="status-value"><i className={`status-dot ${system.database ? "good" : "bad"}`} /> {system.database ? "Operational" : "Unavailable"}</span>
                <small>Last checked<br />{system.database ? formatDate(new Date()) : "Unavailable"}</small>
                <span className="status-more">⋮</span>
              </div>
              <div className="status-row">
                <span className="status-label"><span className="status-symbol shield"><ShieldCheck size={15} /></span> Authentication</span>
                <span className="status-value"><i className={`status-dot ${system.database ? "good" : "bad"}`} /> {system.database ? "Operational" : "Unavailable"}</span>
                <small>{counts.students + counts.teachers} accounts</small>
                <span className="status-more">⋮</span>
              </div>
            </div>
          </div>

          <div className="admin-panel quick-panel">
            <div className="admin-panel-heading">
              <div><h2><span className="heading-lightning">ϟ</span> Quick Actions</h2></div>
              <Link href="/admin">View All <ArrowRight size={14} /></Link>
            </div>
            <div className="quick-actions">
              <Link href="/admin/students/new" className="quick-action student-action"><span><UserPlus size={22} /></span><b>Add Student</b></Link>
              <Link href="/admin/teachers/new" className="quick-action teacher-action"><span><UserPlus size={22} /></span><b>Add Teacher</b></Link>
              <Link href="/admin/classes/new" className="quick-action class-action"><span><BookOpen size={22} /></span><b>Create Class</b></Link>
              <Link href="/admin/subjects/new" className="quick-action subject-action"><span><BookOpen size={22} /></span><b>Add Subject</b></Link>
              <Link href="/admin/assignments" className="quick-action assignment-action"><span><Link2 size={22} /></span><b>Manage Assignments</b></Link>
              <Link href="/admin/settings" className="quick-action sync-action"><span><RefreshCw size={22} /></span><b>Sync Now</b></Link>
            </div>
          </div>
        </section>

        <section className="admin-grid-bottom">
          <div className="admin-panel activity-panel">
            <div className="admin-panel-heading">
              <div><h2><Activity size={18} /> Recent Activity</h2></div>
              <Link href="/admin">View All <ArrowRight size={14} /></Link>
            </div>
            <div className="activity-list">
              {activity.length ? activity.map((item, index) => (
                <div className="activity-row" key={`${item.text}-${index}`}>
                  <span className={`activity-dot activity-${index % 4}`}>
                    {index % 4 === 0 ? <Users size={15} /> : index % 4 === 1 ? <GraduationCap size={15} /> : index % 4 === 2 ? <BookOpen size={15} /> : <Link2 size={15} />}
                  </span>
                  <div><strong>{item.text}</strong><small>{item.detail}</small></div>
                  <time>{item.date}</time>
                </div>
              )) : (
                <div className="empty-activity">No recent activity yet.</div>
              )}
            </div>
          </div>

          <div className="admin-panel class-panel">
            <div className="admin-panel-heading">
              <div><h2><BookOpen size={18} /> Recently Modified Classes</h2></div>
              <Link href="/admin/classes">View All <ArrowRight size={14} /></Link>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Class</th><th>Department</th><th>Semester</th><th>Students</th><th>Teachers</th><th>Last Updated</th></tr></thead>
                <tbody>
                  {classes.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.label.split(" — ")[0]}</strong><small>Section {item.section}</small></td>
                      <td>{item.department}</td>
                      <td>{item.semester}</td>
                      <td>{item.students}</td>
                      <td>{item.teachers}</td>
                      <td>{formatUpdated(item.updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className={`admin-footer-status ${issueCount === 0 ? "healthy" : "attention"}`}>
          {issueCount === 0 ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
          <span>{issueCount === 0 ? "All systems are running normally." : `${issueCount} data connection${issueCount === 1 ? "" : "s"} need attention.`}</span>
          <small>Last updated: {formatDate(new Date())}</small>
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

    const [totalSections, latestSync] = await Promise.all([
      prisma.section.count(),
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

    const activity: ActivityRow[] = sections.slice(0, 5).map((section, index) => ({
      text: index === 0 ? "Class structure updated" : index === 1 ? "Class structure available" : index === 2 ? "Subject mapping available" : "Section data available",
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
          unlinkedSubjects: Math.max(subjects - linkedSubjects, 0),
        },
        classes: classRows,
        activity,
      },
    };
  } catch {
    return { redirect: { destination: "/login", permanent: false } };
  }
};
