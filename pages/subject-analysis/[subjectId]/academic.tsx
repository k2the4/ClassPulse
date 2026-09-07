import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw, Search, Trophy } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ScoreBasis = "midsem1" | "midsem2" | "combined" | "max";
type SortOrder = "none" | "highToLow" | "lowToHigh";
type SummaryExam = "combined" | "midsem1" | "midsem2" | "max";
type SummarySort = "none" | "desc" | "asc";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";

const TIER_COLORS: Record<Tier, string> = { Excellent: "#2563eb", Good: "#15966a", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const TIER_RANGES: Record<Tier, string> = { Excellent: "24–30", Good: "18–23", "Needs Attention": "12–17", "Critical Risk": "0–11" };
const METRIC_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#7c3aed"];
const SUMMARY_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#2563eb", "#15966a"];
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const CHART_TIERS: Tier[] = ["Critical Risk", "Needs Attention", "Good", "Excellent"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round1((sorted[middle - 1] + sorted[middle]) / 2);
}
function tierFor(marks: number): Tier {
  if (marks >= 24) return "Excellent";
  if (marks >= 18) return "Good";
  if (marks >= 12) return "Needs Attention";
  return "Critical Risk";
}
function gradeFor(marks: number): Tier { return tierFor(marks); }
function gradeClass(tier: Tier) { return tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk"; }
function Metric({ label, value, detail, color }: { label: string; value: string | number; detail: string; color: string }) {
  return <div className="summary-kpi-card" style={{ borderTopColor: color }}><div className="summary-kpi-label">{label}</div><div className="summary-kpi-value">{value}</div><div className="summary-kpi-detail">{detail}</div></div>;
}

export default function SubjectAcademicPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [view, setView] = useState<AcademicView>("midsem1");
  const [scoreBasis, setScoreBasis] = useState<ScoreBasis>("combined");
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [summaryExam, setSummaryExam] = useState<SummaryExam>("combined");
  const [summaryTier, setSummaryTier] = useState<Tier | "all">("all");
  const [summaryLower, setSummaryLower] = useState("0");
  const [summaryUpper, setSummaryUpper] = useState("30");
  const [summarySort, setSummarySort] = useState<SummarySort>("none");
  const [summaryExamDraft, setSummaryExamDraft] = useState<SummaryExam>("combined");
  const [summaryTierDraft, setSummaryTierDraft] = useState<Tier | "all">("all");
  const [summaryLowerDraft, setSummaryLowerDraft] = useState("0");
  const [summaryUpperDraft, setSummaryUpperDraft] = useState("30");
  const [summarySortDraft, setSummarySortDraft] = useState<SummarySort>("none");
  const [summarySearch, setSummarySearch] = useState("");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
      setData(json.data); setComputedAt(json.computedAt || ""); setSheetId(json.sheetId || null);
    } catch (e: any) { setError(e.message || "Failed to load academic analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }

  useEffect(() => { loadAnalysis(); }, [subjectId]);
  useEffect(() => { setSelectedTier(null); setSortOrder("none"); }, [view]);

  const students = data?.students || [];
  const baseRows = useMemo(() => students.map((student: any, index: number) => ({ sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, first: Number(student.midsem?.first || 0), second: Number(student.midsem?.second || 0), combined: Number(student.midsem?.combined || 0), max: Number(student.midsem?.max || 0) })), [students]);

  const activeStats = useMemo(() => {
    const rows = baseRows.map((row) => {
      let marks = row.first;
      if (view === "midsem2") marks = row.second;
      if (view === "combined") {
        if (scoreBasis === "midsem1") marks = row.first;
        else if (scoreBasis === "midsem2") marks = row.second;
        else if (scoreBasis === "max") marks = Math.max(row.first, row.second);
        else marks = row.combined;
      }
      return { ...row, marks };
    });
    const marks = rows.map((row) => row.marks);
    const counts = { Excellent: 0, Good: 0, "Needs Attention": 0, "Critical Risk": 0 } as Record<Tier, number>;
    rows.forEach((row) => counts[tierFor(row.marks)]++);
    const highest = marks.length ? Math.max(...marks) : 0;
    return { rows, max: 30, average: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : 0, median: median(marks), highest, highestNames: rows.filter((row) => row.marks === highest).map((row) => row.name), passRate: marks.length ? Math.round(rows.filter((row) => row.marks >= 12).length / marks.length * 100) : 0, counts, sorted: [...rows].sort((a, b) => b.marks - a.marks) };
  }, [baseRows, view, scoreBasis]);

  const filteredRows = selectedTier ? activeStats.rows.filter((row) => tierFor(row.marks) === selectedTier) : activeStats.rows;
  const displayedRows = useMemo(() => { if (sortOrder === "highToLow") return [...filteredRows].sort((a, b) => b.marks - a.marks); if (sortOrder === "lowToHigh") return [...filteredRows].sort((a, b) => a.marks - b.marks); return filteredRows; }, [filteredRows, sortOrder]);
  const showRank = sortOrder !== "none";
  const totalStudents = students.length;
  const activeLabel = view === "midsem1" ? "Midsem 1" : view === "midsem2" ? "Midsem 2" : "Combined";
  const tierEntries = Object.entries(activeStats.counts) as [Tier, number][];
  const highestNames = activeStats.highestNames;

  const combinedRows = useMemo(() => students.map((student: any, index: number) => ({ sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, first: Number(student.midsem?.first || 0), second: Number(student.midsem?.second || 0), combined: Number(student.midsem?.combined || 0), max: Number(student.midsem?.max || 0) })), [students]);
  const summaryRows = useMemo(() => combinedRows.map((row) => {
    const marks = summaryExam === "midsem1" ? row.first : summaryExam === "midsem2" ? row.second : summaryExam === "max" ? row.max : row.combined;
    return { ...row, marks, tier: tierFor(marks) };
  }).filter((row) => {
    const lower = Number(summaryLower); const upper = Number(summaryUpper);
    const q = summarySearch.trim().toLowerCase();
    const matchesSearch = !q || row.name.toLowerCase().includes(q) || String(row.enrollmentNo || "").toLowerCase().includes(q);
    return row.marks >= (Number.isFinite(lower) ? lower : 0) && row.marks <= (Number.isFinite(upper) ? upper : 30) && (summaryTier === "all" || row.tier === summaryTier) && matchesSearch;
  }).sort((a, b) => summarySort === "none" ? a.sno - b.sno : summarySort === "desc" ? b.marks - a.marks : a.marks - b.marks), [combinedRows, summaryExam, summaryTier, summaryLower, summaryUpper, summarySort, summarySearch]);
  const summaryAverage = combinedRows.length ? round1(combinedRows.reduce((sum, row) => sum + row.combined, 0) / combinedRows.length) : 0;
  const summaryPassRate = combinedRows.length ? Math.round(combinedRows.filter((row) => row.combined >= 12).length / combinedRows.length * 100) : 0;
  const combinedHighest = combinedRows.length ? Math.max(...combinedRows.map((row) => row.combined)) : 0;
  const combinedHighestNames = combinedRows.filter((row) => row.combined === combinedHighest).map((row) => row.name);
  const midsem1Average = students.length ? round1(students.reduce((sum: number, student: any) => sum + Number(student.midsem?.first || 0), 0) / students.length) : 0;
  const midsem2Average = students.length ? round1(students.reduce((sum: number, student: any) => sum + Number(student.midsem?.second || 0), 0) / students.length) : 0;
  const summaryChart = CHART_TIERS.map((tier) => ({ tier, count: combinedRows.filter((row) => tierFor(summaryExam === "midsem1" ? row.first : summaryExam === "midsem2" ? row.second : summaryExam === "max" ? row.max : row.combined) === tier).length }));
  const topFive = useMemo(() => [...combinedRows].map((row) => ({ ...row, marks: summaryExam === "midsem1" ? row.first : summaryExam === "midsem2" ? row.second : summaryExam === "max" ? row.max : row.combined })).sort((a, b) => b.marks - a.marks).slice(0, 5), [combinedRows, summaryExam]);

  function applySummaryFilters() { setSummaryExam(summaryExamDraft); setSummaryTier(summaryTierDraft); setSummaryLower(summaryLowerDraft); setSummaryUpper(summaryUpperDraft); setSummarySort(summarySortDraft); }
  function resetSummaryFilters() { setSummaryExam("combined"); setSummaryTier("all"); setSummaryLower("0"); setSummaryUpper("30"); setSummarySort("none"); setSummaryExamDraft("combined"); setSummaryTierDraft("all"); setSummaryLowerDraft("0"); setSummaryUpperDraft("30"); setSummarySortDraft("none"); setSummarySearch(""); }

  if (loading) return <div className="analysis-page"><div className="analysis-loading">Loading academic analysis…</div></div>;
  if (error) return <div className="analysis-page"><div className="analysis-error">{error}</div></div>;

  return <div className="analysis-layout">
    <aside className="analysis-sidebar"><div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div><nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a><a href="/classes"><BookOpen size={18} />Class Analysis</a><a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18} />Subject Analysis</a></nav><div className="analysis-side-footer">ClassPulse Teacher Portal</div></aside>
    <main className="analysis-main">
      <header className="analysis-topbar"><div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><RawDataButton sheetId={sheetId} /><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div></header>
      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
      <div className="analysis-tabs">{(["midsem1", "midsem2", "combined", "summary"] as AcademicView[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "midsem1" ? "Midsem 1" : item === "midsem2" ? "Midsem 2" : item === "combined" ? "Combined" : "Summary"}</button>)}</div>

      {view !== "summary" && <>
        <section className="analysis-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr repeat(4, minmax(0, 1fr))", gap: 14, alignItems: "stretch" }}>
          <div className="analysis-hero-copy" style={{ alignSelf: "center" }}><h2>{activeLabel}</h2><p>{view === "combined" ? "Combined Midsem 1 and Midsem 2 performance for this subject." : "Marks for this subject, class statistics, and performance tiers."}</p></div>
          <Metric color={METRIC_COLORS[0]} label="Class Average" value={`${activeStats.average}/${activeStats.max}`} detail="class average for subject" />
          <Metric color={METRIC_COLORS[1]} label="Class Median" value={`${activeStats.median}/${activeStats.max}`} detail="middle class score" />
          <Metric color={METRIC_COLORS[2]} label="Highest Score" value={activeStats.highest} detail={highestNames.length ? highestNames[0] : "top score"} />
          <Metric color={METRIC_COLORS[3]} label="Pass Rate" value={`${activeStats.passRate}%`} detail="students at or above 40%" />
        </section>
        <section className="analysis-content-grid academic-content-grid">
          <section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><div><h3>Data Sheet</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Pass mark: 40%{selectedTier ? ` · Filtered: ${selectedTier}` : ""}</p></div>{view === "combined" && <div className="flex items-end gap-3"><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Score<select value={scoreBasis} onChange={(e) => setScoreBasis(e.target.value as ScoreBasis)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="combined">Combined</option><option value="max">Max</option></select></label><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Sort<select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="none">No Sort</option><option value="highToLow">High to Low</option><option value="lowToHigh">Low to High</option></select></label></div>}{selectedTier && <button className="analysis-secondary" onClick={() => setSelectedTier(null)}>Clear filter</button>}</div>
            <div className="max-h-[500px] overflow-y-auto overflow-x-hidden"><table className="w-full min-w-0 table-fixed border-collapse text-[11px]" style={{ tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "8%" }} /><col style={{ width: "42%" }} /><col style={{ width: "15%" }} /><col style={{ width: "15%" }} /><col style={{ width: "20%" }} /></colgroup><thead><tr className="border-b border-[#edf0f4] text-left text-[10px] font-bold uppercase tracking-[0.2px] text-[#7b8498]"><th className="sticky left-0 top-0 z-20 bg-white px-2 py-3 text-center">{showRank ? "Rank" : "S.No."}</th><th className="sticky left-[8%] top-0 z-20 bg-white px-3 py-3">Student Name</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Marks</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">%age</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Grade</th></tr></thead><tbody>{displayedRows.map((row, index) => { const pct = Math.round(row.marks / 30 * 100); const grade = gradeFor(row.marks); return <tr key={row.enrollmentNo} className="border-b border-[#f0f1f3] last:border-0"><td className="sticky left-0 z-10 bg-white px-2 py-3 text-center font-semibold text-[#626b80]">{index + 1}</td><td className="sticky left-[8%] z-10 bg-white px-3 py-3 font-semibold text-[#17223b]"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eeebff] text-[9px] font-extrabold text-[#5b4ee6]">{initials(row.name)}</span><span className="truncate">{row.name}</span></div></td><td className="whitespace-nowrap px-2 py-3 text-center text-[#15966a]">{row.marks}</td><td className="whitespace-nowrap px-2 py-3 text-center text-[#626b80]">{pct}%</td><td className="px-2 py-3 text-center"><button onClick={() => setSelectedTier(grade)} className="inline-flex max-w-full whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold" style={{ backgroundColor: `${TIER_COLORS[grade]}18`, color: TIER_COLORS[grade] }}>{grade}</button></td></tr>; })}</tbody></table></div>
          </section>
          <div className="space-y-5"><section className="analysis-panel p-5"><div className="mb-4 flex items-center justify-between"><div><h3>Performance Tier</h3><p className="mt-1 text-[10px] text-[#98a2b3]">Click a tier to filter the data sheet.</p></div><span className="text-[10px] text-[#98a2b3]">{totalStudents} Students</span></div><div className="space-y-2.5">{tierEntries.map(([tier, count]) => <button key={tier} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selectedTier === tier ? "border-[#cfc7ff] bg-[#f6f4ff]" : "border-[#edf0f4] bg-white hover:bg-[#fafaff]"}`}><span className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[tier] }} /><span className="text-[11px] font-semibold text-[#344054]">{tier}</span></span><span className="text-[12px] font-extrabold" style={{ color: TIER_COLORS[tier] }}>{count}</span></button>)}</div><div className="mt-5 h-3 overflow-hidden rounded-full bg-[#f0f1f4]">{tierEntries.map(([tier, count]) => <span key={tier} className="inline-block h-full" style={{ width: `${activeStats.rows.length ? count / activeStats.rows.length * 100 : 0}%`, background: TIER_COLORS[tier] }} />)}</div></section><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Top 5 Highest Scorers</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(0, 5).map((row, index) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#15966a]">{row.marks}</span></div>)}</div></section><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Bottom 5 At-Risk Students</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(-5).reverse().map((row, index) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#ef4444]">{row.marks}</span></div>)}</div></section></div></div>
        </section>
      </>}

      {view === "summary" && <>
        <section className="summary-heading"><div><h2>Academic Summary</h2><p>Compare Midsem 1 and Midsem 2 with the same ClassPulse academic analysis theme.</p></div></section>
        <section className="summary-filter-panel analysis-panel"><div className="summary-filter-title"><div><h3>Filter Criteria</h3><p>Narrow the student list by examination, performance tier, marks range, and order.</p></div><div className="summary-filter-actions"><button className="analysis-secondary" onClick={resetSummaryFilters}>Reset</button><button className="summary-apply-button" onClick={applySummaryFilters}>Apply</button></div></div><div className="summary-filter-grid"><label><span>Exam</span><select value={summaryExamDraft} onChange={(e) => setSummaryExamDraft(e.target.value as SummaryExam)}><option value="combined">Combined</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Max</option></select></label><label><span>Performance Tier</span><select value={summaryTierDraft} onChange={(e) => setSummaryTierDraft(e.target.value as Tier | "all")}><option value="all">All Tiers</option>{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label><label><span>Lower Bound</span><input type="number" min="0" max="30" value={summaryLowerDraft} onChange={(e) => setSummaryLowerDraft(e.target.value)} /></label><label><span>Upper Bound</span><input type="number" min="0" max="30" value={summaryUpperDraft} onChange={(e) => setSummaryUpperDraft(e.target.value)} /></label><label><span>Sort</span><select value={summarySortDraft} onChange={(e) => setSummarySortDraft(e.target.value as SummarySort)}><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></label></div></section>
        <section className="summary-metric-grid"><Metric color={SUMMARY_COLORS[0]} label="Overall Class Average" value={summaryAverage} detail="combined average" /><Metric color={SUMMARY_COLORS[1]} label="Highest Combined Score" value={combinedHighest} detail={combinedHighestNames[0] || "—"} /><Metric color={SUMMARY_COLORS[2]} label="Overall Pass Rate" value={`${summaryPassRate}%`} detail="students scoring 12 or more" /><Metric color={SUMMARY_COLORS[3]} label="Midsem 1 Average" value={midsem1Average} detail="out of 30 marks" /><Metric color={SUMMARY_COLORS[4]} label="Midsem 2 Average" value={midsem2Average} detail="out of 30 marks" /></section>
        <section className="summary-main-grid">
          <section className="analysis-panel summary-student-panel"><div className="analysis-panel-head"><div><h3>Filtered Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Showing {summaryRows.length} of {students.length} students</p></div><div className="summary-table-tools"><div className="summary-search"><Search size={14} /><input value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} placeholder="Search student..." /></div><span className="analysis-count">{summaryRows.length} Students</span></div></div><div className="analysis-table-wrap summary-table-wrap"><table className="analysis-table summary-student-table"><colgroup><col style={{ width: "9%" }} /><col style={{ width: "22%" }} /><col style={{ width: "29%" }} /><col style={{ width: "20%" }} /><col style={{ width: "20%" }} /></colgroup><thead><tr><th>S.No.</th><th>Enrollment No.</th><th>Student</th><th className="center-cell">Marks ({summaryExam === "combined" ? "Combined" : summaryExam === "midsem1" ? "Midsem 1" : summaryExam === "midsem2" ? "Midsem 2" : "Max"})</th><th className="center-cell">Tier</th></tr></thead><tbody>{summaryRows.map((row) => <tr key={row.enrollmentNo}><td className="center-cell">{row.sno}</td><td>{row.enrollmentNo}</td><td>{row.name}</td><td className={`center-cell summary-mark ${gradeClass(row.tier)}`}>{row.marks}</td><td className="center-cell"><button type="button" className={`analysis-grade-badge ${gradeClass(row.tier)}`} onClick={() => setSummaryTier(summaryTier === row.tier ? "all" : row.tier)}>{row.tier}</button></td></tr>)}{!summaryRows.length && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match these filters.</td></tr>}</tbody></table></div></section>
          <div className="summary-right-column">
            <section className="analysis-panel summary-chart-panel"><div className="summary-side-heading"><div><h3>Performance Tier Distribution</h3><p>Click a column to filter students by marks range.</p></div><span>{students.length} Students</span></div><div className="summary-chart"><div className="summary-chart-y"><span>{Math.max(...summaryChart.map((x) => x.count), 1)}</span><span>{Math.ceil(Math.max(...summaryChart.map((x) => x.count), 1) * .66)}</span><span>{Math.ceil(Math.max(...summaryChart.map((x) => x.count), 1) * .33)}</span><span>0</span></div><div className="summary-chart-plot">{summaryChart.map(({ tier, count }) => { const maxCount = Math.max(...summaryChart.map((x) => x.count), 1); const active = summaryTier === tier; return <button type="button" key={tier} className={`summary-bar-column ${active ? "active" : ""}`} onClick={() => setSummaryTier(active ? "all" : tier)} title={`${tier}: ${count} students`}><span className="summary-bar-value">{count}</span><span className="summary-bar" style={{ height: `${Math.max(8, count / maxCount * 100)}%`, background: TIER_COLORS[tier] }} /><span className="summary-bar-range">{TIER_RANGES[tier]}</span><span className="summary-bar-label" style={{ color: TIER_COLORS[tier] }}>{tier}</span></button>; })}</div></div></section>
            <section className="analysis-panel summary-top-five-panel"><div className="summary-side-heading"><div><h3>Top 5 Students</h3><p>Highest {summaryExam === "combined" ? "combined" : summaryExam === "midsem1" ? "Midsem 1" : summaryExam === "midsem2" ? "Midsem 2" : "maximum"} marks.</p></div><Trophy size={18} color="#f59e0b" /></div><div className="top-five-table"><div className="top-five-head"><span>Rank</span><span>Student</span><span>Marks</span></div>{topFive.map((row, index) => <div className="top-five-row" key={row.enrollmentNo}><span>{index + 1}</span><span><i>{initials(row.name)}</i>{row.name}</span><strong>{row.marks}</strong></div>)}</div></section>
          </div>
        </section>
        <div className="summary-legend"><strong>Marks are out of 30.</strong><span>Tier classification is based on marks range.</span>{CHART_TIERS.slice().reverse().map((tier) => <span key={tier}><i style={{ background: TIER_COLORS[tier] }} />{tier} ({TIER_RANGES[tier]})</span>)}</div>
      </>}
    </main>
    <style jsx global>{`
      .summary-heading { margin: 4px 0 18px; }
      .summary-heading h2 { margin: 0; font-size: 22px; }
      .summary-heading p { margin: 6px 0 0; color: #667085; font-size: 13px; }
      .summary-filter-panel { padding: 18px; margin-bottom: 16px; }
      .summary-filter-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
      .summary-filter-title h3 { margin: 0; }
      .summary-filter-title p { margin: 5px 0 0; color: #98a2b3; font-size: 11px; }
      .summary-filter-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .summary-apply-button { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 15px; border: 0; border-radius: 9px; background: linear-gradient(135deg, #251b62, #4637a3); color: #fff; font-size: 12px; font-weight: 700; box-shadow: 0 7px 16px rgba(49,39,120,.14); cursor: pointer; }
      .summary-filter-grid { display: grid; grid-template-columns: 1.1fr 1.1fr .8fr .8fr 1fr; gap: 12px; }
      .summary-filter-grid label { display: block; }
      .summary-filter-grid label > span { display: block; margin: 0 0 7px; color: #667085; font-size: 11px; font-weight: 600; }
      .summary-filter-grid select, .summary-filter-grid input { width: 100%; height: 40px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; box-sizing: border-box; }
      .summary-filter-grid select:focus, .summary-filter-grid input:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
      .summary-metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .summary-kpi-card { height: 92px; box-sizing: border-box; border: 1px solid #e6e5e2; border-top: 3px solid; border-radius: 15px; background: #fff; padding: 12px 16px 10px; box-shadow: 0 8px 28px rgba(31,35,49,.04); }
      .summary-kpi-label { color: #6f7890; font-size: 10px; font-weight: 600; }
      .summary-kpi-value { margin-top: 2px; color: #17223b; font-size: 23px; line-height: 1.1; font-weight: 800; letter-spacing: -0.7px; }
      .summary-kpi-detail { margin-top: 3px; color: #98a2b3; font-size: 9px; }
      .summary-main-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(380px, .9fr); gap: 16px; align-items: start; }
      .summary-student-panel { min-width: 0; }
      .summary-table-tools { display: flex; align-items: center; gap: 10px; }
      .summary-search { width: 190px; height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid #e1e4ea; border-radius: 9px; background: #fff; color: #98a2b3; }
      .summary-search input { width: 100%; border: 0; outline: 0; font-size: 11px; color: #344054; background: transparent; }
      .summary-table-wrap { height: 565px; max-height: 565px; overflow-y: auto; overflow-x: hidden; }
      .summary-student-table { table-layout: fixed; width: 100%; }
      .summary-student-table th, .summary-student-table td { text-align: left; }
      .summary-student-table .center-cell { text-align: center; }
      .summary-student-table td.summary-mark { font-weight: 800; }
      .summary-student-table td.summary-mark.excellent { color: #2563eb; }
      .summary-student-table td.summary-mark.good { color: #15966a; }
      .summary-student-table td.summary-mark.attention { color: #f59e0b; }
      .summary-student-table td.summary-mark.risk { color: #ef4444; }
      .summary-right-column { display: grid; gap: 16px; }
      .summary-chart-panel { padding: 18px; }
      .summary-side-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .summary-side-heading h3 { margin: 0; }
      .summary-side-heading p { margin: 5px 0 0; color: #98a2b3; font-size: 10px; }
      .summary-side-heading > span { color: #98a2b3; font-size: 10px; white-space: nowrap; }
      .summary-chart { height: 285px; display: grid; grid-template-columns: 28px 1fr; margin-top: 10px; }
      .summary-chart-y { display: flex; flex-direction: column; justify-content: space-between; padding: 4px 5px 38px 0; color: #98a2b3; font-size: 9px; text-align: right; }
      .summary-chart-plot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; align-items: stretch; border-bottom: 1px solid #dfe3ea; position: relative; }
      .summary-chart-plot:before, .summary-chart-plot:after { content: ""; position: absolute; left: 0; right: 0; border-top: 1px dashed #edf0f4; pointer-events: none; }
      .summary-chart-plot:before { top: 33%; } .summary-chart-plot:after { top: 66%; }
      .summary-bar-column { position: relative; min-width: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; border: 0; background: transparent; padding: 0 4px 8px; cursor: pointer; z-index: 1; }
      .summary-bar-column:hover .summary-bar, .summary-bar-column.active .summary-bar { filter: brightness(.92); box-shadow: 0 0 0 3px rgba(91,78,230,.10); }
      .summary-bar-value { height: 22px; color: #344054; font-size: 10px; font-weight: 800; }
      .summary-bar { width: min(48px, 68%); min-height: 8px; border-radius: 7px 7px 2px 2px; transition: height .18s ease, filter .18s ease; }
      .summary-bar-range { margin-top: 7px; color: #667085; font-size: 9px; font-weight: 700; }
      .summary-bar-label { margin-top: 4px; font-size: 9px; font-weight: 700; white-space: nowrap; }
      .summary-top-five-panel { padding: 18px; }
      .top-five-table { margin-top: 12px; border: 1px solid #edf0f4; border-radius: 10px; overflow: hidden; }
      .top-five-head, .top-five-row { display: grid; grid-template-columns: 46px minmax(0, 1fr) 70px; align-items: center; }
      .top-five-head { min-height: 30px; padding: 0 10px; background: #fafbfc; color: #7b8498; font-size: 9px; font-weight: 800; text-transform: uppercase; }
      .top-five-row { min-height: 42px; padding: 0 10px; border-top: 1px solid #f0f1f3; color: #344054; font-size: 10px; }
      .top-five-row > span:first-child { color: #7b8498; font-weight: 700; }
      .top-five-row > span:nth-child(2) { display: flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .top-five-row i { display: grid; place-items: center; width: 25px; height: 25px; flex: 0 0 25px; border-radius: 50%; background: #eeebff; color: #5b4ee6; font-size: 8px; font-style: normal; font-weight: 800; }
      .top-five-row strong { text-align: center; color: #15966a; font-size: 11px; }
      .summary-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 16px; padding: 12px 16px; border: 1px solid #e7e4fa; border-radius: 12px; background: linear-gradient(90deg, #fff, #fbfaff); color: #667085; font-size: 10px; }
      .summary-legend strong { color: #344054; }
      .summary-legend span { display: inline-flex; align-items: center; gap: 5px; }
      .summary-legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
      @media (max-width: 1200px) { .summary-main-grid { grid-template-columns: 1fr; } .summary-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .summary-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 800px) { .summary-main-grid { grid-template-columns: 1fr; } .summary-right-column, .summary-metric-grid, .summary-filter-grid { grid-template-columns: 1fr; } .summary-table-wrap { height: 480px; max-height: 480px; } .summary-table-tools { flex-direction: column; align-items: flex-end; } }
      @media (max-width: 600px) { .summary-filter-title { flex-direction: column; } .summary-search { width: 100%; } }
    `}</style>
  </div>;
}
