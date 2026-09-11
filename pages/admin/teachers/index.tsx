import type { FormEvent } from "react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Bell, BookOpen, GraduationCap, LayoutDashboard, Link2, LogOut, Plus, Search, Settings, Users, X } from "lucide-react";
import { authOptions } from "../../../lib/authOptions";
import { prisma } from "../../../lib/prisma";

type Subject = { id: string; name: string; code: string; className: string; sectionName: string; teacherId: string | null };
type ClassOption = { id: string; program: string; academicYear: string; year: string; semester: number; proctorId: string | null };
type Teacher = { id: string; name: string; email: string; subjects: Subject[]; classes: ClassOption[]; proctorClasses: ClassOption[]; createdAt: string };
type Props = { teachers: Teacher[]; allSubjects: Subject[]; allClasses: ClassOption[] };

const nav = [["/admin", "Dashboard", LayoutDashboard], ["/admin/classes", "Classes", BookOpen], ["/admin/students", "Students", Users], ["/admin/teachers", "Teachers", GraduationCap], ["/admin/subjects", "Subjects", BookOpen], ["/admin/assignments", "Assignments", Link2], ["/admin/settings", "System Settings", Settings]] as const;

export default function TeachersPage({ teachers, allSubjects, allClasses }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openAdd = () => {
    setError("");
    setSelected(null);
    setForm({ name: "", email: "", password: "" });
    setModal("add");
  };

  const openEdit = (teacher: Teacher) => {
    setError("");
    setSelected(teacher);
    setForm({ name: teacher.name, email: teacher.email, password: "" });
    setModal("edit");
  };

  useEffect(() => {
    if (router.query.add === "1") {
      openAdd();
      router.replace("/admin/teachers", undefined, { shallow: true });
    }
  }, [router]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return teachers.filter((teacher) => {
      if (!query) return true;
      const haystack = [teacher.name, teacher.email, ...teacher.subjects.map((s) => s.name), ...teacher.classes.map((c) => c.program)].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [teachers, q]);

  async function profile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/teachers", {
        method: modal === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: selected?.id, action: "profile" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save teacher");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teacher");
      setBusy(false);
    }
  }

  async function change(action: "subject" | "class" | "proctor", mode: "add" | "remove", id: string) {
    if (!selected || !id) return;
    setActionId(`${action}:${mode}:${id}`);
    setError("");
    try {
      const payload: Record<string, string> = { id: selected.id, action, mode };
      if (action === "subject") payload.subjectId = id;
      else payload.classId = id;
      const response = await fetch("/api/admin/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update teacher");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update teacher");
      setActionId("");
    }
  }

  return (
    <div className="admin-section-page">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand"><span className="admin-brand-mark"><Activity size={22} /></span><span>ClassPulse</span></Link>
        <p className="admin-portal-label">ADMIN PORTAL</p>
        <nav className="admin-nav">{nav.map(([href, label, Icon]) => <Link key={label} href={href} className={`admin-nav-link ${label === "Teachers" ? "active" : ""}`}><Icon size={19} />{label}</Link>)}</nav>
        <div className="admin-user-block"><div className="admin-user"><span className="admin-avatar">A</span><span><strong>Admin</strong><small>Administrator</small></span></div><button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={17} /> Sign out</button></div>
      </aside>

      <main className="admin-main">
        <header className="admin-header"><div><h1>Teachers</h1><p>Manage teachers, their class analysis access, subjects, and proctor responsibilities.</p></div><div className="admin-header-actions"><label className="admin-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers, subjects..." /></label><button className="admin-icon-button" aria-label="Notifications"><Bell size={20} /></button><button className="section-primary" onClick={openAdd}><Plus size={16} /> Add Teacher</button></div></header>

        <section className="section-summary">
          <div className="summary-card teacher-tone"><span className="summary-icon"><GraduationCap size={21} /></span><div><strong>{teachers.length}</strong><small>Total Teachers</small></div></div>
          <div className="summary-card green-tone"><span className="summary-icon"><Users size={21} /></span><div><strong>{teachers.filter((t) => t.classes.length > 0).length}</strong><small>Teachers With Class Analysis</small></div></div>
          <div className="summary-card gold-tone"><span className="summary-icon"><Link2 size={21} /></span><div><strong>{teachers.reduce((n, t) => n + t.subjects.length, 0)}</strong><small>Active Assignments</small></div></div>
        </section>

        <section className="section-panel"><div className="section-panel-head"><div><h2>All Teachers <span>{filtered.length}</span></h2><p>Teacher records are stored in the institution database.</p></div><label className="section-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" /></label></div>
          <div className="section-table-wrap"><table className="section-table"><thead><tr><th>Teacher</th><th>Subjects</th><th>Class Analysis</th><th>Proctor</th><th>Joined</th><th /></tr></thead>
            <tbody>{filtered.map((teacher) => <tr key={teacher.id}><td><div className="person-cell"><span className="person-avatar">{teacher.name.charAt(0).toUpperCase()}</span><div><strong>{teacher.name}</strong><small>{teacher.email}</small></div></div></td><td>{teacher.subjects.length ? <div className="tag-list">{teacher.subjects.slice(0, 2).map((subject) => <span key={subject.id}>{subject.name}</span>)}{teacher.subjects.length > 2 && <em>+{teacher.subjects.length - 2}</em>}</div> : <span className="muted">No assignment</span>}</td><td>{teacher.classes.length ? <div className="tag-list">{teacher.classes.map((item) => <span className="status-chip green" key={item.id}><i />{item.program}</span>)}</div> : <span className="muted">Not assigned</span>}</td><td>{teacher.proctorClasses.length ? <span className="status-chip green"><i />{teacher.proctorClasses.length} class{teacher.proctorClasses.length > 1 ? "es" : ""}</span> : <span className="muted">Not assigned</span>}</td><td>{new Date(teacher.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td><button className="row-action" onClick={() => openEdit(teacher)}>Edit <ArrowRight size={14} /></button></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="section-empty">No teachers match your search.</td></tr>}</tbody>
          </table></div>
        </section>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => !busy && setModal(null)}><div className="admin-modal teacher-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div><span>TEACHER MANAGEMENT</span><h2>{modal === "edit" ? `Edit ${selected?.name || "Teacher"}` : "Add Teacher"}</h2></div><button onClick={() => setModal(null)} disabled={busy}><X size={19} /></button></div>
        <form onSubmit={profile}><div className="manage-block"><div className="manage-block-head"><h3>Profile &amp; Login</h3><span>{modal === "edit" ? "Leave password blank to keep it unchanged." : "Password is required for the teacher login."}</span></div><div className="form-grid"><label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div><label>Password<input required={modal === "add"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={modal === "edit" ? "Leave blank to keep current password" : "Minimum 6 characters"} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="section-primary" disabled={busy}>{busy ? "Saving..." : modal === "edit" ? "Save Profile" : "Add Teacher"}</button></div></div></form>
        {modal === "edit" && selected && <div className="management-grid">
          <div className="manage-block"><div className="manage-block-head"><h3>Assign Subjects</h3><span>One teacher can own a subject assignment.</span></div><div className="manage-control"><select value="" onChange={(e) => e.target.value && change("subject", "add", e.target.value)}><option value="">Select subject to assign</option>{allSubjects.map((subject) => <option key={subject.id} value={subject.id} disabled={!!subject.teacherId && subject.teacherId !== selected.id}>{subject.name} · {subject.className}{subject.teacherId && subject.teacherId !== selected.id ? " — assigned" : ""}</option>)}</select></div><div className="manage-list">{selected.subjects.length ? selected.subjects.map((subject) => <div className="manage-row" key={subject.id}><span><strong>{subject.name}</strong><small>{subject.className}</small></span><button type="button" onClick={() => change("subject", "remove", subject.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No subjects assigned.</span>}</div></div>
          <div className="manage-block"><div className="manage-block-head"><h3>Assign Class Analysis</h3><span>Only one class can be assigned to a teacher for Class Analysis.</span></div><div className="manage-control"><select value="" onChange={(e) => e.target.value && change("class", "add", e.target.value)}><option value="">Select class to assign</option>{allClasses.map((item) => <option key={item.id} value={item.id} disabled={selected.classes.some((existing) => existing.id === item.id)}>{item.program} · {item.academicYear}</option>)}</select></div><div className="manage-list">{selected.classes.length ? selected.classes.map((item) => <div className="manage-row" key={item.id}><span><strong>{item.program}</strong><small>{item.academicYear} · Sem {item.semester}</small></span><button type="button" onClick={() => change("class", "remove", item.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No class assigned.</span>}</div></div>
          <div className="manage-block"><div className="manage-block-head"><h3>Proctor</h3><span>Each class can have one proctor.</span></div><div className="manage-control"><select value="" onChange={(e) => e.target.value && change("proctor", "add", e.target.value)}><option value="">Assign as proctor for class</option>{allClasses.map((item) => <option key={item.id} value={item.id} disabled={!!item.proctorId && item.proctorId !== selected.id}>{item.program} · {item.academicYear}{item.proctorId === selected.id ? " — current proctor" : item.proctorId ? " — another proctor" : ""}</option>)}</select></div><div className="manage-list">{selected.proctorClasses.length ? selected.proctorClasses.map((item) => <div className="manage-row" key={item.id}><span><strong>{item.program}</strong><small>{item.academicYear} · Sem {item.semester}</small></span><button type="button" onClick={() => change("proctor", "remove", item.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No proctor role assigned.</span>}</div></div>
        </div>}
      </div></div>}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  if ((session.user as any).role !== "ADMIN") return { redirect: { destination: "/dashboard", permanent: false } };

  const [rows, subjects, classes] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TEACHER" },
      orderBy: { name: "asc" },
      include: {
        assignments: { include: { subject: { include: { section: { include: { class: true } } } } } },
        classAccess: { include: { class: true } },
        proctorOf: { select: { id: true, program: true, academicYear: true, year: true, semester: true, proctorId: true } },
      },
    }),
    prisma.subject.findMany({
      orderBy: [{ section: { class: { program: "asc" } } }, { name: "asc" }],
      include: { assignments: { select: { teacherId: true } }, section: { include: { class: true } } },
    }),
    prisma.class.findMany({ orderBy: { program: "asc" }, select: { id: true, program: true, academicYear: true, year: true, semester: true, proctorId: true } }),
  ]);

  const allSubjects: Subject[] = subjects.map((subject) => ({ id: subject.id, name: subject.name, code: subject.code, className: subject.section.class.program, sectionName: subject.section.name, teacherId: subject.assignments[0]?.teacherId || null }));
  const allClasses: ClassOption[] = classes;
  const teachers: Teacher[] = rows.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    subjects: teacher.assignments.map((assignment) => ({ id: assignment.subject.id, name: assignment.subject.name, code: assignment.subject.code, className: assignment.subject.section.class.program, sectionName: assignment.subject.section.name, teacherId: teacher.id })),
    classes: teacher.classAccess.map((access) => ({ id: access.class.id, program: access.class.program, academicYear: access.class.academicYear, year: access.class.year, semester: access.class.semester, proctorId: access.class.proctorId })),
    proctorClasses: teacher.proctorOf.map((item) => ({ id: item.id, program: item.program, academicYear: item.academicYear, year: item.year, semester: item.semester, proctorId: item.proctorId })),
    createdAt: teacher.createdAt.toISOString(),
  }));

  return { props: { teachers, allSubjects, allClasses } };
};
