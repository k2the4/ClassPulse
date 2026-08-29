import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton } from "../../../components/AnalysisWidgets";

type View = "internal" | "risk";
type SortDirection = "none" | "asc" | "desc";
type ColumnKey = "assignment" | "presentation" | "attendance" | "moderatedAttendance" | "midsem1" | "midsem2" | "basic" | "moderated";
type WeightKey = "assignment" | "presentation" | "attendance" | "moderatedAttendance" | "midsem1" | "midsem2";
type Weights = Record<WeightKey, number>;
type Criteria = { from: number; to: number; minMarks: number; maxMarks: number };

const TARGET = 40;
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444"];
const DEFAULT_WEIGHTS: Weights = { assignment: 5, presentation: 5, attendance: 10, moderatedAttendance: 10, midsem1: 10, midsem2: 10 };
const DEFAULT_CRITERIA: Criteria[] = [
  { from: 1, to: 10, minMarks: 38, maxMarks: 40 },
  { from: 11, to: 25, minMarks: 35, maxMarks: 38 },
  { from: 26, to: 40, minMarks: 31, maxMarks: 35 },
  { from: 41, to: 65, minMarks: 25, maxMarks: 30 },
];
const COMPONENTS: { key: WeightKey; label: string }[] = [
  { key: "assignment", label: "Assignment" },
  { key: "presentation", label: "Presentation" },
  { key: "attendance", label: "Attendance" },
  { key: "midsem1", label: "Midsem 1" },
  { key: "midsem2", label: "Midsem 2" },
  { key: "moderatedAttendance", label: "Moderated Att." },
];
const HEADERS: { key: ColumnKey; label: string }[] = [
  { key: "assignment", label: "Assignment" },
  { key: "presentation", label: "Presentation" },
  { key: "attendance", label: "Attendance" },
  { key: "moderatedAttendance", label: "Moderated Att." },
  { key: "midsem1", label: "Midsem 1" },
  { key: "midsem2", label: "Midsem 2" },
  { key: "basic", label: "Basic" },
  { key: "moderated", label: "Moderated" },
];
const round1 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
const num = (v: string, fallback = 0) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback;
const weighted = (raw: number, max: number, weight: number) => max > 0 && weight > 0 ? round1(raw / max * weight) : 0;
function normalize(columns: WeightKey[], weights: Weights): Weights {
  const keys = Array.from(new Set(columns));
  if (!keys.length) return weights;
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0) || keys.length;
  const next = { ...weights };
  let used = 0;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) next[key] = round1(Math.max(0, TARGET - used));
    else { next[key] = round1(((Math.max(0, weights[key]) || 1) / total) * TARGET); used += next[key]; }
  });
  return next;
}
function linear(rank: number, tier: Criteria) {
  if (tier.to <= tier.from) return tier.maxMarks;
  return tier.maxMarks + ((rank - tier.from) / (tier.to - tier.from)) * (tier.minMarks - tier.maxMarks);
}
function columnValue(row: any, column: ColumnKey) { return Number(row[column] ?? 0); }
function scoreClass(value: number, max = 40) {
  const ratio = max ? value / max : 0;
  if (ratio >= 0.8) return "text-emerald-600 font-semibold";
  if (ratio >= 0.6) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
}
function riskStatus(value: number) {
  if (value > 32) return { label: "Excellent", className: "bg-emerald-50 text-emerald-700" };
  if (value >= 24) return { label: "Good", className: "bg-green-50 text-green-700" };
  if (value >= 16) return { label: "Needs Attention", className: "bg-amber-50 text-amber-700" };
  return { label: "Critical Risk", className: "bg-red-50 text-red-600" };
}

export default function SubjectOverallPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [applyingWeights, setApplyingWeights] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("internal");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [draftWeights, setDraftWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [basicColumns, setBasicColumns] = useState<WeightKey[]>(["assignment", "presentation", "moderatedAttendance", "midsem1", "midsem2"]);
  const [draftBasicColumns, setDraftBasicColumns] = useState<WeightKey[]>(["assignment", "presentation", "moderatedAttendance", "midsem1", "midsem2"]);
  const [criteria, setCriteria] = useState<Criteria[]>(DEFAULT_CRITERIA);
  const [sortColumn, setSortColumn] = useState<ColumnKey>("moderated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [riskColumn, setRiskColumn] = useState<ColumnKey>("basic");
  const [riskLower, setRiskLower] = useState(0);
  const [riskUpper, setRiskUpper] = useState(40);
  const [draftRiskColumn, setDraftRiskColumn] = useState<ColumnKey>("basic");
  const [draftRiskLower, setDraftRiskLower] = useState(0);
  const [draftRiskUpper, setDraftRiskUpper] = useState(40);
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>("none");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true); setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) { setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load overall analysis"); return; }
      setData(json.data); setComputedAt(json.computedAt); setSheetId(json.sheetId || null);
    } catch (e: any) { setError(e.message || "Failed to load overall analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }
  useEffect(() => { loadAnalysis(); }, [subjectId]);

  const selectedTotal = useMemo(() => round1(draftBasicColumns.reduce((sum, key) => sum + draftWeights[key], 0)), [draftBasicColumns, draftWeights]);
  const baseRows = useMemo(() => {
    const preliminary = (data?.students || []).map((s: any, originalIndex: number) => ({
      enrollmentNo: s.enrollmentNo, name: s.name, originalIndex,
      assignmentRaw: Number(s.assignment?.submitted || 0), assignmentTotal: Number(s.assignment?.total || 0),
      presentationRaw: Number(s.presentation || 0), attendanceRaw: Number(s.attendancePct?.currMonth || 0),
      assignment: weighted(Number(s.assignment?.submitted || 0), Number(s.assignment?.total || 0), weights.assignment),
      presentation: weighted(Number(s.presentation || 0), 10, weights.presentation),
      attendance: weighted(Number(s.attendancePct?.currMonth || 0), 100, weights.attendance),
      midsem1: weighted(Number(s.midsem?.first || 0), 30, weights.midsem1),
      midsem2: weighted(Number(s.midsem?.second || 0), 30, weights.midsem2),
    }));
    const rankedAttendance = [...preliminary].sort((a, b) => b.attendanceRaw - a.attendanceRaw || a.originalIndex - b.originalIndex);
    const attendanceMap = new Map<string, number>(); const n = rankedAttendance.length;
    rankedAttendance.forEach((row, i) => attendanceMap.set(row.enrollmentNo, n ? 10 - Math.min(9, Math.floor((i / n) * 10)) : 0));
    const withBasic = preliminary.map(row => {
      const moderatedAttendance = attendanceMap.get(row.enrollmentNo) ?? 0;
      const moderatedAttendanceWeighted = weighted(moderatedAttendance, 10, weights.moderatedAttendance);
      const values: Record<string, number> = { ...row, moderatedAttendance: moderatedAttendanceWeighted };
      const basic = round1(basicColumns.reduce((sum, key) => sum + (Number(values[key]) || 0), 0));
      return { ...row, moderatedAttendance, moderatedAttendanceWeighted, basic };
    });
    const rankedBasic = [...withBasic].sort((a, b) => b.basic - a.basic || a.originalIndex - b.originalIndex);
    const moderated = new Map<string, { rank: number; moderated: number }>();
    rankedBasic.forEach((row, i) => { const rank = i + 1; const tier = criteria.find(c => rank >= c.from && rank <= c.to); moderated.set(row.enrollmentNo, { rank, moderated: Math.ceil(tier ? linear(rank, tier) : row.basic) }); });
    return withBasic.map(row => ({ ...row, ...(moderated.get(row.enrollmentNo) || { rank: 0, moderated: Math.ceil(row.basic) }) }));
  }, [data, weights, basicColumns, criteria]);

  const sortedRows = useMemo(() => {
    const rows = [...baseRows];
    if (sortDirection === "none") return rows.sort((a, b) => a.originalIndex - b.originalIndex);
    return rows.sort((a: any, b: any) => ((sortDirection === "asc" ? a[sortColumn] - b[sortColumn] : b[sortColumn] - a[sortColumn]) || a.name.localeCompare(b.name)));
  }, [baseRows, sortColumn, sortDirection]);
  const filteredRiskRows = useMemo(() => {
    const lo = Math.min(riskLower, riskUpper); const hi = Math.max(riskLower, riskUpper);
    const rows = baseRows.filter(row => { const value = columnValue(row, riskColumn); return value >= lo && value <= hi; });
    if (sortDirection === "none") return rows.sort((a, b) => a.originalIndex - b.originalIndex);
    return rows.sort((a: any, b: any) => ((sortDirection === "asc" ? a[riskColumn] - b[riskColumn] : b[riskColumn] - a[riskColumn]) || a.name.localeCompare(b.name)));
  }, [baseRows, riskColumn, riskLower, riskUpper, sortDirection]);
  const topFive = useMemo(() => [...filteredRiskRows].sort((a, b) => columnValue(b, riskColumn) - columnValue(a, riskColumn)).slice(0, 5), [filteredRiskRows, riskColumn]);
  const riskDistribution = useMemo(() => [
    { name: "Excellent", value: baseRows.filter(r => columnValue(r, riskColumn) > 32).length, lower: 32.0001, upper: 40 },
    { name: "Good", value: baseRows.filter(r => { const v = columnValue(r, riskColumn); return v >= 24 && v <= 32; }).length, lower: 24, upper: 32 },
    { name: "Needs Attention", value: baseRows.filter(r => { const v = columnValue(r, riskColumn); return v >= 16 && v < 24; }).length, lower: 16, upper: 23.9999 },
    { name: "Critical Risk", value: baseRows.filter(r => columnValue(r, riskColumn) < 16).length, lower: 0, upper: 15.9999 },
  ], [baseRows, riskColumn]);

  function updateWeight(key: WeightKey, value: string) { setDraftWeights(current => ({ ...current, [key]: num(value, current[key]) })); }
  function toggleBasic(key: WeightKey) { setDraftBasicColumns(current => { if (current.includes(key)) return current.filter(x => x !== key); if (key === "attendance") return [...current.filter(x => x !== "moderatedAttendance"), key]; if (key === "moderatedAttendance") return [...current.filter(x => x !== "attendance"), key]; return [...current, key]; }); }
  function applyWeights() { if (selectedTotal <= 0) return; setApplyingWeights(true); const applied = normalize(draftBasicColumns, draftWeights); setBasicColumns(draftBasicColumns); setWeights(applied); setDraftWeights(applied); window.setTimeout(() => setApplyingWeights(false), 250); }
  function updateCriteria(i: number, field: keyof Criteria, value: string) {
    setCriteria(current => { const next = current.map(row => ({ ...row })); const parsed = num(value, next[i][field]); if (field === "from") return current; if (field === "to") next[i].to = Math.max(next[i].from, Math.floor(parsed)); else next[i][field] = parsed; next[0].from = 1; for (let index = 1; index < next.length; index++) { next[index].from = next[index - 1].to + 1; if (next[index].to < next[index].from) next[index].to = next[index].from; } return next; });
  }
  function applyRiskFilters() {
    const lo = Math.min(draftRiskLower, draftRiskUpper);
    const hi = Math.max(draftRiskLower, draftRiskUpper);
    setRiskColumn(draftRiskColumn);
    setRiskLower(lo);
    setRiskUpper(hi);
    setSortDirection(draftSortDirection);
  }
  function selectDistributionBucket(index: number) {
    const bucket = riskDistribution[index];
    if (!bucket) return;
    setDraftRiskLower(bucket.lower);
    setDraftRiskUpper(bucket.upper);
  }

  return <div className="analysis-layout">
    <aside className="analysis-sidebar">
      <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div>
      <nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a><a href="/classes"><BookOpen size={18} />Class Analysis</a><a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/overall` : "#"}><GraduationCap size={18} />Subject Analysis</a></nav>
      <RawDataButton sheetId={sheetId} />
      <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
    </aside>
    <main className="analysis-page">
      <header className="analysis-topbar"><div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div></header>
      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} 
      <div className="analysis-view-switch"><button onClick={() => setView("internal")} className={view === "internal" ? "is-active" : ""}>Internal Marks</button><button onClick={() => setView("risk")} className={view === "risk" ? "is-active" : ""}>At Risk</button></div>
      {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
      {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading overall analysis...</div>}
      {data && view === "internal" ? <>
        <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1fr] gap-2 mb-2 items-start">
          <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"><div className="flex items-center justify-between mb-2"><div><h3 className="text-sm font-semibold text-slate-900">Applied Components Summary</h3><p className="text-[10px] text-slate-500 mt-0.5">Choose components and set their weightage.</p></div><span className={`text-[11px] font-semibold ${selectedTotal === TARGET ? "text-emerald-600" : "text-amber-600"}`}>Selected total: {selectedTotal}/40</span></div><div className="grid grid-cols-3 grid-rows-2 gap-1.5">{COMPONENTS.map(({ key, label }) => { const checked = draftBasicColumns.includes(key); return <label key={key} className={`min-w-0 rounded-lg border p-1.5 cursor-pointer transition ${checked ? "border-violet-200 bg-violet-50/60" : "border-slate-200 bg-white"}`}><div className="flex items-center gap-1.5 min-w-0"><input type="checkbox" checked={checked} onChange={() => toggleBasic(key)} className="h-3.5 w-3.5 accent-[#4a35b3] shrink-0"/><span className="text-[11px] font-medium text-slate-700 truncate">{label}</span></div><input aria-label={`${label} weightage`} type="number" min="0" step="0.1" value={draftWeights[key]} onChange={e => updateWeight(key, e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 outline-none focus:border-violet-400"/></label>; })}</div><div className="flex items-center justify-between mt-2 gap-2"><p className="text-[10px] leading-3.5 text-slate-400">Only checked components count. Weightage is normalized to exactly 40 when applied.</p><button onClick={applyWeights} disabled={applyingWeights || selectedTotal <= 0} className="shrink-0 bg-[#3d2aa0] text-white text-xs font-semibold rounded-lg px-3 py-1.5 shadow-sm disabled:opacity-50">{applyingWeights ? "Applying..." : "Apply"}</button></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"><div className="flex items-start justify-between gap-2 mb-1.5"><div><h3 className="text-sm font-semibold text-slate-900">Moderated Marks Criteria</h3><p className="text-[10px] leading-3.5 text-slate-500 mt-0.5">Rank ranges map continuously to a marks range. Marks are defined from and to.</p></div><div className="flex gap-1.5 shrink-0"><select value="Moderate" onChange={() => undefined} className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-700 bg-white"><option>Moderate</option></select><select value={sortDirection} onChange={e => setSortDirection(e.target.value as SortDirection)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-700 bg-white"><option value="none">No sort</option><option value="asc">Low to high</option><option value="desc">High to low</option></select></div></div><div className="grid grid-cols-2 gap-1.5">{criteria.map((tier, index) => <div key={index} className="rounded-lg border border-slate-200 overflow-hidden"><div className="bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-slate-800">Tier {index + 1}</div><div className="grid grid-cols-4 divide-x divide-slate-200">{(["from","to","minMarks","maxMarks"] as const).map(field => <div key={field} className="p-1"><label className="block text-[8px] uppercase tracking-wide text-slate-400 mb-0.5">{field === "minMarks" ? "Marks from" : field === "maxMarks" ? "Marks to" : field}</label><input type="number" value={tier[field]} onChange={e => updateCriteria(index, field, e.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-1.5 py-1.5 text-[11px] text-slate-800"/></div>)}</div></div>)}</div></section>
        </div>
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="px-3 py-2 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Internal Marks Data</h3><p className="text-[10px] text-slate-500 mt-0.5">Basic marks use the selected components. Moderated marks are calculated from the configured rank criteria.</p></div><div className="max-h-[620px] overflow-y-auto overflow-x-hidden"><table className="w-full table-fixed border-collapse text-[10px]"><colgroup><col className="w-[2.5%]"/><col className="w-[16%]"/><col className="w-[13%]"/><col className="w-[7.5%]"/><col className="w-[7.5%]"/><col className="w-[7.5%]"/><col className="w-[9%]"/><col className="w-[7.5%]"/><col className="w-[7.5%]"/><col className="w-[9%]"/><col className="w-[10%]"/></colgroup><thead className="sticky top-0 bg-white z-10"><tr className="border-b border-slate-200 text-slate-500"><th className="text-center px-0.5 py-2 font-semibold">#</th><th className="text-left px-1.5 py-2 font-semibold">Name</th><th className="text-center px-1 py-2 font-semibold">Enrollment</th>{HEADERS.map(h => <th key={h.key} className="text-center px-0.5 py-2 font-semibold leading-3">{h.label}</th>)}</tr></thead><tbody>{sortedRows.map((row,index) => <tr key={row.enrollmentNo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="text-center px-0.5 py-1.5 text-slate-400 tabular-nums">{index+1}</td><td className="px-1.5 py-1.5 text-slate-800 font-medium truncate" title={row.name}>{row.name}</td><td className="text-center px-1 py-1.5 text-slate-500 truncate tabular-nums">{row.enrollmentNo}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.assignment}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.presentation}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.attendance}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.moderatedAttendanceWeighted}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.midsem1}</td><td className="text-center px-0.5 py-1.5 text-slate-700 tabular-nums">{row.midsem2}</td><td className={`text-center px-0.5 py-1.5 ${scoreClass(row.basic)} tabular-nums`}>{row.basic}</td><td className={`text-center px-0.5 py-1.5 ${scoreClass(row.moderated)} tabular-nums`}>{row.moderated}</td></tr>)}</tbody></table></div></section>
      </> : data && <>
        <div className="at-risk-layout">
          <section className="at-risk-filter rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="at-risk-filter-inner">
              <div className="at-risk-filter-title"><h3>At-Risk Filters</h3><p>Choose a mark column, range and sort.</p></div>
              <label><span>Column</span><select value={draftRiskColumn} onChange={e => setDraftRiskColumn(e.target.value as ColumnKey)}><option value="basic">Basic</option><option value="moderated">Moderated</option><option value="assignment">Assignment</option><option value="presentation">Presentation</option><option value="attendance">Attendance</option><option value="moderatedAttendance">Moderated Att.</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option></select></label>
              <label><span>Lower bound</span><input type="number" min="0" max="40" value={draftRiskLower} onChange={e => setDraftRiskLower(num(e.target.value,draftRiskLower))}/></label>
              <label><span>Upper bound</span><input type="number" min="0" max="40" value={draftRiskUpper} onChange={e => setDraftRiskUpper(num(e.target.value,draftRiskUpper))}/></label>
              <label><span>Sort</span><select value={draftSortDirection} onChange={e => setDraftSortDirection(e.target.value as SortDirection)}><option value="none">No sort</option><option value="asc">Low to high</option><option value="desc">High to low</option></select></label>
              <button type="button" onClick={applyRiskFilters} className="at-risk-apply">Apply</button>
            </div>
          </section>
          <section className="at-risk-table rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Filtered Students</h3><p className="text-[10px] text-slate-500 mt-0.5">Showing {filteredRiskRows.length} of {baseRows.length} students.</p></div><span className="text-[10px] rounded-full bg-slate-100 px-2 py-1 text-slate-600">{filteredRiskRows.length} Students</span></div>
            <div className="max-h-[620px] overflow-y-auto overflow-x-hidden"><table className="w-full table-fixed text-[10px] border-collapse"><colgroup>{sortDirection !== "none" && <col className="w-[7%]"/>}<col className="w-[18%]"/><col className="w-[27%]"/><col className="w-[13%]"/><col className="w-[13%]"/><col className="w-[14%]"/></colgroup><thead className="sticky top-0 bg-white z-10"><tr className="border-b border-slate-200 text-slate-500">{sortDirection !== "none" && <th className="text-center px-1 py-2">Rank</th>}<th className="text-left px-2 py-2">Enrollment</th><th className="text-left px-2 py-2">Student</th><th className="text-center px-1 py-2">Marks</th><th className="text-center px-1 py-2">Moderated</th><th className="text-center px-1 py-2">Status</th></tr></thead><tbody>{filteredRiskRows.map((row,index)=>{ const status = riskStatus(columnValue(row,riskColumn)); return <tr key={row.enrollmentNo} className="border-b border-slate-100">{sortDirection !== "none" && <td className="text-center px-1 py-1.5 text-slate-600">{index + 1}</td>}<td className="px-2 py-1.5 text-slate-500 truncate">{row.enrollmentNo}</td><td className="px-2 py-1.5 font-medium text-slate-800 truncate">{row.name}</td><td className={`text-center px-1 py-1.5 ${scoreClass(row.basic)}`}>{row.basic}</td><td className={`text-center px-1 py-1.5 ${scoreClass(row.moderated)}`}>{row.moderated}</td><td className="text-center px-1 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] ${status.className}`}>{status.label}</span></td></tr>})}</tbody></table></div>
          </section>
          <aside className="at-risk-side-stack">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h3 className="text-sm font-semibold text-slate-900">Distribution</h3><p className="mt-0.5 text-[10px] text-slate-500">Click a segment to stage that score range in the filters.</p><div className="h-52 mt-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false} onClick={(_, index) => selectDistributionBucket(index)}>{riskDistribution.map((_,i)=><Cell key={i} fill={COLORS[i]} cursor="pointer"/>)}</Pie><Tooltip formatter={(value: number) => [`${value} students`, "Count"]}/></PieChart></ResponsiveContainer></div></section>
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="px-3 py-2 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Top Students in Filter</h3></div><div className="grid grid-cols-1 divide-y divide-slate-100">{topFive.map(row=><div key={row.enrollmentNo} className="px-3 py-2.5 flex items-center justify-between gap-3"><div className="text-[10px] font-semibold text-slate-800 truncate">{row.name}</div><div className={`text-sm shrink-0 ${scoreClass(columnValue(row,riskColumn))}`}>{columnValue(row,riskColumn)}</div></div>)}</div></section>
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
