import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type AcademicView = "midsem1" | "midsem2" | "combined";
type ScoreBasis = "midsem1" | "midsem2" | "combined" | "max";
type SortOrder = "none" | "highToLow" | "lowToHigh";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";

const TIER_COLORS: Record<Tier, string> = { Excellent: "#2563eb", Good: "#15966a", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const METRIC_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#7c3aed"];
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

  if (loading) return <div className="analysis-page"><div className="analysis-loading">Loading academic analysis…</div></div>;
  if (error) return <div className="analysis-page"><div className="analysis-error">{error}</div></div>;

  return <div className="analysis-layout">
    <aside className="analysis-sidebar"><div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div><nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a><a href="/classes"><BookOpen size={18} />Class Analysis</a><a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18} />Subject Analysis</a></nav><div className="analysis-side-footer">ClassPulse Teacher Portal</div></aside>
    <main className="analysis-main">
      <header className="analysis-topbar"><div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><RawDataButton sheetId={sheetId} /><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div></header>
      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
      <div className="analysis-tabs">{(["midsem1", "midsem2", "combined"] as AcademicView[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "midsem1" ? "Midsem 1" : item === "midsem2" ? "Midsem 2" : "Combined"}</button>)}</div>
      <section className="analysis-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr repeat(4, minmax(0, 1fr))", gap: 14, alignItems: "stretch" }}>
        <div className="analysis-hero-copy" style={{ alignSelf: "center" }}><h2>{activeLabel}</h2><p>{view === "combined" ? "Combined Midsem 1 and Midsem 2 performance for this subject." : "Marks for this subject, class statistics, and performance tiers."}</p></div>
        <Metric color={METRIC_COLORS[0]} label="Class Average" value={`${activeStats.average}/${activeStats.max}`} detail="class average for subject" />
        <Metric color={METRIC_COLORS[1]} label="Class Median" value={`${activeStats.median}/${activeStats.max}`} detail="middle class score" />
        <Metric color={METRIC_COLORS[2]} label="Highest Score" value={activeStats.highest} detail={highestNames.length ? highestNames[0] : "top score"} />
        <Metric color={METRIC_COLORS[3]} label="Pass Rate" value={`${activeStats.passRate}%`} detail="students at or above 40%" />
      </section>
      <section className="analysis-content-grid academic-content-grid">
        <section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><div><h3>Data Sheet</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Pass mark: 40%{selectedTier ? ` · Filtered: ${selectedTier}` : ""}</p></div>{view === "combined" && <div className="flex items-end gap-3"><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Score<select value={scoreBasis} onChange={(e) => setScoreBasis(e.target.value as ScoreBasis)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="combined">Combined</option><option value="max">Max</option></select></label><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Sort<select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="none">No Sort</option><option value="highToLow">High to Low</option><option value="lowToHigh">Low to High</option></select></label></div>}{selectedTier && <button className="analysis-secondary" onClick={() => setSelectedTier(null)}>Clear filter</button>}</div>
          <div className="max-h-[500px] overflow-y-auto overflow-x-hidden"><table className="w-full min-w-0 table-fixed border-collapse text-[11px]" style={{ tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "6%" }} /><col style={{ width: "20%" }} /><col style={{ width: "39%" }} /><col style={{ width: "9%" }} /><col style={{ width: "8%" }} /><col style={{ width: "18%" }} /></colgroup><thead><tr className="border-b border-[#edf0f4] text-left text-[10px] font-bold uppercase tracking-[0.2px] text-[#7b8498]"><th className="sticky left-0 top-0 z-20 bg-white px-2 py-3 text-center">{showRank ? "Rank" : "S.No."}</th><th className="sticky left-[6%] top-0 z-20 bg-white px-3 py-3">Student Name</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">{subjectCode}</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Total</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">%age</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Grade</th></tr></thead><tbody>{displayedRows.map((row, index) => { const pct = Math.round(row.marks / 30 * 100); const grade = gradeFor(row.marks); return <tr key={row.enrollmentNo} className="border-b border-[#f0f1f3] last:border-0"><td className="sticky left-0 z-10 bg-white px-2 py-3 text-center font-semibold text-[#626b80]">{index + 1}</td><td className="sticky left-[6%] z-10 bg-white px-3 py-3 font-semibold text-[#17223b]"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eeebff] text-[9px] font-extrabold text-[#5b4ee6]">{initials(row.name)}</span><span className="truncate">{row.name}</span></div></td><td className="whitespace-nowrap px-2 py-3 text-center text-[#15966a]">{row.marks}</td><td className="whitespace-nowrap px-2 py-3 text-center font-bold text-[#17223b]">{row.marks}</td><td className="whitespace-nowrap px-2 py-3 text-center text-[#626b80]">{pct}%</td><td className="px-2 py-3 text-center"><button onClick={() => setSelectedTier(grade)} className="inline-flex max-w-full whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold" style={{ backgroundColor: `${TIER_COLORS[grade]}18`, color: TIER_COLORS[grade] }}>{grade}</button></td></tr>; })}</tbody></table></div>
        </section>
        <div className="space-y-5"><section className="analysis-panel p-5"><div className="mb-4 flex items-center justify-between"><div><h3>Performance Tier</h3><p className="mt-1 text-[10px] text-[#98a2b3]">Click a tier to filter the data sheet.</p></div><span className="text-[10px] text-[#98a2b3]">{totalStudents} Students</span></div><div className="space-y-2.5">{tierEntries.map(([tier, count]) => <button key={tier} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selectedTier === tier ? "border-[#cfc7ff] bg-[#f6f4ff]" : "border-[#edf0f4] bg-white hover:bg-[#fafaff]"}`}><span className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[tier] }} /><span className="text-[11px] font-semibold text-[#344054]">{tier}</span></span><span className="text-[12px] font-extrabold" style={{ color: TIER_COLORS[tier] }}>{count}</span></button>)}</div><div className="mt-5 h-3 overflow-hidden rounded-full bg-[#f0f1f4]">{tierEntries.map(([tier, count]) => <span key={tier} className="inline-block h-full" style={{ width: `${activeStats.rows.length ? count / activeStats.rows.length * 100 : 0}%`, background: TIER_COLORS[tier] }} />)}</div></section><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Top 5 Highest Scorers</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(0, 5).map((row, index) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#15966a]">{row.marks}</span></div>)}</div></section><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Bottom 5 At-Risk Students</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(-5).reverse().map((row, index) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#ef4444]">{row.marks}</span></div>)}</div></section></div></div>
      </section>
    </main>
  </div>;
}
