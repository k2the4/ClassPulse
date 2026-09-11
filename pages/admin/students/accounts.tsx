import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, GraduationCap, LayoutDashboard, Link2, LogOut, Plus, Settings, Users, X } from "lucide-react";
import { authOptions } from "../../../lib/authOptions";

type Student = { enrollmentNo: string; name: string; email: string; sectionId: string; sectionLabel: string; account: { id: string; name: string; email: string; enrollmentNo: string } | null };

export default function StudentAccountsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<Student | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await fetch("/api/admin/student-accounts"); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load accounts"); setStudents(d.students); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load accounts"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = students.filter(s => `${s.name} ${s.enrollmentNo} ${s.email} ${s.sectionLabel}`.toLowerCase().includes(q.toLowerCase().trim()));
  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault(); if (!modal) return; setSaving(true); setError("");
    try { const r = await fetch("/api/admin/student-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentNo: modal.enrollmentNo, password }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to create account"); setModal(null); setPassword(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create account"); }
    finally { setSaving(false); }
  };

  const nav = [["/admin","Dashboard",LayoutDashboard],["/admin/classes","Classes",BookOpen],["/admin/students","Students",Users],["/admin/teachers","Teachers",GraduationCap],["/admin/subjects","Subjects",BookOpen],["/admin/assignments","Assignments",Link2],["/admin/settings","System Settings",Settings]] as const;
  return <div className="admin-section-page"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand"><span className="admin-brand-mark"><Activity size={22}/></span><span>ClassPulse</span></Link><p className="admin-portal-label">ADMIN PORTAL</p><nav className="admin-nav">{nav.map(([href,label,Icon])=><Link key={label} href={href} className={`admin-nav-link ${label === "Students" ? "active" : ""}`}><Icon size={19}/>{label}</Link>)}</nav><div className="admin-user-block"><div className="admin-user"><span className="admin-avatar">A</span><span><strong>Admin</strong><small>Administrator</small></span></div><button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={17}/> Sign out</button></div></aside><main className="admin-main"><header className="admin-header"><div><h1>Student Accounts</h1><p>Create login credentials for students already present in the Google Sheets rosters.</p></div><div className="admin-header-actions"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search students..." className="section-search-input"/></div></header><section className="section-panel"><div className="section-panel-head"><div><h2>Student Logins <span>{filtered.length}</span></h2><p>One login per enrollment number. Student data remains sourced from Google Sheets.</p></div><Link href="/admin/students" className="section-primary">Back to Students</Link></div><div className="section-table-wrap"><table className="section-table"><thead><tr><th>Student</th><th>Enrollment</th><th>Class / Section</th><th>Email</th><th>Account</th><th></th></tr></thead><tbody>{filtered.map(s => <tr key={`${s.sectionId}:${s.enrollmentNo}`}><td><div className="person-cell"><span className="person-avatar student-avatar">{s.name.charAt(0).toUpperCase()}</span><div><strong>{s.name}</strong></div></div></td><td><span className="mono-value">{s.enrollmentNo}</span></td><td>{s.sectionLabel}</td><td>{s.email}</td><td>{s.account ? <span className="status-chip green"><i/> Active</span> : <span className="status-chip"><i/> Not created</span>}</td><td>{!s.account && <button className="section-primary" onClick={() => { setModal(s); setPassword(""); setError(""); }}><Plus size={15}/> Create Login</button>}</td></tr>)}{!filtered.length && <tr><td colSpan={6} className="section-empty">No students match your search.</td></tr>}</tbody></table></div></section></main>{modal && <div className="modal-backdrop" onMouseDown={() => !saving && setModal(null)}><div className="admin-modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span>STUDENT LOGIN</span><h2>Create Account</h2></div><button onClick={() => setModal(null)} disabled={saving}><X size={19}/></button></div><form onSubmit={createAccount}><div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="font-semibold">{modal.name}</p><p className="mt-1 text-sm text-gray-500">{modal.enrollmentNo} · {modal.sectionLabel}</p><p className="mt-1 text-sm text-gray-500">{modal.email}</p></div><label className="mt-4 block">Password<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"/></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="section-primary" disabled={saving}>{saving ? "Creating..." : "Create Account"}</button></div></form></div></div>}</div>;
}

export const getServerSideProps: GetServerSideProps = async ctx => { const session = await getServerSession(ctx.req, ctx.res, authOptions); if (!session?.user) return { redirect: { destination: "/login", permanent: false } }; if ((session.user as any).role !== "ADMIN") return { redirect: { destination: "/dashboard", permanent: false } }; return { props: {} }; };
