import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, BarChart3, BookOpen, Download, Gauge, GraduationCap, LayoutDashboard, Mail, RefreshCw, Search, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SectionAnalysis } from "../../../lib/analysisClass";

type AttendanceView = "trend" | "risk";
const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function ClassAttendancePage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const [view, setView] = useState<AttendanceView>("trend");
  const [data, setData] = useState<SectionAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [previousMonth, setPreviousMonth] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [trendCriteria, setTrendCriteria] = useState(5);
  const [search, setSearch] = useState("");
  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(100);
  const [riskTrendFilter, setRiskTrendFilter] = useState("All");
  const [riskMonth, setRiskMonth] = useState<"previous" | "current">("current");
  const [copied, setCopied] = useState(false);

  async function loadAnalysis(sync = false, previous = previousMonth, current = currentMonth, criteria = trendCriteria) {
    if (!sectionId || typeof sectionId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (sync) params.set("sync", "1");
      if (previous) params.set("previousMonth", previous);
      if (current) params.set("currentMonth", current);
      params.set("trendCriteria", String(criteria));
      const response = await fetch(`/api/analysis/section/${sectionId}?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load attendance analysis");
      setData(json.data); setComputedAt(json.computedAt || ""); setSheetId(json.sheetId || null);
      setPreviousMonth(previous || json.data?.monthsUsed?.previous || ""); setCurrentMonth(current || json.data?.monthsUsed?.current || "");
    } catch (e: any) { setError(e.message || "Failed to load attendance analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }

  useEffect(() => { loadAnalysis(); }, [sectionId]);
  const students = data?.students || [];
  const availableMonths = data?.availableMonths || [];
  const previousAverage = students.length ? round1(students.reduce((sum, s) => sum + s.attendancePct.prevMonth, 0) / students.length) : 0;
  const currentAverage = students.length ? round1(students.reduce((sum, s) => sum + s.attendancePct.currMonth, 0) / students.length) : 0;
  const averageChange = round1(currentAverage - previousAverage);
  const improvingCount = students.filter((s) => s.attendancePct.trend === "Increasing").length;
  const filteredStudents = useMemo(() => students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())), [students, search]);
  const riskResults = useMemo(() => students.filter((s) => { const attendance = riskMonth === "current" ? s.attendancePct.currMonth : s.attendancePct.prevMonth; return attendance >= lowerBound && attendance <= upperBound && (riskTrendFilter === "All" || s.attendancePct.trend === riskTrendFilter); }), [students, lowerBound, upperBound, riskTrendFilter, riskMonth]);
  const riskEmails = riskResults.map((s) => s.email).filter(Boolean);
  const riskLowCount = riskResults.filter((s) => (riskMonth === "current" ? s.attendancePct.currMonth : s.attendancePct.prevMonth) < 50).length;
  const riskDecreasingCount = riskResults.filter((s) => s.attendancePct.trend === "Decreasing").length;
  const trendData = [{ name: "Increasing", count: data?.trendCounts.increasing || 0, color: "#16a56a" }, { name: "Decreasing", count: data?.trendCounts.decreasing || 0, color: "#ef4444" }, { name: "Stable", count: data?.trendCounts.stable || 0, color: "#4d75d0" }];
  const attendanceDistribution = [{ name: "Below 30%", count: data?.attendanceBuckets.below30 || 0, color: "#ef4444" }, { name: "30% to 49%", count: data?.attendanceBuckets.to49 || 0, color: "#f97316" }, { name: "50% to 74%", count: data?.attendanceBuckets.to74 || 0, color: "#f59e0b" }, { name: "75% and above", count: data?.attendanceBuckets.above75 || 0, color: "#15966a" }];
  function openRisk(options: { trend?: string; lower?: number; upper?: number }) { setRiskTrendFilter(options.trend || "All"); setLowerBound(options.lower ?? 0); setUpperBound(options.upper ?? 100); setView("risk"); }
  async function copyEmails() { try { await navigator.clipboard.writeText(riskEmails.join("; ")); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }

  return <div className="analysis-layout">
    <aside className="analysis-sidebar"><div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div><nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a><a className="is-active" href={typeof sectionId === "string" ? `/section-analysis/${sectionId}/attendance` : "#"}><BookOpen size={18} />Class Analysis</a><a href="/subject-analysis"><GraduationCap size={18} />Subject Analysis</a></nav><div className="analysis-side-footer">ClassPulse Teacher Portal</div></aside>
    <main className="analysis-page">
      <header className="analysis-topbar"><div className="analysis-title-row"><h1>Class / Section Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><RawDataButton sheetId={sheetId} /><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div></header>
      {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}
      <div className="analysis-view-switch"><button className={view === "trend" ? "is-active" : ""} onClick={() => setView("trend")}>Trend</button><button className={view === "risk" ? "is-active" : ""} onClick={() => setView("risk")}>At Risk</button></div>
      {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318", display: "flex", gap: 8 }}><AlertCircle size={17} />{error}</div>}
      {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading attendance analysis...</div>}
      {data && view === "trend" && <>
        <section className="analysis-hero"><div className="analysis-hero-copy"><h2>Attendance Trend</h2><p>Compare attendance between two months and identify increasing, decreasing, and stable students.</p></div><Metric icon={<Users size={19} />} label={`Class Average (${previousMonth || "Previous"})`} value={`${previousAverage}%`} change={averageChange} /><Metric icon={<Gauge size={19} />} label={`Class Average (${currentMonth || "Current"})`} value={`${currentAverage}%`} change={averageChange} /><Metric icon={<Sparkles size={19} />} label="Students Improving" value={improvingCount} detail={`${students.length ? round1((improvingCount / students.length) * 100) : 0}% of total students`} /></section>
        <section className="analysis-panel analysis-settings"><h3>Trend Comparison Settings</h3><div className="analysis-settings-grid"><div><label>First Month</label><select value={previousMonth} onChange={(e) => setPreviousMonth(e.target.value)}>{availableMonths.map((month) => <option key={month}>{month}</option>)}</select></div><div><label>Second Month</label><select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)}>{availableMonths.map((month) => <option key={month}>{month}</option>)}</select></div><div><label>Trend Criteria (%)</label><input type="number" min="0" max="100" value={trendCriteria} onChange={(e) => setTrendCriteria(Number(e.target.value))} /></div><button className="analysis-primary" onClick={() => loadAnalysis(false, previousMonth, currentMonth, trendCriteria)} disabled={loading || !previousMonth || !currentMonth || previousMonth === currentMonth}><SlidersHorizontal size={15} />{loading ? "Applying..." : "Apply Comparison"}</button></div><div className="analysis-note"><AlertCircle size={14} />Trend calculation: a change of <strong>±{trendCriteria} percentage points</strong> or more is Increasing or Decreasing.</div></section>
        <section className="analysis-content-grid"><div className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><h3>Student Trend Analysis</h3><span className="analysis-count">{students.length} Students</span></div><div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#98a2b3" }} /><input placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32, width: 200, height: 38 }} /></div></div><div className="analysis-table-wrap"><table className="analysis-table analysis-attendance-trend-table"><thead><tr><th>S.No.</th><th>Student Name</th><th>Enrollment No.</th><th>{data.monthsUsed.previous || "Month 1"}</th><th>{data.monthsUsed.current || "Month 2"}</th><th>Change</th><th>Trend</th></tr></thead><tbody>{filteredStudents.map((student, index) => { const previous = student.attendancePct.prevMonth; const current = student.attendancePct.currMonth; const change = round1(current - previous); const trend = student.attendancePct.trend; return <tr key={student.enrollmentNo}><td>{index + 1}</td><td><span className="student-cell"><span className="student-avatar">{initials(student.name)}</span>{student.name}</span></td><td>{student.enrollmentNo}</td><td>{previous}%</td><td>{current}%</td><td className={change > 0 ? "change-up" : change < 0 ? "change-down" : ""}>{change > 0 ? "+" : ""}{change}%</td><td><span className={`trend-badge ${trend === "Increasing" ? "trend-up" : trend === "Decreasing" ? "trend-down" : "trend-stable"}`}>{trend === "Increasing" ? "↑ " : trend === "Decreasing" ? "↓ " : "− "}{trend}</span></td></tr>; })}</tbody></table></div></div><div className="analysis-right-stack"><ChartPanel title="Trend Distribution" subtitle="Click a column to filter those students in At Risk." data={trendData} onBarClick={(entry) => openRisk({ trend: entry?.name || "All" })} /><ChartPanel title="Attendance Distribution" subtitle="Click a column to open that attendance range in At Risk." data={attendanceDistribution} onBarClick={(entry) => { if (entry?.name === "Below 30%") openRisk({ lower: 0, upper: 29.999 }); else if (entry?.name === "30% to 49%") openRisk({ lower: 30, upper: 49.999 }); else if (entry?.name === "50% to 74%") openRisk({ lower: 50, upper: 74.999 }); else openRisk({ lower: 75, upper: 100 }); }} /></div></section>
      </>}
      {data && view === "risk" && <><section className="analysis-hero"><div className="analysis-hero-copy"><h2>At Risk Students</h2><p>Find students needing attention using attendance range and trend filters.</p></div><Metric icon={<Users size={19} />} label="Matching Students" value={riskResults.length} detail="Current filter result" /><Metric icon={<AlertCircle size={19} />} label="Below 50% Attendance" value={riskLowCount} detail="Within selected result" /><Metric icon={<Gauge size={19} />} label="Decreasing Trend" value={riskDecreasingCount} detail="Students whose attendance fell" /></section><section className="analysis-panel analysis-settings"><div className="analysis-panel-head" style={{ marginBottom: 18 }}><div><h3>Filter Criteria</h3><p style={{ margin: "5px 0 0", color: "#667085", fontSize: 12 }}>Narrow the list before copying addresses or sending alerts.</p></div><button className="analysis-secondary" onClick={() => { setLowerBound(0); setUpperBound(100); setRiskTrendFilter("All"); setRiskMonth("current"); }}><RefreshCw size={14} />Reset</button></div><div className="analysis-settings-grid"><div><label>Lower Bound (%)</label><input type="number" min="0" max="100" value={lowerBound} onChange={(e) => setLowerBound(Math.max(0, Math.min(100, Number(e.target.value))))} /></div><div><label>Upper Bound (%)</label><input type="number" min="0" max="100" value={upperBound} onChange={(e) => setUpperBound(Math.max(0, Math.min(100, Number(e.target.value))))} /></div><div><label>Trend</label><select value={riskTrendFilter} onChange={(e) => setRiskTrendFilter(e.target.value)}><option>All</option><option>Increasing</option><option>Decreasing</option><option>Stable</option></select></div><div><label>Month</label><select value={riskMonth} onChange={(e) => setRiskMonth(e.target.value as "previous" | "current")}><option value="current">{currentMonth}</option><option value="previous">{previousMonth}</option></select></div></div></section><section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><h3>Filtered Students</h3><span className="analysis-count">{riskResults.length} Students</span></div></div><div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Enrollment</th><th>Attendance</th><th>Trend</th><th>Email</th></tr></thead><tbody>{riskResults.length ? riskResults.map((student) => { const attendance = riskMonth === "current" ? student.attendancePct.currMonth : student.attendancePct.prevMonth; const trend = student.attendancePct.trend; return <tr key={student.enrollmentNo}><td><span className="student-cell"><span className="student-avatar">{initials(student.name)}</span>{student.name}</span></td><td>{student.enrollmentNo}</td><td className={attendance < 50 ? "change-down" : ""}>{attendance}%</td><td><span className={`trend-badge ${trend === "Increasing" ? "trend-up" : trend === "Decreasing" ? "trend-down" : "trend-stable"}`}>{trend}</span></td><td>{student.email || "—"}</td></tr>; }) : <tr><td colSpan={5} style={{ textAlign: "center", padding: 36, color: "#667085" }}>No students match the current filters.</td></tr>}</tbody></table></div><div className="analysis-insight-actions" style={{ marginTop: 16, justifyContent: "flex-end" }}><button className="analysis-secondary" onClick={copyEmails} disabled={!riskEmails.length}><Download size={15} />{copied ? "Copied" : "Copy Emails"}</button><a className="analysis-primary" href={`mailto:?bcc=${encodeURIComponent(riskEmails.join(","))}`} style={{ pointerEvents: riskEmails.length ? "auto" : "none", opacity: riskEmails.length ? 1 : 0.55 }}><Mail size={15} />Send Alert Emails</a></div></section></>}
    </main>
  </div>;
}

function Metric({ icon, label, value, change, detail }: { icon: ReactNode; label: string; value: string | number; change?: number; detail?: string }) { const changeClass = change !== undefined && change > 0 ? "change-up" : change !== undefined && change < 0 ? "change-down" : ""; return <div className="analysis-metric"><div className="analysis-metric-icon">{icon}</div><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong>{change !== undefined && <small className={changeClass}>{change > 0 ? "↑ +" : change < 0 ? "↓ " : ""}{change}%</small>}</div>{detail && <small className="analysis-metric-detail">{detail}</small>}</div></div>; }
function ChartPanel({ title, subtitle, data, onBarClick }: { title: string; subtitle: string; data: { name: string; count: number; color: string }[]; onBarClick: (entry: { name: string } | undefined) => void }) { return <div className="analysis-panel analysis-chart-panel"><div className="analysis-chart-head"><div><h3>{title}</h3><p>{subtitle}</p></div></div><div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 18, right: 8, left: -14, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: "rgba(79,70,229,0.05)" }} /><Bar dataKey="count" radius={[4, 4, 0, 0]} onClick={(_, index) => onBarClick(data[index])}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div></div>; }
