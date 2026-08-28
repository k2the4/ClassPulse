import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw, X } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ExamKey = "midsem1" | "midsem2" | "combined" | "max";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
type CombinedSort = "combined" | "midsem1" | "midsem2" | "max";
type SortOrder = "desc" | "asc" | "none";

const MAX = 30;
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const COLORS: Record<Tier, string> = { Excellent: "#15966a", Good: "#4d75d0", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : round1((sorted[m - 1] + sorted[m]) / 2);
}

function valueFor(student: any, exam: ExamKey) {
  if (exam === "midsem1") return Number(student.midsem?.first || 0);
  if (exam === "midsem2") return Number(student.midsem?.second || 0);
  if (exam === "max") return Number(student.midsem?.max || 0);
  return Number(student.midsem?.combined || 0);
}

function tierFor(marks: number): Tier {
  const p = (marks / MAX) * 100;
  if (p >= 80) return "Excellent";
  if (p >= 60) return "Good";
  if (p >= 40) return "Needs Attention";
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
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [combinedSort, setCombinedSort] = useState<CombinedSort>("combined");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail ? `${j.error}: ${j.detail}` : j.error || "Failed to load academic analysis");
      setData(j.data);
      setComputedAt(j.computedAt || "");
      setSheetId(j.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load academic analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { loadAnalysis(); }, [subjectId]);
  useEffect(() => { setSelectedTier(null); }, [view]);

  const students = data?.students || [];
  const statsFor = (exam: "midsem1" | "midsem2") => {
    const rows = students.map((s: any) => ({ enrollmentNo: s.enrollmentNo, name: s.name, marks: valueFor(s, exam) }));
    const marks = rows.map((r) => r.marks);
    const highest = marks.length ? Math.max(...marks) : 0;
    const counts = TIERS.reduce((r, t) => ({ ...r, [t]: 0 }), {} as Record<Tier, number>);
    rows.forEach((r) => counts[tierFor(r.marks)]++);
    return {
      rows,
      average: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : 0,
      median: median(marks),
      highest,
      highestNames: rows.filter((r) => r.marks === highest).map((r) => r.name),
      passRate: marks.length ? Math.round(rows.filter((r) => r.marks >= 12).length / marks.length * 100) : 0,
      counts,
      sorted: [...rows].sort((a, b) => b.marks - a.marks),
    };
  };

  const midsem1 = useMemo(() => statsFor("midsem1"), [students]);
  const midsem2 = useMemo(() => statsFor("midsem2"), [students]);
  const combinedRows = useMemo(() => students.map((s: any) => ({
    enrollmentNo: s.enrollmentNo,
    name: s.name,
    first: valueFor(s, "midsem1"),
    second: valueFor(s, "midsem2"),
    combined: valueFor(s, "combined"),
    max: valueFor(s, "max"),
  })), [students]);

  const combinedCounts = useMemo(() => {
    const r = TIERS.reduce((a, t) => ({ ...a, [t]: 0 }), {} as Record<Tier, number>);
    combinedRows.forEach((row) => r[tierFor(row.combined)]++);
    return r;
  }, [combinedRows]);

  const activeStats = view === "midsem2" ? midsem2 : midsem1;
  const activeLabel = view === "midsem2" ? "Midsem 2" : "Midsem 1";
  const activePie = TIERS.map((name) => ({ name, value: activeStats.counts[name], color: COLORS[name] }));
  const displayedRows = selectedTier ? activeStats.rows.filter((r) => tierFor(r.marks) === selectedTier) : activeStats.rows;

  const filteredCombinedRows = useMemo(
    () => selectedTier ? combinedRows.filter((row) => tierFor(row.combined) === selectedTier) : combinedRows,
    [combinedRows, selectedTier]
  );

  const sortedCombinedRows = useMemo(() => {
    if (sortOrder === "none") return [...filteredCombinedRows];
    const getValue = (row: typeof combinedRows[number]) => {
      if (combinedSort === "midsem1") return row.first;
      if (combinedSort === "midsem2") return row.second;
      if (combinedSort === "max") return row.max;
      return row.combined;
    };
    return [...filteredCombinedRows].sort((a, b) => {
      const diff = getValue(a) - getValue(b);
      if (diff !== 0) return sortOrder === "asc" ? diff : -diff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredCombinedRows, combinedSort, sortOrder]);

  const combinedRankRows = useMemo(() => [...combinedRows].sort((a, b) => b.combined - a.combined), [combinedRows]);
  const combinedAverage = combinedRows.length ? round1(combinedRows.reduce((sum, row) => sum + row.combined, 0) / combinedRows.length) : 0;
  const combinedHighest = combinedRows.length ? Math.max(...combinedRows.map((row) => row.combined)) : 0;
  const combinedHighestNames = combinedRows.filter((row) => row.combined === combinedHighest).map((row) => row.name);

  return <div className="analysis-layout">
    <aside className="analysis-sidebar">
      <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div>
      <nav className="analysis-side-nav">
        <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
        <a href="/classes"><BookOpen size={18} />Class Analysis</a>
        <a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18} />Subject Analysis</a>
      </nav>
      <RawDataButton sheetId={sheetId} />
      <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
    </aside>

    <main className="analysis-page">
      <header className="analysis-topbar">
        <div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div>
        <div className="analysis-top-actions"><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div>
      </header>

      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
      <div className="analysis-view-switch">
        {([["midsem1", "Midsem 1"], ["midsem2", "Midsem 2"], ["combined", "Combined"], ["summary", "Summary"]] as [AcademicView, string][]).map(([k, l]) => <button key={k} className={view === k ? "is-active" : ""} onClick={() => setView(k)}>{l}</button>)}
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
            <div className="analysis-panel-head"><div><h3>Data Sheet</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Pass mark: 12/30 (40%){selectedTier ? ` · Filtered: ${selectedTier}` : ""}</p></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{selectedTier && <button className="analysis-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedTier(null)}><X size={13} />Clear</button>}<span className="analysis-count">{displayedRows.length} Students</span></div></div>
            <div className="analysis-table-wrap academic-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Marks</th><th>Percentage</th><th>Status</th></tr></thead><tbody>{displayedRows.map(row => { const pass = row.marks >= 12, p = Math.round(row.marks / MAX * 100); return <tr key={row.enrollmentNo}><td><span className="student-cell"><span className="student-avatar">{initials(row.name)}</span>{row.name}</span></td><td className={pass ? "change-up" : "change-down"}>{row.marks}</td><td>{p}%</td><td><span className={`trend-badge ${pass ? "trend-up" : "trend-down"}`}>{pass ? "Pass" : "Fail"}</span></td></tr>; })}</tbody></table></div>
          </section>
          <div className="analysis-right-stack">
            <section className="analysis-panel academic-stats-panel"><div className="academic-highest"><span>Highest Score</span><strong>{activeStats.highest}</strong><p>{activeStats.highestNames.join(", ") || "—"}</p></div><div className="academic-tier-grid">{TIERS.map(t => <button key={t} type="button" className="academic-tier-card" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{ borderColor: `${COLORS[t]}55`, cursor: "pointer", boxShadow: selectedTier === t ? `0 0 0 2px ${COLORS[t]}33` : undefined }}><span>{t}</span><strong style={{ color: COLORS[t] }}>{activeStats.counts[t]}</strong></button>)}</div></section>
            <section className="analysis-panel analysis-chart-panel"><h3>Performance Tier</h3><p>Click a chart segment to filter the student table.</p><div className="analysis-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={activePie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3} onClick={(entry: any) => { const t = entry?.name as Tier | undefined; if (t && TIERS.includes(t)) setSelectedTier(selectedTier === t ? null : t); }}>{activePie.map(e => <Cell key={e.name} fill={e.color} cursor="pointer" opacity={!selectedTier || selectedTier === e.name ? 1 : .35} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section>
            <div className="academic-rank-grid"><section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{activeStats.sorted.slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong>{r.marks}</strong></div>)}</section><section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{[...activeStats.sorted].reverse().slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong className="is-negative">{r.marks}</strong></div>)}</section></div>
          </div>
        </section>
      </>}

      {data && view === "combined" && <>
        <section className="analysis-hero">
          <div className="analysis-hero-copy"><h2>Midsem Combined</h2><p>Compare both Midsem examinations in one view.</p></div>
          <Metric label="Students" value={combinedRows.length} detail="combined records" />
          <Metric label="Class Average" value={combinedAverage} detail="combined average" />
          <Metric label="Best Score" value={combinedHighest} detail={combinedHighestNames.join(", ") || "best individual result"} />
        </section>

        <section className="combined-controls-bar">
          <div className="combined-control"><label htmlFor="combined-sort-field">Grade / Sort By</label><select id="combined-sort-field" value={combinedSort} onChange={(e) => setCombinedSort(e.target.value as CombinedSort)}><option value="combined">Combined (average)</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Maximum score</option></select></div>
          <div className="combined-control"><label htmlFor="combined-sort-order">Order</label><select id="combined-sort-order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}><option value="desc">High to Low</option><option value="asc">Low to High</option><option value="none">No Sort</option></select></div>
        </section>

        <section className="combined-layout">
          <section className="analysis-panel analysis-table-panel combined-table-panel">
            <div className="analysis-panel-head"><div><h3>All Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>{selectedTier ? `Filtered: ${selectedTier}` : "Combined Midsem results"}</p></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{selectedTier && <button className="analysis-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedTier(null)}><X size={13} />Clear</button>}<span className="analysis-count">{sortedCombinedRows.length} Students</span></div></div>
            <div className="analysis-table-wrap combined-table-wrap"><table className="analysis-table"><thead><tr><th>Rank</th><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Combined</th><th>Max</th><th>Grade</th></tr></thead><tbody>{sortedCombinedRows.map((row, index) => { const tier = tierFor(row.combined); const rank = combinedRankRows.findIndex(r => r.enrollmentNo === row.enrollmentNo) + 1; return <tr key={row.enrollmentNo}><td>{sortOrder === "none" ? rank : index + 1}</td><td><span className="student-cell"><span className="student-avatar">{initials(row.name)}</span>{row.name}</span></td><td>{row.first}</td><td>{row.second}</td><td><strong>{row.combined}</strong></td><td>{row.max}</td><td><button type="button" className={`analysis-grade-badge ${tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk"}`} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}>{tier}</button></td></tr>; })}{!sortedCombinedRows.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match the selected filter.</td></tr>}</tbody></table></div>
          </section>

          <div className="combined-right-column">
            <section className="analysis-panel combined-chart-panel"><div className="combined-panel-title"><div><h3>Grade Distribution</h3><p>Click a bar to filter the table by performance tier.</p></div><span><strong>{combinedRows.length}</strong> Students</span></div><div className="combined-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={TIERS.map(t => ({ name: t, count: combinedCounts[t] }))} onClick={(state: any) => { const tier = state?.activeLabel as Tier | undefined; if (tier && TIERS.includes(tier)) setSelectedTier(selectedTier === tier ? null : tier); }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{TIERS.map(t => <Cell key={t} fill={COLORS[t]} cursor="pointer" opacity={!selectedTier || selectedTier === t ? 1 : .35} />)}</Bar></BarChart></ResponsiveContainer></div></section>
            <section className="analysis-panel combined-tier-panel"><h3>Performance Tiers</h3><div className="academic-tier-grid">{TIERS.map(t => <button key={t} type="button" className="academic-tier-card" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{ borderColor: `${COLORS[t]}55`, cursor: "pointer", boxShadow: selectedTier === t ? `0 0 0 2px ${COLORS[t]}33` : undefined }}><span>{t}</span><strong style={{ color: COLORS[t] }}>{combinedCounts[t]}</strong></button>)}</div></section>
            <div className="academic-rank-grid"><section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{combinedRankRows.slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong>{r.combined}</strong></div>)}</section><section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{[...combinedRankRows].reverse().slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong className="is-negative">{r.combined}</strong></div>)}</section></div>
          </div>
        </section>
      </>}

      {data && view === "summary" && <section className="analysis-content-grid"><section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><h3>Academic Summary</h3><span className="analysis-count">{students.length} Students</span></div><div className="analysis-table-wrap academic-table-wrap"><table className="analysis-table"><thead><tr><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Change</th></tr></thead><tbody>{combinedRows.map(r => { const c = round1(r.second - r.first); return <tr key={r.enrollmentNo}><td className="student-cell">{r.name}</td><td>{r.first}</td><td>{r.second}</td><td className={c >= 0 ? "change-up" : "change-down"}>{c > 0 ? "+" : ""}{c}</td></tr>; })}</tbody></table></div></section><section className="analysis-panel analysis-chart-panel"><h3>Combined Grade Distribution</h3><p>Students grouped by their combined Midsem performance.</p><div className="analysis-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={TIERS.map(t => ({ name: t, count: combinedCounts[t] }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{TIERS.map(t => <Cell key={t} fill={COLORS[t]} />)}</Bar></BarChart></ResponsiveContainer></div></section></section>}
    </main>

    <style jsx global>{`
      .combined-controls-bar { display: flex; justify-content: flex-end; align-items: flex-end; gap: 12px; margin: 0 0 18px; }
      .combined-control { min-width: 190px; }
      .combined-control label { display: block; margin-bottom: 7px; color: #667085; font-size: 11px; font-weight: 600; }
      .combined-control select { width: 100%; height: 40px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; }
      .combined-control select:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
      .combined-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(360px, .95fr); gap: 16px; align-items: start; }
      .combined-table-wrap { min-height: 560px; max-height: 560px; }
      .combined-table-panel .analysis-table th, .combined-table-panel .analysis-table td { white-space: nowrap; }
      .combined-table-panel .analysis-table th:not(:nth-child(2)), .combined-table-panel .analysis-table td:not(:nth-child(2)) { text-align: center; }
      .combined-right-column { display: grid; gap: 16px; }
      .combined-chart-panel { padding: 18px; }
      .combined-panel-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .combined-panel-title h3 { margin: 0; }
      .combined-panel-title p { margin: 5px 0 0; color: #98a2b3; font-size: 11px; }
      .combined-panel-title > span { color: #98a2b3; font-size: 11px; white-space: nowrap; }
      .combined-panel-title > span strong { color: #344054; }
      .combined-chart { height: 300px; margin-top: 10px; }
      .combined-tier-panel { padding: 18px; }
      @media (max-width: 1200px) { .combined-layout { grid-template-columns: 1fr; } .combined-right-column { grid-template-columns: 1fr 1fr; } .combined-right-column .academic-rank-grid { grid-column: 1 / -1; } }
      @media (max-width: 800px) { .combined-controls-bar { justify-content: flex-start; } .combined-layout { grid-template-columns: 1fr; } .combined-right-column { grid-template-columns: 1fr; } .combined-control { min-width: 0; flex: 1; } .combined-table-wrap { min-height: 480px; max-height: 480px; } }
      @media (max-width: 600px) { .combined-controls-bar { flex-direction: column; align-items: stretch; } }
    `}</style>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>;
}
