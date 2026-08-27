import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton, StatCard, GradeBadge, RankedList } from "../../../components/AnalysisWidgets";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ExamKey = "midsem1" | "midsem2" | "combined" | "max";
type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
type TierFilter = "all" | Tier;
type SortDirection = "none" | "desc" | "asc";

const MAX_PER_EXAM = 30;
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const TIER_COLORS: Record<Tier, string> = {
  Excellent: "#10b981",
  Good: "#3b82f6",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

function round1(n: number) { return Math.round(n * 10) / 10; }
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2);
}
function gradeFor(marks: number): Tier {
  const pct = (marks / MAX_PER_EXAM) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}
function getExamValue(student: any, exam: ExamKey) {
  if (exam === "midsem1") return Number(student.midsem?.first || 0);
  if (exam === "midsem2") return Number(student.midsem?.second || 0);
  if (exam === "max") return Number(student.midsem?.max || 0);
  return Number(student.midsem?.combined || 0);
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

  const [gradeBasis, setGradeBasis] = useState<ExamKey>("combined");
  const [combinedSort, setCombinedSort] = useState<SortDirection>("desc");
  const [filterExam, setFilterExam] = useState<ExamKey>("combined");
  const [filterTier, setFilterTier] = useState<TierFilter>("all");
  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(MAX_PER_EXAM);
  const [summarySort, setSummarySort] = useState<SortDirection>("none");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    if (sync) setSyncing(true); else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
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

  function selectSummaryExam(exam: ExamKey) {
    setFilterExam(exam);
    setLowerBound(0);
    setUpperBound(MAX_PER_EXAM);
  }
  function openSummaryFilter(exam: ExamKey, tier: TierFilter = "all") {
    selectSummaryExam(exam);
    setFilterTier(tier);
    setView("summary");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  const examStats = useMemo(() => {
    const build = (key: "midsem1" | "midsem2") => {
      const rows = students.map((s: any) => ({ enrollmentNo: s.enrollmentNo, name: s.name, marks: getExamValue(s, key) }));
      const marks = rows.map(r => r.marks);
      const highest = marks.length ? Math.max(...marks) : 0;
      const highestNames = rows.filter(r => r.marks === highest).map(r => r.name);
      const tiers = TIERS.reduce((a, tier) => ({ ...a, [tier]: 0 }), {} as Record<Tier, number>);
      rows.forEach(r => tiers[gradeFor(r.marks)]++);
      return {
        rows,
        classAverage: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : 0,
        classMedian: median(marks),
        highest,
        highestNames,
        passRate: marks.length ? Math.round((rows.filter(r => r.marks >= 12).length / marks.length) * 100) : 0,
        tiers,
        sorted: [...rows].sort((a, b) => b.marks - a.marks),
      };
    };
    return { midsem1: build("midsem1"), midsem2: build("midsem2") };
  }, [students]);

  const combinedRows = useMemo(() => students.map((s: any) => {
    const sortValue = getExamValue(s, gradeBasis);
    return {
      enrollmentNo: s.enrollmentNo,
      name: s.name,
      midsem1: getExamValue(s, "midsem1"),
      midsem2: getExamValue(s, "midsem2"),
      combined: getExamValue(s, "combined"),
      max: getExamValue(s, "max"),
      sortValue,
      grade: gradeFor(sortValue),
    };
  }), [students, gradeBasis]);

  const sortedCombinedRows = useMemo(() => {
    if (combinedSort === "none") return combinedRows;
    return [...combinedRows].sort((a, b) => combinedSort === "desc" ? b.sortValue - a.sortValue : a.sortValue - b.sortValue);
  }, [combinedRows, combinedSort]);

  const combinedGradeCounts = useMemo(() => {
    const counts = TIERS.reduce((a, tier) => ({ ...a, [tier]: 0 }), {} as Record<Tier, number>);
    combinedRows.forEach(r => counts[r.grade]++);
    return counts;
  }, [combinedRows]);

  const filteredSummaryRows = useMemo(() => {
    const rows = students
      .map((s: any) => {
        const marks = getExamValue(s, filterExam);
        return { enrollmentNo: s.enrollmentNo, name: s.name, marks, tier: gradeFor(marks) };
      })
      .filter(r => r.marks >= lowerBound && r.marks <= upperBound)
      .filter(r => filterTier === "all" || r.tier === filterTier);
    if (summarySort === "none") return rows;
    return [...rows].sort((a, b) => summarySort === "desc" ? b.marks - a.marks : a.marks - b.marks);
  }, [students, filterExam, filterTier, lowerBound, upperBound, summarySort]);

  const summaryStats = useMemo(() => {
    const combined = students.map((s: any) => getExamValue(s, "combined"));
    const highest = combined.length ? Math.max(...combined) : 0;
    const highestNames = students.filter((s: any) => getExamValue(s, "combined") === highest).map((s: any) => s.name);
    const first = students.map((s: any) => getExamValue(s, "midsem1"));
    const second = students.map((s: any) => getExamValue(s, "midsem2"));
    const changes = students.map((s: any) => ({ name: s.name, change: round1(getExamValue(s, "midsem2") - getExamValue(s, "midsem1")) })).sort((a, b) => b.change - a.change);
    return {
      average: combined.length ? round1(combined.reduce((a, b) => a + b, 0) / combined.length) : 0,
      highest,
      highestNames,
      passRate: combined.length ? Math.round((combined.filter(v => v >= 12).length / combined.length) * 100) : 0,
      midsem1Avg: first.length ? round1(first.reduce((a, b) => a + b, 0) / first.length) : 0,
      midsem2Avg: second.length ? round1(second.reduce((a, b) => a + b, 0) / second.length) : 0,
      increases: changes.slice(0, 5),
      decreases: [...changes].reverse().slice(0, 5),
    };
  }, [students]);

  function renderExam(label: string, key: "midsem1" | "midsem2") {
    const stats = examStats[key];
    const pieData = TIERS.map(name => ({ name, value: stats.tiers[name], color: TIER_COLORS[name] }));
    return <>
      <div className="mb-6"><h2 className="text-xl font-semibold text-gray-900">{label}</h2><p className="text-sm text-gray-500 mt-1">Raw Midsem marks out of 30, class stats, and performance tiers.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Data Sheet</h3><p className="text-xs text-gray-400 mb-3">Pass mark: 12/30 (40%)</p>
          <div className="max-h-[650px] overflow-y-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-100"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Marks</th><th className="py-2 pr-3">%age</th><th className="py-2">Status</th></tr></thead><tbody>{stats.rows.map(r => {
            const pass = r.marks >= 12; const pct = Math.round((r.marks / MAX_PER_EXAM) * 100);
            return <tr key={r.enrollmentNo} className="border-b border-gray-50"><td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td><td className={`py-2 pr-3 ${pass ? "text-emerald-600" : "text-red-500"}`}>{r.marks}</td><td className="py-2 pr-3">{pct}%</td><td className="py-2"><span className={`text-xs px-2 py-1 rounded-full ${pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{pass ? "Pass" : "Fail"}</span></td></tr>;
          })}</tbody></table></div>
        </section>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4"><StatCard label="Class Average" value={stats.classAverage}/><StatCard label="Class Median" value={stats.classMedian}/><StatCard label={`Highest Score — ${stats.highestNames.join(", ") || "—"}`} value={stats.highest}/><StatCard label="Pass Rate" value={`${stats.passRate}%`}/></div>
          <section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-4">Performance Tier</h3><div className="grid grid-cols-2 gap-3 mb-4">{TIERS.map(name => <button key={name} onClick={() => openSummaryFilter(key, name)} className="rounded-lg p-3 text-center hover:ring-2 hover:ring-gray-200 transition" style={{ backgroundColor: `${TIER_COLORS[name]}22` }}><p className="text-xs text-gray-600">{name}</p><p className="text-lg font-semibold" style={{ color: TIER_COLORS[name] }}>{stats.tiers[name]}</p></button>)}</div><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} cursor="pointer" onClick={(entry: any) => entry?.name && openSummaryFilter(key, entry.name as Tier)}>{pieData.map(entry => <Cell key={entry.name} fill={entry.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><p className="text-xs text-gray-400 text-center mt-1">Click a tier or graph segment to filter those students in Summary.</p></section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Top 5 Highest Scorers" positive items={stats.sorted.slice(0, 5).map(r => ({ name: r.name, marks: r.marks }))}/></section><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Bottom 5 At-Risk Students" positive={false} items={[...stats.sorted].reverse().slice(0, 5).map(r => ({ name: r.name, marks: r.marks }))}/></section></div>
        </div>
      </div>
    </>;
  }

  return <div className="min-h-screen max-w-[1700px] mx-auto px-8 py-10">
    <div className="flex items-start justify-between mb-6"><div><h1 className="text-lg font-semibold text-gray-900">Subject Analysis</h1>{computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}</div><div className="flex items-center gap-2"><RawDataButton sheetId={sheetId}/><button onClick={() => loadAnalysis(true)} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">{syncing ? "Syncing..." : "Sync now"}</button></div></div>
    {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} 
    <div className="flex gap-2 mb-5">{([{ key: "midsem1", label: "Midsem 1" }, { key: "midsem2", label: "Midsem 2" }, { key: "combined", label: "Combined" }, { key: "summary", label: "Summary" }] as { key: AcademicView; label: string }[]).map(tab => <button key={tab.key} onClick={() => setView(tab.key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === tab.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{tab.label}</button>)}</div>
    {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
    {loading && !data && <div className="text-sm text-gray-500 py-10">Loading academic analysis...</div>}
    {data && view === "midsem1" && renderExam("Midsem 1", "midsem1")}
    {data && view === "midsem2" && renderExam("Midsem 2", "midsem2")}

    {data && view === "combined" && <><div className="mb-6 flex items-end justify-between flex-wrap gap-4"><div><h2 className="text-xl font-semibold text-gray-900">Midsem Combined</h2><p className="text-sm text-gray-500 mt-1">Choose the academic measure and sorting order.</p></div><div className="flex gap-3"><div><label className="block text-xs font-medium text-gray-500 mb-1">Grade / Sort By</label><select value={gradeBasis} onChange={e => setGradeBasis(e.target.value as ExamKey)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="combined">Combined (average)</option><option value="max">Max (better of the two)</option></select></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Order</label><select value={combinedSort} onChange={e => setCombinedSort(e.target.value as SortDirection)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></div></div></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-4">All Students</h3><div className="max-h-[600px] overflow-y-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-100">{combinedSort !== "none" && <th className="py-2 pr-3 w-10">Rank</th>}<th className="py-2 pr-3">Name</th><th className="py-2 pr-3">1st</th><th className="py-2 pr-3">2nd</th><th className="py-2 pr-3">Combined</th><th className="py-2 pr-3">Max</th><th className="py-2">Grade</th></tr></thead><tbody>{sortedCombinedRows.map((r, i) => <tr key={r.enrollmentNo} className="border-b border-gray-50">{combinedSort !== "none" && <td className="py-2 pr-3 text-gray-400 font-medium">{i + 1}</td>}<td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td><td className="py-2 pr-3">{r.midsem1}</td><td className="py-2 pr-3">{r.midsem2}</td><td className="py-2 pr-3">{r.combined}</td><td className="py-2 pr-3">{r.max}</td><td className="py-2"><GradeBadge grade={r.grade}/></td></tr>)}</tbody></table></div></section><div className="space-y-6"><section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-4">Grade Distribution</h3><ResponsiveContainer width="100%" height={220}><BarChart data={TIERS.map(name => ({ name, count: combinedGradeCounts[name] }))}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" fontSize={11}/><YAxis fontSize={12} allowDecimals={false}/><Tooltip/><Bar dataKey="count" radius={[4,4,0,0]} cursor="pointer" onClick={(entry: any) => entry?.name && openSummaryFilter(gradeBasis, entry.name as Tier)}>{TIERS.map(name => <Cell key={name} fill={TIER_COLORS[name]}/>)}</Bar></BarChart></ResponsiveContainer><p className="text-xs text-gray-400 text-center mt-1">Click a bar to open the same tier in Summary.</p></section><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Top 5 Highest Scorers" positive items={[...combinedRows].sort((a,b)=>b.sortValue-a.sortValue).slice(0,5).map(r=>({name:r.name,marks:r.sortValue}))}/></section><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Bottom 5" positive={false} items={[...combinedRows].sort((a,b)=>a.sortValue-b.sortValue).slice(0,5).map(r=>({name:r.name,marks:r.sortValue}))}/></section></div></div></>}

    {data && view === "summary" && <><div className="mb-6"><h2 className="text-xl font-semibold text-gray-900">Academic Summary</h2><p className="text-sm text-gray-500 mt-1">Midsem 1 and Midsem 2 filters always use the actual raw marks out of 30.</p></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><div className="space-y-6"><section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-4">Filter Criteria</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"><div><label className="block text-xs font-medium text-gray-500 mb-2">Exam</label><select value={filterExam} onChange={e => selectSummaryExam(e.target.value as ExamKey)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="combined">Combined</option><option value="max">Max</option></select></div><div><label className="block text-xs font-medium text-gray-500 mb-2">Performance Tier</label><select value={filterTier} onChange={e => setFilterTier(e.target.value as TierFilter)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"><option value="all">All Tiers</option>{TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-500 mb-2">Lower Bound</label><input type="number" min="0" max={MAX_PER_EXAM} value={lowerBound} onChange={e => setLowerBound(Math.max(0, Math.min(MAX_PER_EXAM, Number(e.target.value))))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/></div><div><label className="block text-xs font-medium text-gray-500 mb-2">Upper Bound</label><input type="number" min="0" max={MAX_PER_EXAM} value={upperBound} onChange={e => setUpperBound(Math.max(0, Math.min(MAX_PER_EXAM, Number(e.target.value))))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/></div><div><label className="block text-xs font-medium text-gray-500 mb-2">Sort</label><select value={summarySort} onChange={e => setSummarySort(e.target.value as SortDirection)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></div></div></section><section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-4">Filtered Students <span className="text-gray-400 font-normal">({filteredSummaryRows.length})</span></h3><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-100"><th className="py-2 pr-3">Enrollment</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Marks</th><th className="py-2">Tier</th></tr></thead><tbody>{filteredSummaryRows.map(r => <tr key={r.enrollmentNo} className="border-b border-gray-50"><td className="py-2 pr-3 text-gray-500">{r.enrollmentNo}</td><td className="py-2 pr-3 text-gray-900">{r.name}</td><td className="py-2 pr-3">{r.marks}</td><td className="py-2"><GradeBadge grade={r.tier}/></td></tr>)}{!filteredSummaryRows.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No students match this filter.</td></tr>}</tbody></table></section></div><div className="space-y-6"><div className="grid grid-cols-2 gap-4"><StatCard label="Overall Class Average" value={summaryStats.average}/><StatCard label={`Highest Combined Score — ${summaryStats.highestNames.join(", ") || "—"}`} value={summaryStats.highest}/><StatCard label="Overall Pass Rate" value={`${summaryStats.passRate}%`}/><StatCard label="Midsem 1 Average" value={summaryStats.midsem1Avg}/><StatCard label="Midsem 2 Average" value={summaryStats.midsem2Avg}/></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Marks Increase (Top 5)" positive items={summaryStats.increases.map(s=>({name:s.name,marks:s.change}))}/></section><section className="bg-white rounded-2xl border border-gray-100 p-6"><RankedList title="Marks Decrease (Top 5)" positive={false} items={summaryStats.decreases.map(s=>({name:s.name,marks:s.change}))}/></section></div></div></div></>}
  </div>;
}
