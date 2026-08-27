import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BookOpen, Download, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ExamKey = "midsem1" | "midsem2" | "combined" | "max";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";

const MAX = 30;
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const COLORS: Record<Tier, string> = {
  Excellent: "#15966a",
  Good: "#4d75d0",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round1((sorted[middle - 1] + sorted[middle]) / 2);
}

function valueFor(student: any, exam: ExamKey) {
  if (exam === "midsem1") return Number(student.midsem?.first || 0);
  if (exam === "midsem2") return Number(student.midsem?.second || 0);
  if (exam === "max") return Number(student.midsem?.max || 0);
  return Number(student.midsem?.combined || 0);
}

function tierFor(marks: number): Tier {
  const percentage = (marks / MAX) * 100;
  if (percentage >= 80) return "Excellent";
  if (percentage >= 60) return "Good";
  if (percentage >= 40) return "Needs Attention";
  return "Critical Risk";
}

export default function SubjectAcademicPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [view, setView] = useState<AcademicView>("midsem1");
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
      setData(json.data);
      setComputedAt(json.computedAt || "");
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load academic analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { loadAnalysis(); }, [subjectId]);

  const students = data?.students || [];
  const statsFor = (exam: "midsem1" | "midsem2") => {
    const rows = students.map((student: any) => ({ enrollmentNo: student.enrollmentNo, name: student.name, marks: valueFor(student, exam) }));
    const marks = rows.map((row) => row.marks);
    const highest = marks.length ? Math.max(...marks) : 0;
    const counts = TIERS.reduce((result, tier) => ({ ...result, [tier]: 0 }), {} as Record<Tier, number>);
    rows.forEach((row) => counts[tierFor(row.marks)]++);
    return {
      rows,
      average: marks.length ? round1(marks.reduce((sum, mark) => sum + mark, 0) / marks.length) : 0,
      median: median(marks),
      highest,
      highestNames: rows.filter((row) => row.marks === highest).map((row) => row.name),
      passRate: marks.length ? Math.round((rows.filter((row) => row.marks >= 12).length / marks.length) * 100) : 0,
      counts,
      sorted: [...rows].sort((a, b) => b.marks - a.marks),
    };
  };

  const midsem1 = useMemo(() => statsFor("midsem1"), [students]);
  const midsem2 = useMemo(() => statsFor("midsem2"), [students]);
  const combinedRows = useMemo(() => students.map((student: any) => ({ enrollmentNo: student.enrollmentNo, name: student.name, first: valueFor(student, "midsem1"), second: valueFor(student, "midsem2"), combined: valueFor(student, "combined"), max: valueFor(student, "max") })), [students]);
  const combinedCounts = useMemo(() => {
    const result = TIERS.reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {} as Record<Tier, number>);
    combinedRows.forEach((row) => result[tierFor(row.combined)]++);
    return result;
  }, [combinedRows]);

  const activeStats = view === "midsem2" ? midsem2 : midsem1;
  const activeLabel = view === "midsem2" ? "Midsem 2" : "Midsem 1";
  const activePie = TIERS.map((name) => ({ name, value: activeStats.counts[name], color: COLORS[name] }));

  return (
    <div className="analysis-layout">
      <aside className="analysis-sidebar">
        <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div>
        <nav className="analysis-side-nav">
          <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a href="/classes"><BookOpen size={18} />Class Analysis</a>
          <a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18} />Subject Analysis</a>
          {sheetId && <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noopener noreferrer"><Download size={18} />Raw Data</a>}
        </nav>
        <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="analysis-page">
        <header className="analysis-topbar">
          <div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div>
          <div className="analysis-top-actions"><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div>
        </header>

        {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
        <div className="analysis-view-switch">
          {([ ["midsem1", "Midsem 1"], ["midsem2", "Midsem 2"], ["combined", "Combined"], ["summary", "Summary"] ] as [AcademicView, string][]).map(([key, label]) => <button key={key} className={view === key ? "is-active" : ""} onClick={() => setView(key)}>{label}</button>)}
        </div>

        {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
        {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading academic analysis...</div>}

        {data && (view === "midsem1" || view === "midsem2") && <>
          <section className="analysis-hero">
            <div className="analysis-hero-copy"><h2>{activeLabel}</h2><p>Raw Midsem marks out of 30, class statistics, and performance tiers.</p></div>
            <Metric label="Class Average" value={activeStats.average} detail="out of 30 marks" />
            <Metric label="Class Median" value={activeStats.median} detail="middle class score" />
            <Metric label="Pass Rate" value={`${activeStats.passRate}%`} detail="students scoring 12 or more" />
          </section>

          <section className="analysis-content-grid academic-content-grid">
            <section className="analysis-panel analysis-table-panel">
              <div className="analysis-panel-head"><div><h3>Data Sheet</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Pass mark: 12/30 (40%)</p></div><span className="analysis-count">{activeStats.rows.length} Students</span></div>
              <div className="analysis-table-wrap academic-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Marks</th><th>Percentage</th><th>Status</th></tr></thead><tbody>{activeStats.rows.map((row) => {
                const pass = row.marks >= 12; const percentage = Math.round((row.marks / MAX) * 100);
                return <tr key={row.enrollmentNo}><td><span className="student-cell"><span className="student-avatar">{initials(row.name)}</span>{row.name}</span></td><td className={pass ? "change-up" : "change-down"}>{row.marks}</td><td>{percentage}%</td><td><span className={`trend-badge ${pass ? "trend-up" : "trend-down"}`}>{pass ? "Pass" : "Fail"}</span></td></tr>;
              })}</tbody></table></div>
            </section>

            <div className="analysis-right-stack">
              <section className="analysis-panel academic-stats-panel">
                <div className="academic-highest"><span>Highest Score</span><strong>{activeStats.highest}</strong><p>{activeStats.highestNames.join(", ") || "—"}</p></div>
                <div className="academic-tier-grid">{TIERS.map((tier) => <div key={tier} className="academic-tier-card" style={{ borderColor: `${COLORS[tier]}33` }}><span>{tier}</span><strong style={{ color: COLORS[tier] }}>{activeStats.counts[tier]}</strong></div>)}</div>
              </section>
              <section className="analysis-panel analysis-chart-panel"><h3>Performance Tier</h3><p>Distribution of students by Midsem performance.</p><div className="analysis-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={activePie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>{activePie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section>
              <div className="academic-rank-grid">
                <section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{activeStats.sorted.slice(0, 5).map((row, index) => <div className="academic-rank-row" key={row.enrollmentNo}><span>{index + 1}</span><p>{row.name}</p><strong>{row.marks}</strong></div>)}</section>
                <section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{[...activeStats.sorted].reverse().slice(0, 5).map((row, index) => <div className="academic-rank-row" key={row.enrollmentNo}><span>{index + 1}</span><p>{row.name}</p><strong className="is-negative">{row.marks}</strong></div>)}</section>
              </div>
            </div>
          </section>
        </>}

        {data && view === "combined" && <>
          <section className="analysis-hero"><div className="analysis-hero-copy"><h2>Midsem Combined</h2><p>Compare both Midsem examinations in one view.</p></div><Metric label="Students" value={combinedRows.length} detail="combined records" /><Metric label="Class Average" value={combinedRows.length ? round1(combinedRows.reduce((sum, row) => sum + row.combined, 0) / combinedRows.length) : 0} detail="combined average" /><Metric label="Best Score" value={combinedRows.length ? Math.max(...combinedRows.map((row) => row.max)) : 0} detail="best individual result" /></section>
          <section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><h3>All Students</h3><span className="analysis-count">{combinedRows.length} Students</span></div><div className="analysis-table-wrap academic-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Combined</th><th>Max</th></tr></thead><tbody>{combinedRows.map((row) => <tr key={row.enrollmentNo}><td className="student-cell">{row.name}</td><td>{row.first}</td><td>{row.second}</td><td>{row.combined}</td><td>{row.max}</td></tr>)}</tbody></table></div></section>
        </>}

        {data && view === "summary" && <section className="analysis-content-grid">
          <section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><h3>Academic Summary</h3><span className="analysis-count">{students.length} Students</span></div><div className="analysis-table-wrap academic-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Change</th></tr></thead><tbody>{combinedRows.map((row) => { const change = round1(row.second - row.first); return <tr key={row.enrollmentNo}><td className="student-cell">{row.name}</td><td>{row.first}</td><td>{row.second}</td><td className={change >= 0 ? "change-up" : "change-down"}>{change > 0 ? "+" : ""}{change}</td></tr>; })}</tbody></table></div></section>
          <section className="analysis-panel analysis-chart-panel"><h3>Combined Grade Distribution</h3><p>Students grouped by their combined Midsem performance.</p><div className="analysis-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={TIERS.map((tier) => ({ name: tier, count: combinedCounts[tier] }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{TIERS.map((tier) => <Cell key={tier} fill={COLORS[tier]} />)}</Bar></BarChart></ResponsiveContainer></div></section>
        </section>}
      </main>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>;
}
