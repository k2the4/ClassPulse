import type { FormEvent } from "react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";

type Assignment = {
  id: string;
  subjectId: string;
  subject: string;
  code: string;
  type: string;
  teacherId: string;
  teacher: string;
  className: string;
  section: string;
  createdAt: string;
};

type SubjectOption = { id: string; label: string };
type TeacherOption = { id: string; name: string };

type Props = {
  assignments: Assignment[];
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  totalSubjects: number;
};

const nav = [
  ["/admin", "Dashboard", LayoutDashboard],
  ["/admin/classes", "Classes", BookOpen],
  ["/admin/students", "Students", Users],
  ["/admin/teachers", "Teachers", GraduationCap],
  ["/admin/subjects", "Subjects", BookOpen],
  ["/admin/assignments", "Assignments", Link2],
  ["/admin/settings", "System Settings", Settings],
] as const;

export default function AssignmentsPage({
  assignments,
  subjects,
  teachers,
  totalSubjects,
}: Props) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    subjectId: subjects[0]?.id || "",
    teacherId: teachers[0]?.id || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = assignments.filter((assignment) =>
    `${assignment.subject} ${assignment.code} ${assignment.teacher} ${assignment.className} ${assignment.section}`
      .toLowerCase()
      .includes(q.toLowerCase().trim()),
  );

  const open = () => {
    setError("");
    setForm({
      subjectId: subjects[0]?.id || "",
      teacherId: teachers[0]?.id || "",
    });
    setModal(true);
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create assignment");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create assignment");
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this assignment?")) return;

    const response = await fetch(`/api/admin/assignments?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Unable to remove assignment");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="admin-section-page">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-mark"><Activity size={22} /></span>
          <span>ClassPulse</span>
        </Link>
        <p className="admin-portal-label">ADMIN PORTAL</p>
        <nav className="admin-nav">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={label}
              href={href}
              className={`admin-nav-link ${label === "Assignments" ? "active" : ""}`}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-user-block">
          <div className="admin-user">
            <span className="admin-avatar">A</span>
            <span><strong>Admin</strong><small>Administrator</small></span>
          </div>
          <button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Assignments</h1>
            <p>Manage teacher-to-subject assignments.</p>
          </div>
          <div className="admin-header-actions">
            <label className="admin-search">
              <Search size={17} />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search assignments..."
              />
            </label>
            <button className="admin-icon-button" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <button
              className="section-primary"
              onClick={open}
              disabled={!subjects.length || !teachers.length}
            >
              <Plus size={16} /> Assign Subject
            </button>
          </div>
        </header>

        <section className="section-summary">
          <div className="summary-card blue-tone">
            <span className="summary-icon"><Link2 size={21} /></span>
            <div><strong>{assignments.length}</strong><small>Total Assignments</small></div>
          </div>
          <div className="summary-card teacher-tone">
            <span className="summary-icon"><BookOpen size={21} /></span>
            <div><strong>{assignments.length}</strong><small>Assigned Subjects</small></div>
          </div>
          <div className="summary-card gold-tone">
            <span className="summary-icon"><BookOpen size={21} /></span>
            <div><strong>{Math.max(totalSubjects - assignments.length, 0)}</strong><small>Unassigned Subjects</small></div>
          </div>
          <div className="summary-card green-tone">
            <span className="summary-icon"><GraduationCap size={21} /></span>
            <div><strong>{new Set(assignments.map((assignment) => assignment.teacherId)).size}</strong><small>Teachers With Assignments</small></div>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-head">
            <div>
              <h2>All Assignments <span>{filtered.length}</span></h2>
              <p>Each subject can have one teacher assignment.</p>
            </div>
            <label className="section-search">
              <Search size={16} />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search by subject or teacher"
              />
            </label>
          </div>

          <div className="section-table-wrap">
            <table className="section-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Teacher</th>
                  <th>Assigned</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar"><BookOpen size={15} /></span>
                        <div>
                          <strong>{assignment.subject}</strong>
                          <small>{assignment.code} · {assignment.type}</small>
                        </div>
                      </div>
                    </td>
                    <td>{assignment.className}</td>
                    <td>{assignment.section}</td>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar"><GraduationCap size={14} /></span>
                        <div><strong>{assignment.teacher}</strong></div>
                      </div>
                    </td>
                    <td>
                      {new Date(assignment.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <button className="row-action" onClick={() => remove(assignment.id)}>
                        Remove <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="section-empty">No assignments match your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={() => !busy && setModal(false)}>
          <div className="admin-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span>ASSIGNMENT MANAGEMENT</span>
                <h2>Assign Subject</h2>
              </div>
              <button onClick={() => setModal(false)} disabled={busy} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={save}>
              <label>
                Subject
                <select
                  required
                  value={form.subjectId}
                  onChange={(event) => setForm({ ...form, subjectId: event.target.value })}
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Teacher
                <select
                  required
                  value={form.teacherId}
                  onChange={(event) => setForm({ ...form, teacherId: event.target.value })}
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </label>

              {error && <p className="form-error">{error}</p>}

              <div className="modal-actions">
                <button type="button" onClick={() => setModal(false)}>Cancel</button>
                <button className="section-primary" disabled={busy}>
                  {busy ? "Assigning..." : "Assign Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  if ((session.user as any).role !== "ADMIN") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const [rows, subjectRows, teacherRows] = await Promise.all([
    prisma.assignment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subject: {
          include: {
            section: {
              include: { class: true },
            },
          },
        },
        teacher: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        section: {
          include: { class: true },
        },
        assignments: {
          select: { id: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const assignments: Assignment[] = rows.map((assignment) => ({
    id: assignment.id,
    subjectId: assignment.subject.id,
    subject: assignment.subject.name,
    code: assignment.subject.code,
    type: assignment.subject.type,
    teacherId: assignment.teacher.id,
    teacher: assignment.teacher.name,
    className: assignment.subject.section.class.program,
    section: assignment.subject.section.name,
    createdAt: assignment.createdAt.toISOString(),
  }));

  const subjects: SubjectOption[] = subjectRows
    .filter((subject) => !subject.assignments.length)
    .map((subject) => ({
      id: subject.id,
      label: `${subject.name} · ${subject.code} · ${subject.section.class.program} · ${subject.section.name}`,
    }));

  const teachers: TeacherOption[] = teacherRows.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
  }));

  return {
    props: {
      assignments,
      subjects,
      teachers,
      totalSubjects: subjectRows.length,
    },
  };
};
