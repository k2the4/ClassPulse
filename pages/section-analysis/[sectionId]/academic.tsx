import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SectionAnalysis } from "../../../lib/analysisClass";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ScoreBasis = "midsem1" | "midsem2" | "combined" | "max";
type SortOrder = "none" | "highToLow" | "lowToHigh";
type SummaryExam = "combined" | "midsem1" | "midsem2" | "max";
type SummarySort = "none" | "desc" | "asc";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";

const TIER_COLORS: Record<Tier, string> = { Excellent: "#2563eb", Good: "#15966a", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const METRIC_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#7c3aed"];
const SUMMARY_COLORS = ["#2563eb", "#15966a", "#f59e0b", "#2563eb", "#15966a"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function median(values: number[]) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : round1((sorted[middle - 1] + sorted[middle]) / 2); }
function tierFor(marks: number, max: number): Tier { if (max <= 0) return "Critical Risk"; const percentage = (marks / max) * 100; if (percentage >= 80) return "Excellent"; if (percentage >= 60) return "Good"; if (percentage >= 40) return "Needs Attention"; return "Critical Risk"; }
function gradeFor(marks: number, max: number): Tier { return tierFor(marks, max); }

function summarySubjectRows(student: any) {
  const map = new Map<string, { code: string; first: number | null; second: number | null; max: number }>();
  (student.examMarks?.midsem1Subjects || []).forEach((s: any) => map.set(s.code, { code: s.code, first: s.marks ?? null, second: null, max: s.max || 30 }));
  (student.examMarks?.midsem2Subjects || []).forEach((s: any) => {
    const existing = map.get(s.code);
    if (existing) existing.second = s.marks ?? null;
    else map.set(s.code, { code: s.code, first: null, second: s.marks ?? null, max: s.max || 30 });
  });
  return Array.from(map.values()).map((s) => ({ ...s, combined: s.first != null && s.second != null ? round1((s.first + s.second) / 2) : s.first ?? s.second }));
}
function summarySubjectValue(subject: any, exam: SummaryExam) {
  if (exam === "midsem1") return subject.first;
  if (exam === "midsem2") return subject.second;
  if (exam === "max") return subject.first == null ? subject.second : subject.second == null ? subject.first : Math.max(subject.first, subject.second);
  return subject.combined;
}

function Metric({ label, value, detail, color }: { label: string; value: string | number; detail: string; color: string }) {
  return <div className="rounded-2xl border border-[#e6e5e2] bg-white px-5 py-4 shadow-[0_8px_28px_rgba(31,35,49,0.04)]" style={{ borderTop: `3px solid ${color}` }}>
    <div className="text-[11px] font-semibold text-[#6f7890]">{label}</div>
    <div className="mt-1 text-[25px] font-extrabold tracking-[-1px] text-[#17223b]">{value}</div>
    <div className="mt-1 text-[10px] text-[#98a2b3]">{detail}</div>
  </div>;
}

export default function AcademicPage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const [view, setView] = useState<AcademicView>("midsem1");
  const [scoreBasis, setScoreBasis] = useState<ScoreBasis>("combined");
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");
  const [data, setData] = useState<SectionAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [summaryExam, setSummaryExam] = useState<SummaryExam>("combined");
  const [summaryTier, setSummaryTier] = useState<Tier | "all">("all");
  const [summaryLower, setSummaryLower] = useState("0");
  const [summaryUpper, setSummaryUpper] = useState("12");
  const [summarySort, setSummarySort] = useState<SummarySort>("none");
  const [summaryExamDraft, setSummaryExamDraft] = useState<SummaryExam>("combined");
  const [summaryTierDraft, setSummaryTierDraft] = useState<Tier | "all">("all");
  const [summaryLowerDraft, setSummaryLowerDraft] = useState("0");
  const [summaryUpperDraft, setSummaryUpperDraft] = useState("12");
  const [summarySortDraft, setSummarySortDraft] = useState<SummarySort>("none");

  async function loadAnalysis(sync = false) {
    if (!sectionId || typeof sectionId !== "string") return;
    sync ? setSyncing(true) : setLoading(true); setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
      setData(json.data); setComputedAt(json.computedAt || ""); setSheetId(json.sheetId || null);
    } catch (e: any) { setError(e.message || "Failed to load academic analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }

  useEffect(() => { loadAnalysis(); }, [sectionId]);
  useEffect(() => { setSelectedTier(null); setSortOrder("none"); }, [view]);
  const students = data?.students || [];

  const activeStats = useMemo(() => {
    const rows = students.map((student: any, index: number) => {
      if (view === "combined") {
        const combinedMarks = student.examMarks?.combined ?? null;
        const combinedMax = Math.max(student.examMarks?.midsem1Max || 0, student.examMarks?.midsem2Max || 0);
        const midsem1Subjects = student.examMarks?.midsem1Subjects || [];
        const midsem2Subjects = student.examMarks?.midsem2Subjects || [];
        const subjectMap = new Map<string, { code: string; marks: number | null; max: number; pass: boolean }>();
        [...midsem1Subjects, ...midsem2Subjects].forEach((subject: any) => {
          const existing = subjectMap.get(subject.code);
          if (!existing) { subjectMap.set(subject.code, { code: subject.code, marks: subject.marks ?? null, max: subject.max || 0, pass: subject.pass !== false }); return; }
          const values = [existing.marks, subject.marks].filter((value): value is number => value !== null && value !== undefined);
          const subjectCombined = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
          subjectMap.set(subject.code, { code: subject.code, marks: subjectCombined, max: Math.max(existing.max || 0, subject.max || 0), pass: subjectCombined === null ? true : subjectCombined >= Math.max(existing.max || 0, subject.max || 0) * 0.4 });
        });
        let marks = combinedMarks; let max = combinedMax;
        if (scoreBasis === "midsem1") { marks = student.examMarks?.midsem1 ?? null; max = student.examMarks?.midsem1Max || 0; }
        else if (scoreBasis === "midsem2") { marks = student.examMarks?.midsem2 ?? null; max = student.examMarks?.midsem2Max || 0; }
        else if (scoreBasis === "max") {
          const midsem1 = student.examMarks?.midsem1; const midsem2 = student.examMarks?.midsem2;
          const available = [midsem1, midsem2].filter((value: any): value is number => value !== null && value !== undefined);
          marks = available.length ? Math.max(...available) : null; max = Math.max(student.examMarks?.midsem1Max || 0, student.examMarks?.midsem2Max || 0);
        }
        return { sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, marks, max, subjects: Array.from(subjectMap.values()) };
      }
      const exam = view === "midsem1" ? "midsem1" : "midsem2";
      const marks = student.examMarks?.[exam] ?? null;
      const max = student.examMarks?.[`${exam}Max`] || 0;
      const subjects = student.examMarks?.[`${exam}Subjects`] || [];
      return { sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, marks, max, subjects };
    }).filter((row: any) => row.marks !== null);
    const marks = rows.map((row: any) => Number(row.marks));
    const max = rows[0]?.max || 0;
    const counts = { Excellent: 0, Good: 0, "Needs Attention": 0, "Critical Risk": 0 } as Record<Tier, number>;
    rows.forEach((row: any) => counts[tierFor(Number(row.marks), Number(row.max) || max)]++);
    const subjectCodes = Array.from(new Set(rows.flatMap((row: any) => (row.subjects || []).map((subject: any) => subject.code))));
    return { rows, max, subjectCodes, average: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : 0, median: median(marks), highest: marks.length ? Math.max(...marks) : 0, passRate: marks.length ? Math.round(rows.filter((row: any) => Number(row.marks) >= (Number(row.max) || max) * 0.4).length / marks.length * 100) : 0, counts, sorted: [...rows].sort((a: any, b: any) => Number(b.marks) - Number(a.marks)) };
  }, [students, view, scoreBasis]);

  const filteredRows = selectedTier ? activeStats.rows.filter((row: any) => tierFor(Number(row.marks), Number(row.max) || activeStats.max) === selectedTier) : activeStats.rows;
  const displayedRows = useMemo(() => { if (sortOrder === "highToLow") return [...filteredRows].sort((a: any, b: any) => Number(b.marks) - Number(a.marks)); if (sortOrder === "lowToHigh") return [...filteredRows].sort((a: any, b: any) => Number(a.marks) - Number(b.marks)); return filteredRows; }, [filteredRows, sortOrder]);
  const showRank = sortOrder !== "none";
  const totalStudents = students.length;
  const activeLabel = view === "midsem1" ? "Midsem 1" : view === "midsem2" ? "Midsem 2" : "Combined";
  const tierEntries = Object.entries(activeStats.counts) as [Tier, number][];
  const highestNames = activeStats.rows.filter((row: any) => Number(row.marks) === activeStats.highest).map((row: any) => row.name);

  const summaryRows = useMemo(() => students.map((student: any, index: number) => {
    const subjects = summarySubjectRows(student);
    const values = subjects.map((subject) => ({ ...subject, value: summarySubjectValue(subject, summaryExam) }));
    const total = values.reduce((sum, subject) => sum + (subject.value ?? 0), 0);
    const rowValue = summaryExam === "midsem1" ? (student.examMarks?.midsem1 ?? 0) : summaryExam === "midsem2" ? (student.examMarks?.midsem2 ?? 0) : summaryExam === "max" ? (student.examMarks?.max ?? 0) : (student.examMarks?.combined ?? 0);
    const rowMax = summaryExam === "midsem1" ? (student.examMarks?.midsem1Max || 0) : summaryExam === "midsem2" ? (student.examMarks?.midsem2Max || 0) : summaryExam === "max" ? Math.max(student.examMarks?.midsem1Max || 0, student.examMarks?.midsem2Max || 0) : Math.max(student.examMarks?.midsem1Max || 0, student.examMarks?.midsem2Max || 0);
    const lower = Number(summaryLower); const upper = Number(summaryUpper);
    const matchesRange = values.some((subject) => subject.value != null && subject.value >= (Number.isFinite(lower) ? lower : 0) && subject.value <= (Number.isFinite(upper) ? upper : 30));
    return { sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, subjects: values, total, rowValue, rowMax, tier: tierFor(rowValue, rowMax), matchesRange };
  }), [students, summaryExam, summaryLower, summaryUpper]);
  const summarySubjectCodes = useMemo(() => Array.from(new Set(summaryRows.flatMap((row) => row.subjects.map((subject: any) => subject.code)))), [summaryRows]);
  const filteredSummaryRows = useMemo(() => [...summaryRows].filter((row) => row.matchesRange && (summaryTier === "all" || row.tier === summaryTier)).sort((a, b) => summarySort === "none" ? a.sno - b.sno : summarySort === "desc" ? b.rowValue - a.rowValue : a.rowValue - b.rowValue), [summaryRows, summaryTier, summarySort]);
  const summaryShowRank = summarySort !== "none";
  const combinedValues = students.map((student: any) => Number(student.examMarks?.combined || 0));
  const midsem1Values = students.map((student: any) => Number(student.examMarks?.midsem1 || 0));
  const midsem2Values = students.map((student: any) => Number(student.examMarks?.midsem2 || 0));
  const overallClassAverage = combinedValues.length ? round1(combinedValues.reduce((a, b) => a + b, 0) / combinedValues.length) : 0;
  const midsem1Average = midsem1Values.length ? round1(midsem1Values.reduce((a, b) => a + b, 0) / midsem1Values.length) : 0;
  const midsem2Average = midsem2Values.length ? round1(midsem2Values.reduce((a, b) => a + b, 0) / midsem2Values.length) : 0;
  const highestCombined = combinedValues.length ? Math.max(...combinedValues) : 0;
  const highestCombinedNames = students.filter((student: any) => Number(student.examMarks?.combined || 0) === highestCombined).map((student: any) => student.name);
  const overallPassRate = students.length ? Math.round(students.filter((student: any) => Number(student.examMarks?.combined || 0) >= (Math.max(student.examMarks?.midsem1Max || 0, student.examMarks?.midsem2Max || 0) || 1) * 0.4).length / students.length * 100) : 0;
  const increases = students.map((student: any) => ({ name: student.name, change: round1(Number(student.examMarks?.midsem2 || 0) - Number(student.examMarks?.midsem1 || 0)) })).filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const decreases = students.map((student: any) => ({ name: student.name, change: round1(Number(student.examMarks?.midsem2 || 0) - Number(student.examMarks?.midsem1 || 0)) })).filter((row) => row.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

  function applySummaryFilters() {
    setSummaryExam(summaryExamDraft); setSummaryTier(summaryTierDraft); setSummaryLower(summaryLowerDraft); setSummaryUpper(summaryUpperDraft); setSummarySort(summarySortDraft);
  }

  function resetSummaryFilters() {
    setSummaryExam("combined"); setSummaryTier("all"); setSummaryLower("0"); setSummaryUpper("12"); setSummarySort("none");
    setSummaryExamDraft("combined"); setSummaryTierDraft("all"); setSummaryLowerDraft("0"); setSummaryUpperDraft("12"); setSummarySortDraft("none");
  }

  return <div className="analysis-layout min-h-screen bg-[#fffdf8] text-[#17223b]">
    <aside className="analysis-sidebar"><div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div><nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a><a className="is-active" href={typeof sectionId === "string" ? `/class-analysis/${sectionId}` : "#"}><BookOpen size={18} />Class Analysis</a><a href="/subject-analysis"><GraduationCap size={18} />Subject Analysis</a></nav><RawDataButton sheetId={sheetId} /><div className="analysis-side-footer">ClassPulse Teacher Portal</div></aside>
    <main className="analysis-page">
      <header className="analysis-topbar"><div className="analysis-title-row"><h1>Class / Section Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div></header>
      {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}
      <div className="analysis-view-switch"><button className={view === "midsem1" ? "is-active" : ""} onClick={() => setView("midsem1")}>Midsem 1</button><button className={view === "midsem2" ? "is-active" : ""} onClick={() => setView("midsem2")}>Midsem 2</button><button className={view === "combined" ? "is-active" : ""} onClick={() => setView("combined")}>Combined</button><button className={view === "summary" ? "is-active" : ""} onClick={() => setView("summary")}>Summary</button></div>
      {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
      {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading academic analysis...</div>}
      {data && view !== "summary" && <>
        <section className="analysis-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr repeat(4, minmax(0, 1fr))", gap: 14, alignItems: "stretch" }}>
          <div className="analysis-hero-copy" style={{ alignSelf: "center" }}><h2>{activeLabel}</h2><p>{view === "combined" ? "Combined Midsem 1 and Midsem 2 performance across all subjects." : "Marks across all subjects, class statistics, and performance tiers."}</p></div>
          <Metric color={METRIC_COLORS[0]} label="Class Average" value={`${activeStats.average}/${activeStats.max || 0}`} detail="class average across subjects" />
          <Metric color={METRIC_COLORS[1]} label="Class Median" value={`${activeStats.median}/${activeStats.max || 0}`} detail="middle class score" />
          <Metric color={METRIC_COLORS[2]} label="Highest Score" value={activeStats.highest} detail={highestNames.length ? highestNames[0] : "top score"} />
          <Metric color={METRIC_COLORS[3]} label="Pass Rate" value={`${activeStats.passRate}%`} detail="students at or above 40%" />
        </section>
        <section className="analysis-content-grid academic-content-grid">
          <section className="analysis-panel analysis-table-panel"><div className="analysis-panel-head"><div><h3>Data Sheet</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Pass mark: 40%{selectedTier ? ` · Filtered: ${selectedTier}` : ""}</p></div>{view === "combined" && <div className="flex items-end gap-3"><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Score<select value={scoreBasis} onChange={(e) => setScoreBasis(e.target.value as ScoreBasis)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="combined">Combined</option><option value="max">Max</option></select></label><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.2px] text-[#7b8498]">Sort<select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="h-9 min-w-[125px] rounded-xl border border-[#e1e4ea] bg-white px-3 text-[11px] font-semibold normal-case tracking-normal text-[#344054] outline-none focus:border-[#5b4ee6]"><option value="none">No Sort</option><option value="highToLow">High to Low</option><option value="lowToHigh">Low to High</option></select></label></div>}{selectedTier && <button className="analysis-secondary" onClick={() => setSelectedTier(null)}>Clear filter</button>}</div><div className="max-h-[500px] overflow-y-auto overflow-x-hidden"><table className="w-full min-w-0 table-fixed border-collapse text-[11px]" style={{ tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "6%" }} /><col style={{ width: "20%" }} />{activeStats.subjectCodes.map((code: string) => <col key={code} style={{ width: `${activeStats.subjectCodes.length ? 39 / activeStats.subjectCodes.length : 6.5}%` }} />)}<col style={{ width: "9%" }} /><col style={{ width: "8%" }} /><col style={{ width: "18%" }} /></colgroup><thead><tr className="border-b border-[#edf0f4] text-left text-[10px] font-bold uppercase tracking-[0.2px] text-[#7b8498]"><th className="sticky left-0 top-0 z-20 bg-white px-2 py-3 text-center">{showRank ? "Rank" : "S.No."}</th><th className="sticky left-[6%] top-0 z-20 bg-white px-3 py-3">Student Name</th>{activeStats.subjectCodes.map((code: string) => <th key={code} className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">{code}</th>)}<th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Total</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">%age</th><th className="sticky top-0 z-10 whitespace-nowrap bg-white px-2 py-3 text-center">Grade</th></tr></thead><tbody>{displayedRows.map((row: any, index: number) => { const rowMax = Number(row.max) || activeStats.max; const pct = rowMax > 0 ? Math.round(Number(row.marks) / rowMax * 100) : 0; const tier = tierFor(Number(row.marks), rowMax); const grade = gradeFor(Number(row.marks), rowMax); return <tr key={row.enrollmentNo} className="border-b border-[#f0f1f3] last:border-0"><td className="sticky left-0 z-10 bg-white px-2 py-3 text-center font-semibold text-[#626b80]">{showRank ? index + 1 : row.sno}</td><td className="sticky left-[6%] z-10 bg-white px-3 py-3 font-semibold text-[#17223b]"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eeebff] text-[9px] font-extrabold text-[#5b4ee6]">{initials(row.name)}</span><span className="truncate">{row.name}</span></div></td>{activeStats.subjectCodes.map((code: string) => { const subject = (row.subjects || []).find((item: any) => item.code === code); return <td key={code} className={`whitespace-nowrap px-2 py-3 text-center ${subject?.marks === null || subject?.marks === undefined ? "text-[#98a2b3]" : subject.pass === false ? "font-semibold text-[#ef4444]" : "text-[#15966a]"}`}>{subject?.marks ?? "—"}</td>; })}<td className="whitespace-nowrap px-2 py-3 text-center font-bold text-[#17223b]">{row.marks}</td><td className="whitespace-nowrap px-2 py-3 text-center text-[#626b80]">{pct}%</td><td className="px-2 py-3 text-center"><button onClick={() => setSelectedTier(tier)} className="inline-flex max-w-full whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold" style={{ backgroundColor: `${TIER_COLORS[grade]}18`, color: TIER_COLORS[grade] }}>{grade}</button></td></tr>; })}</tbody></table></div></section>
          <div className="space-y-5"><section className="analysis-panel p-5"><div className="mb-4 flex items-center justify-between"><div><h3>Performance Tier</h3><p className="mt-1 text-[10px] text-[#98a2b3]">Click a tier to filter the data sheet.</p></div><span className="text-[10px] text-[#98a2b3]">{totalStudents} Students</span></div><div className="space-y-2.5">{tierEntries.map(([tier, count]) => <button key={tier} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selectedTier === tier ? "border-[#cfc7ff] bg-[#f6f4ff]" : "border-[#edf0f4] bg-white hover:bg-[#fafaff]"}`}><span className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[tier] }} /><span className="text-[11px] font-semibold text-[#344054]">{tier}</span></span><span className="text-[12px] font-extrabold" style={{ color: TIER_COLORS[tier] }}>{count}</span></button>)}</div><div className="mt-5 h-3 overflow-hidden rounded-full bg-[#f0f1f4]">{tierEntries.map(([tier, count]) => <span key={tier} className="inline-block h-full" style={{ width: `${activeStats.rows.length ? count / activeStats.rows.length * 100 : 0}%`, background: TIER_COLORS[tier] }} />)}</div></section><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Top 5 Highest Scorers</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(0, 5).map((row: any, index: number) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#15966a]">{row.marks}</span></div>)}</div></section><section className="analysis-panel p-5"><h3 className="text-[13px] font-bold text-[#17223b]">Bottom 5 At-Risk Students</h3><div className="mt-3 space-y-2">{activeStats.sorted.slice(-5).reverse().map((row: any, index: number) => <div key={row.enrollmentNo} className="flex items-center justify-between border-b border-[#f0f1f3] pb-2 last:border-0"><span className="text-[10px] font-semibold text-[#344054]">{index + 1}. {row.name}</span><span className="text-[10px] font-extrabold text-[#ef4444]">{row.marks}</span></div>)}</div></section></div></div>
        </section>
      </>}
      {data && view === "summary" && <>
        <section className="summary-heading"><div><h2>Academic Summary</h2><p>Compare Midsem 1 and Midsem 2 with the same ClassPulse academic analysis theme.</p></div></section>
        <section className="summary-filter-panel analysis-panel"><div className="summary-filter-title"><div><h3>Filter Criteria</h3><p>Narrow the student list by examination, performance tier, marks range, and order.</p></div><div className="summary-filter-actions"><button className="analysis-secondary" onClick={resetSummaryFilters}>Reset</button><button className="summary-apply-button" onClick={applySummaryFilters}>Apply</button></div></div><div className="summary-filter-grid"><label><span>Exam</span><select value={summaryExamDraft} onChange={(e) => setSummaryExamDraft(e.target.value as SummaryExam)}><option value="combined">Combined</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Max</option></select></label><label><span>Performance Tier</span><select value={summaryTierDraft} onChange={(e) => setSummaryTierDraft(e.target.value as Tier | "all")}><option value="all">All Tiers</option>{(["Excellent", "Good", "Needs Attention", "Critical Risk"] as Tier[]).map((t) => <option key={t} value={t}>{t}</option>)}</select></label><label><span>Lower Bound</span><input type="number" min="0" max="30" value={summaryLowerDraft} onChange={(e) => setSummaryLowerDraft(e.target.value)} /></label><label><span>Upper Bound</span><input type="number" min="0" max="30" value={summaryUpperDraft} onChange={(e) => setSummaryUpperDraft(e.target.value)} /></label><label><span>Sort</span><select value={summarySortDraft} onChange={(e) => setSummarySortDraft(e.target.value as SummarySort)}><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></label></div></section>
        <section className="summary-metrics-grid">{["Overall Class Average", "Highest Combined Score", "Overall Pass Rate", "Midsem 1 Average", "Midsem 2 Average"].map((label, index) => { const values = [overallClassAverage, highestCombined, `${overallPassRate}%`, midsem1Average, midsem2Average]; const details = ["combined average", highestCombinedNames[0] || "top score", "students scoring 40% or more", "out of 180 marks", "out of 180 marks"]; return <div key={label} className="analysis-panel summary-metric-card" style={{ borderTop: `3px solid ${SUMMARY_COLORS[index]}` }}><span>{label}</span><strong>{values[index]}</strong><p>{details[index]}</p></div>; })}</section>
        <section className="summary-content-grid"><section className="analysis-panel summary-table-panel" style={{ padding: 18, minWidth: 0 }}><div className="analysis-panel-head" style={{ marginBottom: 14 }}><div><h3>Filtered Students</h3><p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>Showing {filteredSummaryRows.length} of {students.length} students</p></div><span className="analysis-count">{filteredSummaryRows.length} Students</span></div><div className="summary-table-wrap" style={{ width: "100%", overflowX: "auto", overflowY: "auto" }}><table className="analysis-table" style={{ width: "100%", minWidth: 620, tableLayout: "fixed", borderCollapse: "collapse" }}><colgroup><col style={{ width: "8%" }} /><col style={{ width: "22%" }} /><col style={{ width: "28%" }} />{summarySubjectCodes.map((code) => <col key={code} style={{ width: `${summarySubjectCodes.length ? 30 / summarySubjectCodes.length : 0}%` }} />)}<col style={{ width: "12%" }} /></colgroup><thead><tr><th style={{ width: "8%", textAlign: "center", padding: "11px 8px" }}>{summaryShowRank ? "Rank" : "S.No."}</th><th style={{ width: "22%", textAlign: "left", padding: "11px 10px" }}>Enrollment No.</th><th style={{ width: "28%", textAlign: "left", padding: "11px 10px" }}>Student</th>{summarySubjectCodes.map((code) => <th key={code} style={{ textAlign: "center", padding: "11px 6px", whiteSpace: "nowrap" }}>{code}</th>)}<th style={{ textAlign: "center", padding: "11px 8px", whiteSpace: "nowrap" }}>Total</th><th style={{ textAlign: "center", padding: "11px 8px", whiteSpace: "nowrap" }}>Tier</th></tr></thead><tbody>{filteredSummaryRows.map((row, index) => <tr key={row.enrollmentNo}><td style={{ textAlign: "center", padding: "10px 8px" }}>{summaryShowRank ? index + 1 : row.sno}</td><td style={{ textAlign: "left", padding: "10px" }}>{row.enrollmentNo}</td><td style={{ textAlign: "left", padding: "10px", fontWeight: 600 }}>{row.name}</td>{summarySubjectCodes.map((code) => { const subject = row.subjects.find((s: any) => s.code === code); const value = subject?.value; const lower = Number(summaryLower); const upper = Number(summaryUpper); const inRange = value != null && value >= (Number.isFinite(lower) ? lower : 0) && value <= (Number.isFinite(upper) ? upper : 30); return <td key={code} style={{ textAlign: "center", padding: "10px 6px", color: inRange && value < 12 ? "#ef4444" : inRange ? "#15966a" : "#98a2b3", fontWeight: inRange ? 600 : 400 }}>{inRange ? value : ""}</td>; })}<td style={{ textAlign: "center", padding: "10px 8px", fontWeight: 700 }}>{row.total}</td><td style={{ textAlign: "center", padding: "10px 8px", fontWeight: 700, color: TIER_COLORS[row.tier] }}>{row.tier}</td></tr>)}{!filteredSummaryRows.length && <tr><td colSpan={summarySubjectCodes.length + 5} style={{ textAlign: "center", padding: 32, color: "#667085" }}>No students match the selected criteria.</td></tr>}</tbody></table></div></section><div className="summary-right-stack"><section className="analysis-panel summary-change-panel"><h3>Marks Increase (Top 5)</h3><p>Students whose Midsem 2 score improved.</p>{increases.map((row, index) => <div className="summary-change-row" key={`${row.name}-${index}`}><span>{index + 1}.</span><p>{row.name}</p><strong>+{row.change}</strong></div>)}</section><section className="analysis-panel summary-change-panel"><h3>Marks Decrease (Top 5)</h3><p>Students whose Midsem 2 score fell.</p>{decreases.map((row, index) => <div className="summary-change-row" key={`${row.name}-${index}`}><span>{index + 1}.</span><p>{row.name}</p><strong className="is-negative">{row.change}</strong></div>)}</section></div></section>
      </>}
    </main>
  </div>;
}
