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
type SummaryExam = "combined" | "midsem1" | "midsem2" | "max";
type SummarySort = "none" | "desc" | "asc";

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

function gradeClass(tier: Tier) {
  return tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk";
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
  const [summaryExam, setSummaryExam] = useState<SummaryExam>("combined");
  const [summaryTier, setSummaryTier] = useState<Tier | "all">("all");
  const [summaryLower, setSummaryLower] = useState("0");
  const [summaryUpper, setSummaryUpper] = useState("30");
  const [summarySort, setSummarySort] = useState<SummarySort>("none");

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
    const baseRows = students.map((s: any, index: number) => ({
      sno: index + 1,
      enrollmentNo: s.enrollmentNo,
      name: s.name,
      marks: valueFor(s, exam),
    }));
    const rankByEnrollment = new Map<string, number>();
    [...baseRows]
      .sort((a, b) => b.marks - a.marks || a.name.localeCompare(b.name))
      .forEach((row, index, sorted) => {
        const previous = index > 0 ? sorted[index - 1].marks : null;
        rankByEnrollment.set(
          row.enrollmentNo,
          previous === row.marks
            ? (rankByEnrollment.get(sorted[index - 1].enrollmentNo) || index + 1)
            : index + 1
        );
      });
    const rows = baseRows.map((row) => ({ ...row, rank: rankByEnrollment.get(row.enrollmentNo) || 0 }));
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
  const summaryRows = useMemo(() => combinedRows.map((row) => {
    const marks = summaryExam === "midsem1" ? row.first : summaryExam === "midsem2" ? row.second : summaryExam === "max" ? row.max : row.combined;
    return { ...row, marks, tier: tierFor(marks), change: round1(row.second - row.first) };
  }).filter((row) => {
    const lower = Number(summaryLower);
    const upper = Number(summaryUpper);
    return row.marks >= (Number.isFinite(lower) ? lower : 0) && row.marks <= (Number.isFinite(upper) ? upper : MAX) && (summaryTier === "all" || row.tier === summaryTier);
  }).sort((a, b) => {
    if (summarySort === "none") return 0;
    return summarySort === "desc" ? b.marks - a.marks : a.marks - b.marks;
  }), [combinedRows, summaryExam, summaryTier, summaryLower, summaryUpper, summarySort]);
  const summaryAverage = combinedRows.length ? round1(combinedRows.reduce((sum, row) => sum + row.combined, 0) / combinedRows.length) : 0;
  const summaryPassRate = combinedRows.length ? Math.round(combinedRows.filter((row) => row.combined >= 12).length / combinedRows.length * 100) : 0;
  const midsem1Average = midsem1.average;
  const midsem2Average = midsem2.average;
  const increases = [...combinedRows].map((row) => ({ ...row, change: round1(row.second - row.first) })).filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const decreases = [...combinedRows].map((row) => ({ ...row, change: round1(row.second - row.first) })).filter((row) => row.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

  return (
    <div className="analysis-layout">
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
              <div className="analysis-table-wrap academic-table-wrap">
                <table className="analysis-table academic-student-table">
                  <colgroup><col className="academic-sno-col" /><col className="academic-enrollment-col" /><col className="academic-name-col" /><col className="academic-marks-col" /><col className="academic-status-col" /><col className="academic-rank-col" /></colgroup>
                  <thead><tr><th>S.No.</th><th>Enrollment No.</th><th>Student</th><th>Marks</th><th>Status</th><th>Rank</th></tr></thead>
                  <tbody>{displayedRows.map((row) => { const pass = row.marks >= 12; return <tr key={row.enrollmentNo}><td>{row.sno}</td><td className="academic-enrollment-cell">{row.enrollmentNo}</td><td>{row.name}</td><td className={pass ? "change-up" : "change-down"}>{row.marks}</td><td><span className={`trend-badge ${pass ? "trend-up" : "trend-down"}`}>{pass ? "Pass" : "Fail"}</span></td><td>{row.rank}</td></tr>; })}</tbody>
                </table>
              </div>
            </section>
            <div className="analysis-right-stack">
              <section className="analysis-panel academic-stats-panel"><div className="academic-highest"><span>Highest Score</span><strong>{activeStats.highest}</strong><p>{activeStats.highestNames.join(", ") || "—"}</p></div><div className="academic-tier-grid">{TIERS.map((t) => <button key={t} type="button" className="academic-tier-card" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{ borderColor: `${COLORS[t]}55`, cursor: "pointer", boxShadow: selectedTier === t ? `0 0 0 2px ${COLORS[t]}33` : undefined }}><span>{t}</span><strong style={{ color: COLORS[t] }}>{activeStats.counts[t]}</strong></button>)}</div></section>
              <section className="analysis-panel analysis-chart-panel"><h3>Performance Tier</h3><p>Click a chart segment to filter the student table.</p><div className="analysis-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={activePie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3} onClick={(entry: any) => { const t = entry?.name as Tier | undefined; if (t && TIERS.includes(t)) setSelectedTier(selectedTier === t ? null : t); }}>{activePie.map((e) => <Cell key={e.name} fill={e.color} cursor="pointer" opacity={!selectedTier || selectedTier === e.name ? 1 : .35} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section>
              <div className="academic-rank-grid"><section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{activeStats.sorted.slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong>{r.marks}</strong></div>)}</section><section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{[...activeStats.sorted].reverse().slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong className="is-negative">{r.marks}</strong></div>)}</section></div>
            </div>
          </section>
        </>}

        {data && view === "combined" && <>
          <section className="analysis-hero combined-hero"><div className="analysis-hero-copy"><h2>Midsem Combined</h2><p>Compare both Midsem examinations in one view.</p></div><Metric label="Students" value={combinedRows.length} detail="combined records" /><Metric label="Class Average" value={combinedAverage} detail="combined average" /><Metric label="Best Score" value={combinedHighest} detail={combinedHighestNames.join(", ") || "best individual result"} /></section>
          <section className="combined-controls-bar"><div className="combined-control"><label htmlFor="combined-sort-field">Grade / Sort By</label><select id="combined-sort-field" value={combinedSort} onChange={(e) => setCombinedSort(e.target.value as CombinedSort)}><option value="combined">Combined (average)</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Maximum score</option></select></div><div className="combined-control"><label htmlFor="combined-sort-order">Order</label><select id="combined-sort-order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}><option value="desc">High to Low</option><option value="asc">Low to High</option><option value="none">No Sort</option></select></div></section>
          <section className="combined-layout">
            <section className="analysis-panel analysis-table-panel combined-table-panel">
              <div className="analysis-panel-head"><div><h3>All Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>{selectedTier ? `Filtered: ${selectedTier}` : "Combined Midsem results"}</p></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{selectedTier && <button className="analysis-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedTier(null)}><X size={13} />Clear</button>}<span className="analysis-count">{sortedCombinedRows.length} Students</span></div></div>
              <div className="analysis-table-wrap combined-table-wrap"><table className="analysis-table"><thead><tr><th>Rank</th><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Combined</th><th>Max</th><th>Grade</th></tr></thead><tbody>{sortedCombinedRows.map((row, index) => { const tier = tierFor(row.combined); const rank = combinedRankRows.findIndex((r) => r.enrollmentNo === row.enrollmentNo) + 1; return <tr key={row.enrollmentNo}><td>{sortOrder === "none" ? rank : index + 1}</td><td>{row.name}</td><td className={`tier-mark ${gradeClass(tierFor(row.first))}`}>{row.first}</td><td className={`tier-mark ${gradeClass(tierFor(row.second))}`}>{row.second}</td><td className={`tier-mark ${gradeClass(tier)}`}><strong>{row.combined}</strong></td><td className={`tier-mark ${gradeClass(tierFor(row.max))}`}>{row.max}</td><td><button type="button" className={`analysis-grade-badge ${gradeClass(tier)}`} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}>{tier}</button></td></tr>; })}{!sortedCombinedRows.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match the selected filter.</td></tr>}</tbody></table></div>
            </section>
            <div className="combined-right-column">
              <section className="analysis-panel combined-chart-panel"><div className="combined-panel-title"><div><h3>Grade Distribution</h3><p>Click a bar to filter the table by performance tier.</p></div><span><strong>{combinedRows.length}</strong> Students</span></div><div className="combined-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={TIERS.map((t) => ({ name: t, count: combinedCounts[t] }))} onClick={(state: any) => { const tier = state?.activeLabel as Tier | undefined; if (tier && TIERS.includes(tier)) setSelectedTier(selectedTier === tier ? null : tier); }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{TIERS.map((t) => <Cell key={t} fill={COLORS[t]} cursor="pointer" opacity={!selectedTier || selectedTier === t ? 1 : .35} />)}</Bar></BarChart></ResponsiveContainer></div></section>
              <section className="analysis-panel combined-tier-panel"><h3>Performance Tiers</h3><div className="academic-tier-grid">{TIERS.map((t) => <button key={t} type="button" className="academic-tier-card" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{ borderColor: `${COLORS[t]}55`, cursor: "pointer", boxShadow: selectedTier === t ? `0 0 0 2px ${COLORS[t]}33` : undefined }}><span>{t}</span><strong style={{ color: COLORS[t] }}>{combinedCounts[t]}</strong></button>)}</div></section>
              <div className="academic-rank-grid"><section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{combinedRankRows.slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong>{r.combined}</strong></div>)}</section><section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{[...combinedRankRows].reverse().slice(0, 5).map((r, i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i + 1}</span><p>{r.name}</p><strong className="is-negative">{r.combined}</strong></div>)}</section></div>
            </div>
          </section>
        </>}

        {data && view === "summary" && <>
          <section className="summary-heading"><div><h2>Academic Summary</h2><p>Compare Midsem 1 and Midsem 2 with the same ClassPulse academic analysis theme.</p></div></section>
          <section className="summary-filter-panel analysis-panel"><div className="summary-filter-title"><div><h3>Filter Criteria</h3><p>Narrow the student list by examination, performance tier, marks range, and order.</p></div><button className="analysis-secondary" onClick={() => { setSummaryExam("combined"); setSummaryTier("all"); setSummaryLower("0"); setSummaryUpper("30"); setSummarySort("none"); }}>Reset</button></div><div className="summary-filter-grid"><label><span>Exam</span><select value={summaryExam} onChange={(e) => setSummaryExam(e.target.value as SummaryExam)}><option value="combined">Combined</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Max</option></select></label><label><span>Performance Tier</span><select value={summaryTier} onChange={(e) => setSummaryTier(e.target.value as Tier | "all")}><option value="all">All Tiers</option>{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label><label><span>Lower Bound</span><input type="number" min="0" max="30" value={summaryLower} onChange={(e) => setSummaryLower(e.target.value)} /></label><label><span>Upper Bound</span><input type="number" min="0" max="30" value={summaryUpper} onChange={(e) => setSummaryUpper(e.target.value)} /></label><label><span>Sort</span><select value={summarySort} onChange={(e) => setSummarySort(e.target.value as SummarySort)}><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></label></div></section>
          <section className="summary-metric-grid"><Metric label="Overall Class Average" value={summaryAverage} detail="combined average" /><Metric label="Highest Combined Score" value={combinedHighest} detail={combinedHighestNames[0] || "—"} /><Metric label="Overall Pass Rate" value={`${summaryPassRate}%`} detail="students scoring 12 or more" /><Metric label="Midsem 1 Average" value={midsem1Average} detail="out of 30 marks" /><Metric label="Midsem 2 Average" value={midsem2Average} detail="out of 30 marks" /></section>
          <section className="summary-main-grid"><section className="analysis-panel summary-student-panel"><div className="analysis-panel-head"><div><h3>Filtered Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Showing {summaryRows.length} of {students.length} students</p></div><span className="analysis-count">{summaryRows.length} Students</span></div><div className="analysis-table-wrap summary-table-wrap"><table className="analysis-table"><thead><tr><th>Enrollment</th><th>Student</th><th>Marks</th><th>Tier</th></tr></thead><tbody>{summaryRows.map((row) => <tr key={row.enrollmentNo}><td>{row.enrollmentNo}</td><td>{row.name}</td><td className={`tier-mark ${gradeClass(row.tier)}`}><strong>{row.marks}</strong></td><td><button type="button" className={`analysis-grade-badge ${gradeClass(row.tier)}`} onClick={() => setSummaryTier(summaryTier === row.tier ? "all" : row.tier)}>{row.tier}</button></td></tr>)}{!summaryRows.length && <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match these filters.</td></tr>}</tbody></table></div></section><div className="summary-right-column"><section className="analysis-panel summary-rank-panel"><div className="summary-rank-title"><div><h3>Marks Increase (Top 5)</h3><p>Students whose Midsem 2 score improved.</p></div></div>{increases.length ? increases.map((row, i) => <div className="summary-rank-row" key={row.enrollmentNo}><span>{i + 1}.</span><p>{row.name}</p><strong className="change-up">+{row.change}</strong></div>) : <p className="summary-empty">No increases.</p>}</section><section className="analysis-panel summary-rank-panel"><div className="summary-rank-title"><div><h3>Marks Decrease (Top 5)</h3><p>Students whose Midsem 2 score fell.</p></div></div>{decreases.length ? decreases.map((row, i) => <div className="summary-rank-row" key={row.enrollmentNo}><span>{i + 1}.</span><p>{row.name}</p><strong className="change-down">{row.change}</strong></div>) : <p className="summary-empty">No decreases.</p>}</section></div></section>
        </>}
      </main>

      <style jsx global>{`
        .academic-student-table { table-layout: fixed; }
        .academic-student-table th, .academic-student-table td { padding: 10px 12px !important; vertical-align: middle; white-space: nowrap; }
        .academic-student-table th { font-size: 10px; }
        .academic-student-table td { font-size: 11px; }
        .academic-sno-col { width: 7%; }
        .academic-enrollment-col { width: 21%; }
        .academic-name-col { width: 32%; }
        .academic-marks-col { width: 14%; }
        .academic-status-col { width: 14%; }
        .academic-rank-col { width: 12%; }
        .academic-student-table th:not(:nth-child(3)), .academic-student-table td:not(:nth-child(3)) { text-align: center; }
        .academic-student-table th:nth-child(3), .academic-student-table td:nth-child(3) { text-align: left; }
        .academic-enrollment-cell { color: #667085; font-variant-numeric: tabular-nums; }
        .combined-controls-bar { display: flex; justify-content: flex-end; align-items: flex-end; gap: 12px; margin: 0 0 18px; }
        .combined-control { min-width: 190px; }
        .combined-control label { display: block; margin-bottom: 7px; color: #667085; font-size: 11px; font-weight: 600; }
        .combined-control select { width: 100%; height: 40px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; }
        .combined-control select:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
        .combined-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(360px, .95fr); gap: 16px; align-items: start; }
        .combined-table-wrap { min-height: 560px; max-height: 560px; }
        .combined-table-panel .analysis-table { table-layout: fixed; }
        .combined-table-panel .analysis-table th, .combined-table-panel .analysis-table td { white-space: nowrap; }
        .combined-table-panel .analysis-table th:nth-child(1), .combined-table-panel .analysis-table td:nth-child(1) { width: 55px; }
        .combined-table-panel .analysis-table th:nth-child(2), .combined-table-panel .analysis-table td:nth-child(2) { width: 28%; }
        .combined-table-panel .analysis-table th:nth-child(3), .combined-table-panel .analysis-table td:nth-child(3), .combined-table-panel .analysis-table th:nth-child(4), .combined-table-panel .analysis-table td:nth-child(4), .combined-table-panel .analysis-table th:nth-child(5), .combined-table-panel .analysis-table td:nth-child(5), .combined-table-panel .analysis-table th:nth-child(6), .combined-table-panel .analysis-table td:nth-child(6) { width: 11%; }
        .combined-table-panel .analysis-table th:nth-child(7), .combined-table-panel .analysis-table td:nth-child(7) { width: 16%; }
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
        .tier-mark { font-weight: 700; }
        .tier-mark.excellent { color: #15966a !important; }
        .tier-mark.good { color: #4d75d0 !important; }
        .tier-mark.attention { color: #f59e0b !important; }
        .tier-mark.risk { color: #ef4444 !important; }
        .combined-hero .analysis-metric:nth-child(2), .summary-metric-grid .analysis-metric:nth-child(1) { border-top: 3px solid #4d75d0; }
        .combined-hero .analysis-metric:nth-child(3), .summary-metric-grid .analysis-metric:nth-child(2) { border-top: 3px solid #15966a; }
        .combined-hero .analysis-metric:nth-child(4), .summary-metric-grid .analysis-metric:nth-child(3) { border-top: 3px solid #f59e0b; }
        .summary-metric-grid .analysis-metric:nth-child(4) { border-top: 3px solid #4d75d0; }
        .summary-metric-grid .analysis-metric:nth-child(5) { border-top: 3px solid #15966a; }
        .summary-heading { margin: 4px 0 18px; }
        .summary-heading h2 { margin: 0; font-size: 22px; }
        .summary-heading p { margin: 6px 0 0; color: #667085; font-size: 13px; }
        .summary-filter-panel { padding: 18px; margin-bottom: 16px; }
        .summary-filter-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
        .summary-filter-title h3 { margin: 0; }
        .summary-filter-title p { margin: 5px 0 0; color: #98a2b3; font-size: 11px; }
        .summary-filter-grid { display: grid; grid-template-columns: 1.1fr 1.1fr .8fr .8fr 1fr; gap: 12px; }
        .summary-filter-grid label { display: block; }
        .summary-filter-grid label > span { display: block; margin: 0 0 7px; color: #667085; font-size: 11px; font-weight: 600; }
        .summary-filter-grid select, .summary-filter-grid input { width: 100%; height: 40px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; box-sizing: border-box; }
        .summary-filter-grid select:focus, .summary-filter-grid input:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
        .summary-metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .summary-main-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, .9fr); gap: 16px; align-items: start; }
        .summary-student-panel { min-width: 0; }
        .summary-table-wrap { max-height: 650px; min-height: 650px; overflow: auto; }
        .summary-table-wrap .analysis-table { table-layout: fixed; }
        .summary-table-wrap .analysis-table th, .summary-table-wrap .analysis-table td { white-space: nowrap; }
        .summary-table-wrap .analysis-table th:nth-child(1), .summary-table-wrap .analysis-table td:nth-child(1) { width: 24%; }
        .summary-table-wrap .analysis-table th:nth-child(2), .summary-table-wrap .analysis-table td:nth-child(2) { width: 40%; }
        .summary-table-wrap .analysis-table th:nth-child(3), .summary-table-wrap .analysis-table td:nth-child(3) { width: 16%; text-align: center; }
        .summary-table-wrap .analysis-table th:nth-child(4), .summary-table-wrap .analysis-table td:nth-child(4) { width: 20%; text-align: center; }
        .summary-right-column { display: grid; gap: 16px; }
        .summary-rank-panel { padding: 18px; }
        .summary-rank-title h3 { margin: 0; }
        .summary-rank-title p { margin: 5px 0 12px; color: #98a2b3; font-size: 11px; }
        .summary-rank-row { display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eef1f5; font-size: 12px; }
        .summary-rank-row:last-child { border-bottom: 0; }
        .summary-rank-row > span { color: #667085; }
        .summary-rank-row p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #344054; }
        .summary-rank-row strong { font-size: 12px; }
        .summary-empty { color: #98a2b3; font-size: 12px; margin: 10px 0 0; }
        @media (max-width: 1200px) { .combined-layout, .summary-main-grid { grid-template-columns: 1fr; } .combined-right-column { grid-template-columns: 1fr 1fr; } .combined-right-column .academic-rank-grid { grid-column: 1 / -1; } .summary-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .summary-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 800px) { .combined-controls-bar { justify-content: flex-start; } .combined-layout, .summary-main-grid { grid-template-columns: 1fr; } .combined-right-column, .summary-metric-grid, .summary-filter-grid { grid-template-columns: 1fr; } .combined-control { min-width: 0; flex: 1; } .combined-table-wrap, .summary-table-wrap { min-height: 480px; max-height: 480px; } .academic-student-table { min-width: 760px; } }
        @media (max-width: 600px) { .combined-controls-bar { flex-direction: column; align-items: stretch; } .summary-filter-title { flex-direction: column; } }
      `}</style>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>;
}
