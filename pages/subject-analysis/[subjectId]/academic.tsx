import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
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
const METRIC_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#7c3aed"];
const SUMMARY_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#2563eb", "#15966a"];
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round1((sorted[middle - 1] + sorted[middle]) / 2);
}
function tierFor(marks: number): Tier {
  const percentage = (marks / 30) * 100;
  if (percentage >= 80) return "Excellent";
  if (percentage >= 60) return "Good";
  if (percentage >= 40) return "Needs Attention";
  return "Critical Risk";
}
function gradeFor(marks: number): Tier { return tierFor(marks); }
function gradeClass(tier: Tier) { return tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk"; }
function Metric({ label, value, detail, color }: { label: string; value: string | number; detail: string; color: string }) {
  return <div className="rounded-2xl border border-[#e6e5e2] bg-white px-5 py-4 shadow-[0_8px_28px_rgba(31,35,49,0.04)]" style={{ borderTop: `3px solid ${color}` }}><div className="text-[11px] font-semibold text-[#6f7890]">{label}</div><div className="mt-1 text-[25px] font-extrabold tracking-[-1px] text-[#17223b]">{value}</div><div className="mt-1 text-[10px] text-[#98a2b3]">{detail}</div></div>;
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
  const subjectCode = data?.subjectCode || "Subject";
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

  const combinedRows = useMemo(() => students.map((student: any, index: number) => ({
    sno: index + 1,
    enrollmentNo: student.enrollmentNo,
    name: student.name,
    first: Number(student.midsem?.first || 0),
    second: Number(student.midsem?.second || 0),
    combined: Number(student.midsem?.combined || 0),
    max: Number(student.midsem?.max || 0)
  })), [students]);
  const summaryRows = useMemo(() => combinedRows.map((row) => {
    const marks = summaryExam === "midsem1" ? row.first : summaryExam === "midsem2" ? row.second : summaryExam === "max" ? row.max : row.combined;
    return { ...row, marks, tier: tierFor(marks), change: round1(row.second - row.first) };
  }).filter((row) => {
    const lower = Number(summaryLower); const upper = Number(summaryUpper);
    return row.marks >= (Number.isFinite(lower) ? lower : 0) && row.marks <= (Number.isFinite(upper) ? upper : 30) && (summaryTier === "all" || row.tier === summaryTier);
  }).sort((a, b) => summarySort === "none" ? a.sno - b.sno : summarySort === "desc" ? b.marks - a.marks : a.marks - b.marks), [combinedRows, summaryExam, summaryTier, summaryLower, summaryUpper, summarySort]);
  const summaryShowRank = summarySort !== "none";
  const summaryAverage = combinedRows.length ? round1(combinedRows.reduce((sum, row) => sum + row.combined, 0) / combinedRows.length) : 0;
  const summaryPassRate = combinedRows.length ? Math.round(combinedRows.filter((row) => row.combined >= 12).length / combinedRows.length * 100) : 0;
  const combinedHighest = combinedRows.length ? Math.max(...combinedRows.map((row) => row.combined)) : 0;
  const combinedHighestNames = combinedRows.filter((row) => row.combined === combinedHighest).map((row) => row.name);
  const midsem1Average = students.length ? round1(students.reduce((sum: number, student: any) => sum + Number(student.midsem?.first || 0), 0) / students.length) : 0;
  const midsem2Average = students.length ? round1(students.reduce((sum: number, student: any) => sum + Number(student.midsem?.second || 0), 0) / students.length) : 0;
  const increases = [...combinedRows].map((row) => ({ ...row, change: round1(row.second - row.first) })).filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const decreases = [...combinedRows].map((row) => ({ ...row, change: round1(row.second - row.first) })).filter((row) => row.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

  function applySummaryFilters() {
    setSummaryExam(summaryExamDraft); setSummaryTier(summaryTierDraft); setSummaryLower(summaryLowerDraft); setSummaryUpper(summaryUpperDraft); setSummarySort(summarySortDraft);
  }
  function resetSummaryFilters() {
    setSummaryExam("combined"); setSummaryTier("all"); setSummaryLower("0"); setSummaryUpper("30"); setSummarySort("none");
    setSummaryExamDraft("combined"); setSummaryTierDraft("all"); setSummaryLowerDraft("0"); setSummaryUpperDraft("30"); setSummarySortDraft("none");
  }

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
        <section className="summary-main-grid"><section className="analysis-panel summary-student-panel"><div className="analysis-panel-head"><div><h3>Filtered Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Showing {summaryRows.length} of {students.length} students</p></div><span className="analysis-count">{summaryRows.length} Students</span></div><div className="analysis-table-wrap summary-table-wrap"><table className="analysis-table"><thead><tr><th>{summaryShowRank ? "Rank" : "S.No."}</th><th>Enrollment No.</th><th>Student</th><th>Marks</th><th>Tier</th></tr></thead><tbody>{summaryRows.map((row, index) => <tr key={row.enrollmentNo}><td>{summaryShowRank ? index + 1 : row.sno}</td><td>{row.enrollmentNo}</td><td>{row.name}</td><td className={`tier-mark ${gradeClass(row.tier)}`}><strong>{row.marks}</strong></td><td><button type="button" className={`analysis-grade-badge ${gradeClass(row.tier)}`} onClick={() => setSummaryTier(summaryTier === row.tier ? "all" : row.tier)}>{row.tier}</button></td></tr>)}{!summaryRows.length && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match these filters.</td></tr>}</tbody></table></div></section><div className="summary-right-column"><section className="analysis-panel summary-rank-panel"><div className="summary-rank-title"><div><h3>Marks Increase (Top 5)</h3><p>Students whose Midsem 2 score improved.</p></div></div>{increases.length ? increases.map((row, i) => <div className="summary-rank-row" key={row.enrollmentNo}><span>{i + 1}.</span><p>{row.name}</p><strong className="change-up">+{row.change}</strong></div>) : <p className="summary-empty">No increases.</p>}</section><section className="analysis-panel summary-rank-panel"><div className="summary-rank-title"><div><h3>Marks Decrease (Top 5)</h3><p>Students whose Midsem 2 score fell.</p></div></div>{decreases.length ? decreases.map((row, i) => <div className="summary-rank-row" key={row.enrollmentNo}><span>{i + 1}.</span><p>{row.name}</p><strong className="change-down">{row.change}</strong></div>) : <p className="summary-empty">No decreases.</p>}</section></div></section>
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
      .summary-apply-button { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 15px; border: 0; border-radius: 9px; background: linear-gradient(135deg, #251b62, #4637a3); color: #fff; font-size: 12px; font-weight: 700; box-shadow: 0 7px 16px rgba(49,39,120,.14); }
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
      .summary-right-column { display: grid; gap: 16px; }
      .summary-rank-panel { padding: 18px; }
      .summary-rank-title h3 { margin: 0; }
      .summary-rank-title p { margin: 5px 0 0; color: #98a2b3; font-size: 11px; }
      .summary-rank-row { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid #f0f1f3; }
      .summary-rank-row:last-child { border-bottom: 0; }
      .summary-rank-row > span { color: #667085; }
      .summary-rank-row p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #344054; }
      .summary-rank-row strong { font-size: 12px; }
      .change-up { color: #15966a; }
      .change-down { color: #ef4444; }
      .summary-empty { color: #98a2b3; font-size: 12px; margin: 10px 0 0; }
      @media (max-width: 1200px) { .summary-main-grid { grid-template-columns: 1fr; } .summary-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .summary-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 800px) { .summary-main-grid { grid-template-columns: 1fr; } .summary-right-column, .summary-metric-grid, .summary-filter-grid { grid-template-columns: 1fr; } .summary-table-wrap { min-height: 480px; max-height: 480px; } }
      @media (max-width: 600px) { .summary-filter-title { flex-direction: column; } }
    `}</style>
  </div>;
}
