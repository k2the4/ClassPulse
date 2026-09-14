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
type Props = { teachers: Teacher[]; allSubjects: Subject[]; allClasses: ClassOption[]; departmentCount: number; assignmentCount: number };

const nav = [["/admin", "Dashboard", LayoutDashboard], ["/admin/classes", "Classes", BookOpen], ["/admin/students", "Students", Users], ["/admin/teachers", "Teachers", GraduationCap], ["/admin/subjects", "Subjects", BookOpen], ["/admin/assignments", "Assignments", Link2], ["/admin/settings", "System Settings", Settings]] as const;

export default function TeachersPage({ teachers, allSubjects, allClasses, departmentCount, assignmentCount }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openAdd = () => { setError(""); setSelected(null); setForm({ name: "", email: "", password: "" }); setModal("add"); };
  const openEdit = (t: Teacher) => { setError(""); setSelected(t); setForm({ name: t.name, email: t.email, password: "" }); setModal("edit"); };

  useEffect(() => {
    if (router.query.add === "1") {
      openAdd();
      router.replace("/admin/teachers", undefined, { shallow: true });
    }
  }, [router]);

  const filtered = useMemo(() => {
    const x = q.toLowerCase().trim();
    return teachers.filter(t => !x || `${t.name} ${t.email} ${t.subjects.map(s => s.name).join(" ")} ${t.classes.map(c => c.program).join(" ")}`.toLowerCase().includes(x));
  }, [teachers, q]);

  async function profile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/teachers", { method: modal === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: selected?.id, action: "profile" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to save teacher");
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save teacher"); setBusy(false); }
  }

  async function change(action: "subject" | "class" | "proctor", mode: "add" | "remove", id: string) {
    if (!selected || !id) return;
    setActionId(`${action}:${mode}:${id}`); setError("");
    try {
      const payload: Record<string, string> = { id: selected.id, action, mode };
      if (action === "subject") payload.subjectId = id; else payload.classId = id;
      const r = await fetch("/api/admin/teachers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to update teacher");
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update teacher"); setActionId(""); }
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
        <header className="admin-header">
          <div><h1>Teachers</h1><p>Manage teachers, their class analysis access, subjects, and proctor responsibilities.</p></div>
          <div className="admin-header-actions"><label className="admin-search"><Search size={17} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search teachers, subjects..." /></label><button className="admin-icon-button" aria-label="Notifications"><Bell size={20} /></button><button className="section-primary" onClick={openAdd}><Plus size={16} /> Add Teacher</button></div>
        </header>

        <section className="section-summary">
          <div className="summary-card teacher-tone"><span className="summary-icon"><GraduationCap size={21} /></span><div><strong>{teachers.length}</strong><small>Total Teachers</small></div></div>
          <div className="summary-card blue-tone"><span className="summary-icon"><BookOpen size={21} /></span><div><strong>{allSubjects.length}</strong><small>Total Subjects</small></div></div>
          <div className="summary-card blue-tone"><span className="summary-icon"><Link2 size={21} /></span><div><strong>{assignmentCount}</strong><small>Total Assigned Subjects</small></div></div>
          <div className="summary-card green-tone"><span className="summary-icon"><Users size={21} /></span><div><strong>{departmentCount}</strong><small>Departments</small></div></div>
        </section>

        <section className="section-panel">
          <div className="section-panel-head"><div><h2>All Teachers <span>{filtered.length}</span></h2><p>Teacher records are stored in the institution database.</p></div><label className="section-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email" /></label></div>
          <div className="section-table-wrap"><table className="section-table"><thead><tr><th>Teacher</th><th>Subjects</th><th>Class Analysis</th><th>Proctor</th><th>Joined</th><th /></tr></thead><tbody>
            {filtered.map(t => <tr key={t.id}><td><div className="person-cell"><span className="person-avatar">{t.name.charAt(0).toUpperCase()}</span><div><strong>{t.name}</strong><small>{t.email}</small></div></div></td><td>{t.subjects.length ? <div className="tag-list">{t.subjects.slice(0, 2).map(s => <span key={s.id}>{s.name}</span>)}{t.subjects.length > 2 && <em>+{t.subjects.length - 2}</em>}</div> : <span className="muted">No assignment</span>}</td><td>{t.classes.length ? <div className="tag-list">{t.classes.map(c => <span className="status-chip green" key={c.id}><i />{c.program}</span>)}</div> : <span className="muted">Not assigned</span>}</td><td>{t.proctorClasses.length ? <span className="status-chip green"><i />{t.proctorClasses.length} class{t.proctorClasses.length > 1 ? "es" : ""}</span> : <span className="muted">Not assigned</span>}</td><td>{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td><button className="row-action" onClick={() => openEdit(t)}>Edit <ArrowRight size={14} /></button></td></tr>)}
            {!filtered.length && <tr><td colSpan={6} className="section-empty">No teachers match your search.</td></tr>}
          </tbody></table></div>
        </section>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => !busy && setModal(null)}><div className="admin-modal teacher-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head"><div><span>TEACHER MANAGEMENT</span><h2>{modal === "edit" ? `Edit ${selected?.name || "Teacher"}` : "Add Teacher"}</h2></div><button onClick={() => setModal(null)} disabled={busy}><X size={19} /></button></div>
        <form onSubmit={profile}><div className="manage-block"><div className="manage-block-head"><h3>Profile &amp; Login</h3><span>{modal === "edit" ? "Leave password blank to keep it unchanged." : "Password is required for the teacher login."}</span></div><div className="form-grid"><label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Email address<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></div><label>Password<input required={modal === "add"} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={modal === "edit" ? "Leave blank to keep current password" : "Minimum 6 characters"} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="section-primary" disabled={busy}>{busy ? "Saving..." : modal === "edit" ? "Save Profile" : "Add Teacher"}</button></div></div></form>
        {modal === "edit" && selected && <div className="management-grid">
          <div className="manage-block"><div className="manage-block-head"><h3>Assign Subjects</h3><span>One teacher can own a subject assignment.</span></div><div className="manage-control"><select value="" onChange={e => e.target.value && change("subject", "add", e.target.value)}><option value="">Select subject to assign</option>{allSubjects.map(s => <option key={s.id} value={s.id} disabled={!!s.teacherId && s.teacherId !== selected.id}>{s.name} · {s.className}{s.teacherId && s.teacherId !== selected.id ? " — assigned" : ""}</option>)}</select></div><div className="manage-list">{selected.subjects.length ? selected.subjects.map(s => <div className="manage-row" key={s.id}><span><strong>{s.name}</strong><small>{s.className}</small></span><button type="button" onClick={() => change("subject", "remove", s.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No subjects assigned.</span>}</div></div>
          <div className="manage-block"><div className="manage-block-head"><h3>Assign Class Analysis</h3><span>Only one class can be assigned to a teacher for Class Analysis.</span></div><div className="manage-control"><select value="" onChange={e => e.target.value && change("class", "add", e.target.value)}><option value="">Select class to assign</option>{allClasses.map(c => <option key={c.id} value={c.id} disabled={selected.classes.some(x => x.id === c.id)}>{c.program} · {c.academicYear}</option>)}</select></div><div className="manage-list">{selected.classes.length ? selected.classes.map(c => <div className="manage-row" key={c.id}><span><strong>{c.program}</strong><small>{c.academicYear} · Sem {c.semester}</small></span><button type="button" onClick={() => change("class", "remove", c.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No class assigned.</span>}</div></div>
          <div className="manage-block"><div className="manage-block-head"><h3>Proctor</h3><span>Each class can have one proctor.</span></div><div className="manage-control"><select value="" onChange={e => e.target.value && change("proctor", "add", e.target.value)}><option value="">Assign as proctor for class</option>{allClasses.map(c => <option key={c.id} value={c.id} disabled={!!c.proctorId && c.proctorId !== selected.id}>{c.program} · {c.academicYear}{c.proctorId === selected.id ? " — current proctor" : c.proctorId ? " — another proctor" : ""}</option>)}</select></div><div className="manage-list">{selected.proctorClasses.length ? selected.proctorClasses.map(c => <div className="manage-row" key={c.id}><span><strong>{c.program}</strong><small>{c.academicYear} · Sem {c.semester}</small></span><button type="button" onClick={() => change("proctor", "remove", c.id)} disabled={!!actionId}>Remove</button></div>) : <span className="muted">No proctor role assigned.</span>}</div></div>
        </div>}
      </div></div>}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  if ((session.user as any).role !== "ADMIN") return { redirect: { destination: "/dashboard", permanent: false } };

  const [rows, subjects, classes, departmentCount] = await Promise.all([
    prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { name: "asc" }, include: { assignments: { include: { subject: { include: { section: { include: { class: true } } } } } }, classAccess: { include: { class: true } }, proctorOf: { select: { id: true, program: true, academicYear: true, year: true, semester: true, proctorId: true } } } }),
    prisma.subject.findMany({ orderBy: [{ section: { class: { program: "asc" } } }, { name: "asc" }], include: { assignments: { select: { teacherId: true } }, section: { include: { class: true } } } }),
    prisma.class.findMany({ orderBy: { program: "asc" }, select: { id: true, program: true, academicYear: true, year: true, semester: true, proctorId: true } }),
    prisma.department.count(),
  ]);

  const allSubjects: Subject[] = subjects.map(s => ({ id: s.id, name: s.name, code: s.code, className: s.section.class.program, sectionName: s.section.name, teacherId: s.assignments[0]?.teacherId || null }));
  const allClasses: ClassOption[] = classes;
  const assignmentCount = rows.reduce((total, teacher) => total + teacher.assignments.length, 0);
  const teachers: Teacher[] = rows.map(t => ({ id: t.id, name: t.name, email: t.email, subjects: t.assignments.map(a => ({ id: a.subject.id, name: a.subject.name, code: a.subject.code, className: a.subject.section.class.program, sectionName: a.subject.section.name, teacherId: t.id })), classes: t.classAccess.map(a => ({ id: a.class.id, program: a.class.program, academicYear: a.class.academicYear, year: a.class.year, semester: a.class.semester, proctorId: a.class.proctorId })), proctorClasses: t.proctorOf.map(c => ({ id: c.id, program: c.program, academicYear: c.academicYear, year: c.year, semester: c.semester, proctorId: c.proctorId })), createdAt: t.createdAt.toISOString() }));

  return { props: { teachers, allSubjects, allClasses, departmentCount, assignmentCount } };
};