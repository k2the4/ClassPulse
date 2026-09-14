import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Activity, Bell, BookOpen, GraduationCap, LayoutDashboard, Link2, LogOut, RefreshCw, Save, Settings, Users } from "lucide-react";
import { authOptions } from "../../../lib/authOptions";

type Settings = {
  institutionName: string;
  academicYear: string;
  attendanceThreshold: number;
  atRiskThreshold: number;
  autoSyncSheets: boolean;
  syncIntervalHours: number;
  emailNotifications: boolean;
  maintenanceMode: boolean;
};

const defaults: Settings = {
  institutionName: "ClassPulse",
  academicYear: "2026-27",
  attendanceThreshold: 75,
  atRiskThreshold: 65,
  autoSyncSheets: true,
  syncIntervalHours: 6,
  emailNotifications: true,
  maintenanceMode: false,
};

const nav = [["/admin", "Dashboard", LayoutDashboard], ["/admin/classes", "Classes", BookOpen], ["/admin/students", "Students", Users], ["/admin/teachers", "Teachers", GraduationCap], ["/admin/subjects", "Subjects", BookOpen], ["/admin/assignments", "Assignments", Link2], ["/admin/settings", "System Settings", Settings]] as const;

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [section, setSection] = useState("general");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load settings."); setSettings(data); })
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load settings."))
      .finally(() => setBusy(false));
  }, []);

  const update = (key: keyof Settings, value: string | number | boolean) => setSettings(prev => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to save settings.");
      setSettings(data); setMessage("Settings saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save settings."); }
    finally { setSaving(false); }
  }

  async function reset() {
    setSaving(true); setMessage(""); setError("");
    try {
      const r = await fetch("/api/admin/settings", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to reset settings.");
      setSettings(data); setMessage("Default settings restored.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to reset settings."); }
    finally { setSaving(false); }
  }

  return (
    <div className="admin-section-page">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand"><span className="admin-brand-mark"><Activity size={22} /></span><span>ClassPulse</span></Link>
        <p className="admin-portal-label">ADMIN PORTAL</p>
        <nav className="admin-nav">{nav.map(([href, label, Icon]) => <Link key={label} href={href} className={`admin-nav-link ${label === "System Settings" ? "active" : ""}`}><Icon size={19} />{label}</Link>)}</nav>
        <div className="admin-user-block"><div className="admin-user"><span className="admin-avatar">A</span><span><strong>Admin</strong><small>Administrator</small></span></div><button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={17} /> Sign out</button></div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div><h1>System Settings</h1><p>Configure institution-wide ClassPulse behaviour and integrations.</p></div>
          <div className="admin-header-actions"><button className="admin-icon-button" aria-label="Notifications"><Bell size={20} /></button><button className="section-primary" onClick={save} disabled={saving || busy}><Save size={16} /> {saving ? "Saving..." : "Save Changes"}</button></div>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav">
            <button className={section === "general" ? "active" : ""} onClick={() => setSection("general")}>General</button>
            <button className={section === "analysis" ? "active" : ""} onClick={() => setSection("analysis")}>Attendance & Analysis</button>
            <button className={section === "integration" ? "active" : ""} onClick={() => setSection("integration")}>Integrations</button>
            <button className={section === "notifications" ? "active" : ""} onClick={() => setSection("notifications")}>Notifications</button>
            <button className={section === "security" ? "active" : ""} onClick={() => setSection("security")}>Security</button>
          </nav>

          <div className="settings-content">
            {busy ? <div className="settings-card"><p>Loading settings...</p></div> : null}
            {!busy && section === "general" ? <div className="settings-card"><h2>General</h2><p>Basic information displayed across the administration system.</p><div className="settings-fields"><div className="settings-field"><label>Institution name</label><input value={settings.institutionName} onChange={e => update("institutionName", e.target.value)} /><span className="settings-help">Used as the system identity.</span></div><div className="settings-field"><label>Academic year</label><input value={settings.academicYear} onChange={e => update("academicYear", e.target.value)} /><span className="settings-help">Current academic year used by administrators.</span></div></div></div> : null}

            {!busy && section === "analysis" ? <div className="settings-card"><h2>Attendance & Analysis</h2><p>Thresholds used when interpreting attendance and identifying students who need attention.</p><div className="settings-fields"><div className="settings-field"><label>Attendance threshold (%)</label><input type="number" min="0" max="100" value={settings.attendanceThreshold} onChange={e => update("attendanceThreshold", Number(e.target.value))} /><span className="settings-help">Students below this percentage are below the required attendance level.</span></div><div className="settings-field"><label>At-risk threshold (%)</label><input type="number" min="0" max="100" value={settings.atRiskThreshold} onChange={e => update("atRiskThreshold", Number(e.target.value))} /><span className="settings-help">Students at or below this percentage are considered at risk.</span></div></div></div> : null}

            {!busy && section === "integration" ? <div className="settings-card"><h2>Google Sheets</h2><p>Control automatic synchronization with linked class and subject sheets.</p><div className="settings-toggle"><div><strong>Automatic synchronization</strong><span>Keep linked Sheets data synchronized automatically.</span></div><label className="settings-switch"><input type="checkbox" checked={settings.autoSyncSheets} onChange={e => update("autoSyncSheets", e.target.checked)} /><span className="settings-slider" /></label></div><div className="settings-fields" style={{ marginTop: 18 }}><div className="settings-field"><label>Sync interval (hours)</label><input type="number" min="1" max="24" value={settings.syncIntervalHours} onChange={e => update("syncIntervalHours", Number(e.target.value))} /><span className="settings-help">Allowed range: 1–24 hours.</span></div></div></div> : null}

            {!busy && section === "notifications" ? <div className="settings-card"><h2>Notifications</h2><p>Control system-generated email notifications.</p><div className="settings-toggle"><div><strong>Email notifications</strong><span>Allow ClassPulse to send configured administrative notifications.</span></div><label className="settings-switch"><input type="checkbox" checked={settings.emailNotifications} onChange={e => update("emailNotifications", e.target.checked)} /><span className="settings-slider" /></label></div></div> : null}

            {!busy && section === "security" ? <div className="settings-card settings-danger"><h2>Security & Maintenance</h2><p>Restrict access temporarily when the system needs maintenance.</p><div className="settings-toggle"><div><strong>Maintenance mode</strong><span>Enable this only when you need to temporarily restrict normal system use.</span></div><label className="settings-switch"><input type="checkbox" checked={settings.maintenanceMode} onChange={e => update("maintenanceMode", e.target.checked)} /><span className="settings-slider" /></label></div></div> : null}

            <div className="settings-actions"><span className={error ? "settings-error" : "settings-message"}>{error || message}</span><button className="settings-reset" onClick={reset} disabled={saving}>Restore Defaults</button><button className="settings-save" onClick={save} disabled={saving || busy}><Save size={15} /> {saving ? "Saving..." : "Save Changes"}</button></div>
          </div>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };
  if ((session.user as any).role !== "ADMIN") return { redirect: { destination: "/dashboard", permanent: false } };
  return { props: {} };
};
