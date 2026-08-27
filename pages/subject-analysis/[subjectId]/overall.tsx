import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton } from "../../../components/AnalysisWidgets";

type View = "internal" | "risk";
type SortDirection = "none" | "asc" | "desc";
type ColumnKey = "assignment" | "presentation" | "attendance" | "moderatedAttendance" | "midsem1" | "midsem2" | "basic" | "moderated";
type WeightKey = "assignment" | "presentation" | "attendance" | "midsem1" | "midsem2";
type Weights = Record<WeightKey, number>;
type Criteria = { from: number; to: number; minMarks: number; maxMarks: number };

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const DEFAULT_WEIGHTS: Weights = { assignment: 5, presentation: 5, attendance: 10, midsem1: 10, midsem2: 10 };
const DEFAULT_CRITERIA: Criteria[] = [
  { from: 1, to: 10, minMarks: 38, maxMarks: 40 },
  { from: 11, to: 25, minMarks: 35, maxMarks: 38 },
  { from: 26, to: 40, minMarks: 31, maxMarks: 35 },
  { from: 41, to: 65, minMarks: 25, maxMarks: 30 },
];
const BASIC_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "assignment", label: "Assignment" }, { key: "presentation", label: "Presentation" },
  { key: "attendance", label: "Attendance" }, { key: "moderatedAttendance", label: "Moderated Attendance" },
  { key: "midsem1", label: "Midsem 1" }, { key: "midsem2", label: "Midsem 2" },
];
const ALL_COLUMNS = [...BASIC_COLUMNS, { key: "basic" as ColumnKey, label: "Basic Marks" }, { key: "moderated" as ColumnKey, label: "Moderated Marks" }];
const HEADERS: { key: ColumnKey; label: string; weight?: WeightKey }[] = [
  { key: "assignment", label: "Assignment", weight: "assignment" }, { key: "presentation", label: "Presentation", weight: "presentation" },
  { key: "attendance", label: "Attendance", weight: "attendance" }, { key: "moderatedAttendance", label: "Moderated Att." },
  { key: "midsem1", label: "Midsem 1", weight: "midsem1" }, { key: "midsem2", label: "Midsem 2", weight: "midsem2" },
  { key: "basic", label: "Basic" }, { key: "moderated", label: "Moderated" },
];
function round1(n: number) { return Math.round((Number.isFinite(n) ? n : 0) * 10) / 10; }
function num(v: string, fallback = 0) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : fallback; }
function weighted(raw: number, rawMax: number, weight: number) { return rawMax > 0 && weight > 0 ? round1((raw / rawMax) * weight) : 0; }
function linearTier(rank: number, tier: Criteria) {
  if (tier.to <= tier.from) return round1(tier.maxMarks);
  const t = (rank - tier.from) / (tier.to - tier.from);
  return round1(tier.maxMarks + (tier.minMarks - tier.maxMarks) * t);
}

export default function SubjectOverallPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("internal");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [basicColumns, setBasicColumns] = useState<ColumnKey[]>(["assignment", "presentation", "moderatedAttendance", "midsem1", "midsem2"]);
  const [criteria, setCriteria] = useState<Criteria[]>(DEFAULT_CRITERIA);
  const [sortColumn, setSortColumn] = useState<ColumnKey>("moderated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [riskColumn, setRiskColumn] = useState<ColumnKey>("moderated");
  const [riskLower, setRiskLower] = useState(0);
  const [riskUpper, setRiskUpper] = useState(100);

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

  const baseRows = useMemo(() => {
    const preliminary = (data?.students || []).map((s: any, originalIndex: number) => ({
      enrollmentNo: s.enrollmentNo, name: s.name, originalIndex,
      assignmentRaw: Number(s.assignment?.submitted || 0), assignmentTotal: Number(s.assignment?.total || 0),
      presentationRaw: Number(s.presentation || 0), attendanceRaw: Number(s.attendancePct?.currMonth || 0),
      midsem1Raw: Number(s.midsem?.first || 0), midsem2Raw: Number(s.midsem?.second || 0),
      assignment: weighted(Number(s.assignment?.submitted || 0), Number(s.assignment?.total || 0), weights.assignment),
      presentation: weighted(Number(s.presentation || 0), 10, weights.presentation),
      attendance: weighted(Number(s.attendancePct?.currMonth || 0), 100, weights.attendance),
      midsem1: weighted(Number(s.midsem?.first || 0), 30, weights.midsem1), midsem2: weighted(Number(s.midsem?.second || 0), 30, weights.midsem2),
    }));
    const rankedAttendance = [...preliminary].sort((a,b) => b.attendanceRaw - a.attendanceRaw || a.originalIndex - b.originalIndex);
    const attendanceMap = new Map(rankedAttendance.map((r, i) => [r.enrollmentNo, Math.max(0, 10 - Math.floor(i / 7))]));
    const withBasic = preliminary.map(r => {
      const moderatedAttendance = attendanceMap.get(r.enrollmentNo) ?? 0;
      const values: Record<string, number> = { ...r, moderatedAttendance };
      return { ...r, moderatedAttendance, basic: round1(basicColumns.reduce((sum, key) => sum + (values[key] || 0), 0)) };
    });
    const rankedBasic = [...withBasic].sort((a,b) => b.basic - a.basic || a.originalIndex - b.originalIndex);
    const moderation = new Map<string, { rank: number; moderated: number }>();
    rankedBasic.forEach((r, i) => {
      const rank = i + 1; const tier = criteria.find(c => rank >= c.from && rank <= c.to);
      moderation.set(r.enrollmentNo, { rank, moderated: tier ? linearTier(rank, tier) : r.basic });
    });
    return withBasic.map(r => ({ ...r, ...(moderation.get(r.enrollmentNo) || { rank: 0, moderated: r.basic }) }));
  }, [data, weights, basicColumns, criteria]);

  const sortedRows = useMemo(() => {
    const rows = [...baseRows];
    if (sortDirection === "none") return rows.sort((a,b) => a.originalIndex - b.originalIndex);
    return rows.sort((a:any,b:any) => (sortDirection === "asc" ? a[sortColumn] - b[sortColumn] : b[sortColumn] - a[sortColumn]) || a.name.localeCompare(b.name));
  }, [baseRows, sortColumn, sortDirection]);
  const filteredRiskRows = useMemo(() => {
    const lo = Math.min(riskLower, riskUpper), hi = Math.max(riskLower, riskUpper);
    return baseRows.filter((r:any) => Number(r[riskColumn] || 0) >= lo && Number(r[riskColumn] || 0) <= hi);
  }, [baseRows, riskColumn, riskLower, riskUpper]);
  const topFive = useMemo(() => [...filteredRiskRows].sort((a:any,b:any) => Number(b[riskColumn]||0)-Number(a[riskColumn]||0)).slice(0,5), [filteredRiskRows, riskColumn]);
  const distributionData = useMemo(() => {
    if (!filteredRiskRows.length) return [];
    const values = filteredRiskRows.map((r:any) => Number(r[riskColumn]||0)); const min = Math.min(...values), max = Math.max(...values);
    if (min === max) return [{ name: `${round1(min)} (${values.length})`, value: values.length }];
    const step = (max-min)/4;
    return Array.from({length:4},(_,i)=>{ const start=min+step*i, end=i===3?max:min+step*(i+1); const count=values.filter(v=>i===3?v>=start&&v<=end:v>=start&&v<end).length; return {name:`${round1(start)}–${round1(end)} (${count})`,value:count}; });
  }, [filteredRiskRows, riskColumn]);

  const updateWeight = (k: WeightKey, v: string) => setWeights(c => ({...c,[k]:num(v,c[k])}));
  const toggleBasic = (k: ColumnKey) => setBasicColumns(c => c.includes(k) ? c.filter(x=>x!==k) : k === "attendance" ? [...c.filter(x=>x!=="moderatedAttendance"),k] : k === "moderatedAttendance" ? [...c.filter(x=>x!=="attendance"),k] : [...c,k]);
  const updateCriteria = (i:number, field:keyof Criteria, v:string) => setCriteria(c => c.map((r,index)=>index===i?{...r,[field]:num(v,r[field])}:r));

  return <div className="min-h-screen max-w-[1900px] mx-auto px-6 py-8">
    <div className="flex items-start justify-between mb-6"><div><h1 className="text-lg font-semibold text-gray-900">Subject Analysis</h1>{computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}</div><div className="flex items-center gap-2"><RawDataButton sheetId={sheetId}/><button onClick={()=>loadAnalysis(true)} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">{syncing?"Syncing...":"Sync now"}</button></div></div>
    {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>} {loading && !data && <div className="text-sm text-gray-500 py-10">Loading overall analysis...</div>}
    {data && <><div className="mb-5"><h2 className="text-xl font-semibold text-gray-900">Overall Analysis</h2><p className="text-sm text-gray-500 mt-1">Configure internal marks, moderation, ranking and at-risk filtering for this subject.</p></div><div className="flex gap-2 mb-6"><button onClick={()=>setView("internal")} className={`px-4 py-2 rounded-lg text-sm font-medium ${view==="internal"?"bg-gray-900 text-white":"bg-gray-100 text-gray-600"}`}>Internal Marks</button><button onClick={()=>setView("risk")} className={`px-4 py-2 rounded-lg text-sm font-medium ${view==="risk"?"bg-gray-900 text-white":"bg-gray-100 text-gray-600"}`}>At Risk</button></div>
    {view === "internal" ? <>
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-5"><h3 className="font-medium text-gray-900">Weightage & Basic Marks</h3><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">{(Object.keys(DEFAULT_WEIGHTS) as WeightKey[]).map(k=><label key={k} className="text-xs text-gray-500">{k==="midsem1"?"Midsem 1":k==="midsem2"?"Midsem 2":k[0].toUpperCase()+k.slice(1)} weight<input type="number" min="0" step="0.5" value={weights[k]} onChange={e=>updateWeight(k,e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-900"/></label>)}</div><div className="flex flex-wrap gap-2 mt-4">{BASIC_COLUMNS.map(c=><label key={c.key} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2"><input type="checkbox" checked={basicColumns.includes(c.key)} onChange={()=>toggleBasic(c.key)}/>{c.label}</label>)}</div></section>
      <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-5"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h3 className="font-medium text-gray-900">Moderated Marks Criteria</h3><p className="text-xs text-gray-500 mt-1">Within each tier, the first rank receives the maximum and the last rank receives the minimum, with marks distributed linearly.</p></div><div className="flex gap-2"><select value={sortColumn} onChange={e=>setSortColumn(e.target.value as ColumnKey)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm">{ALL_COLUMNS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select><select value={sortDirection} onChange={e=>setSortDirection(e.target.value as SortDirection)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm"><option value="none">No sorting</option><option value="desc">Highest to lowest</option><option value="asc">Lowest to highest</option></select></div></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">{criteria.map((r,i)=><div key={i} className="border border-gray-100 rounded-xl p-3"><p className="text-xs font-medium text-gray-700 mb-2">Tier {i+1}</p><div className="grid grid-cols-4 gap-1"><label className="text-[10px] text-gray-400">From<input type="number" value={r.from} onChange={e=>updateCriteria(i,"from",e.target.value)} className="mt-1 w-full border rounded px-1 py-1 text-xs"/></label><label className="text-[10px] text-gray-400">To<input type="number" value={r.to} onChange={e=>updateCriteria(i,"to",e.target.value)} className="mt-1 w-full border rounded px-1 py-1 text-xs"/></label><label className="text-[10px] text-gray-400">Min<input type="number" step="0.1" value={r.minMarks} onChange={e=>updateCriteria(i,"minMarks",e.target.value)} className="mt-1 w-full border rounded px-1 py-1 text-xs"/></label><label className="text-[10px] text-gray-400">Max<input type="number" step="0.1" value={r.maxMarks} onChange={e=>updateCriteria(i,"maxMarks",e.target.value)} className="mt-1 w-full border rounded px-1 py-1 text-xs"/></label></div></div>)}</div></section>
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="px-4 py-3 border-b"><h3 className="font-medium text-gray-900">Internal Marks Data</h3><p className="text-xs text-gray-500 mt-1">Compact view — all columns fit on screen. The small line below each weighted score shows the raw source value.</p></div><div className="max-h-[700px] overflow-y-auto"><table className="w-full table-fixed text-xs"><colgroup><col className="w-[16%]"/><col className="w-[10%]"/>{HEADERS.map(h=><col key={h.key} className="w-[9.25%]"/>)}</colgroup><thead className="sticky top-0 z-10 bg-white border-b text-gray-500"><tr>{HEADERS.map((h,i)=><th key={h.key} className="px-1 py-2 text-center align-bottom"><span className="block text-[10px] text-gray-400">{h.weight?weights[h.weight]:h.key==="moderatedAttendance"?"10":h.key==="basic"?"selected":h.key==="moderated"?"tiered":""}</span><span className="font-medium">{h.label}</span></th>)}</tr><tr className="hidden"><th/></tr></thead><tbody>{sortedRows.map((r:any)=><tr key={r.enrollmentNo} className="border-b border-gray-50 hover:bg-gray-50/70"><td className="px-2 py-2 truncate text-gray-900" title={r.name}>{r.name}</td><td className="px-1 py-2 truncate text-gray-500" title={r.enrollmentNo}>{r.enrollmentNo}</td>{HEADERS.map(h=>{const raw = h.key==="assignment"?`${r.assignmentRaw}/${r.assignmentTotal}`:h.key==="presentation"?`${r.presentationRaw}/10`:h.key==="attendance"?`${r.attendanceRaw}%`:h.key==="midsem1"?`${r.midsem1Raw}/30`:h.key==="midsem2"?`${r.midsem2Raw}/30`:h.key==="moderated"?`Rank ${r.rank}`:""; return <td key={h.key} className="px-1 py-2 text-center"><span className={h.key==="moderated"?"font-semibold":"font-medium"}>{round1(r[h.key])}</span>{raw&&<span className="block text-[10px] text-gray-400">{raw}</span>}</td>})}</tr>)}</tbody></table></div></section>
    </> : <>
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-5"><h3 className="font-medium text-gray-900">At-Risk Filter</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"><label className="text-xs text-gray-500">Column<select value={riskColumn} onChange={e=>setRiskColumn(e.target.value as ColumnKey)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{ALL_COLUMNS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label><label className="text-xs text-gray-500">Lower bound<input type="number" step="0.1" value={riskLower} onChange={e=>setRiskLower(Number(e.target.value)||0)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label><label className="text-xs text-gray-500">Upper bound<input type="number" step="0.1" value={riskUpper} onChange={e=>setRiskUpper(Number(e.target.value)||0)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"/></label></div></section>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5"><section className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="p-4 border-b"><h3 className="font-medium text-gray-900">Filtered Students</h3><p className="text-xs text-gray-500">{filteredRiskRows.length} students match the selected range.</p></div><div className="max-h-[700px] overflow-y-auto"><table className="w-full table-fixed text-xs"><colgroup><col className="w-[17%]"/><col className="w-[11%]"/>{ALL_COLUMNS.map(c=><col key={c.key} className="w-[9%]"/>)}</colgroup><thead className="sticky top-0 bg-white border-b text-gray-500"><tr><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Enrollment</th>{ALL_COLUMNS.map(c=><th key={c.key} className={`px-1 py-2 text-center ${c.key===riskColumn?"text-gray-900":""}`}>{c.label}</th>)}</tr></thead><tbody>{filteredRiskRows.map((r:any)=><tr key={r.enrollmentNo} className="border-b border-gray-50"><td className="px-2 py-2 truncate" title={r.name}>{r.name}</td><td className="px-2 py-2 truncate text-gray-500">{r.enrollmentNo}</td>{ALL_COLUMNS.map(c=><td key={c.key} className={`px-1 py-2 text-center ${c.key===riskColumn?"font-semibold text-red-600":"text-gray-600"}`}>{round1(r[c.key])}</td>)}</tr>)}</tbody></table></div></section>
      <div className="space-y-5"><section className="bg-white rounded-2xl border border-gray-100 p-5"><h3 className="font-medium text-gray-900">Top 5 Students</h3><p className="text-xs text-gray-500 mt-1">Highest scores among the currently filtered students.</p><ol className="mt-4 space-y-3">{topFive.map((r:any,i)=><li key={r.enrollmentNo} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2"><span><span className="text-gray-400 mr-2">{i+1}.</span>{r.name}</span><span className="font-semibold">{round1(r[riskColumn])}</span></li>)}{!topFive.length&&<p className="text-sm text-gray-400">No students match this range.</p>}</ol></section><section className="bg-white rounded-2xl border border-gray-100 p-5"><h3 className="font-medium text-gray-900">Range Distribution</h3><p className="text-xs text-gray-500 mt-1">Each slice is labelled with its mark range and student count.</p><div className="h-[300px] mt-2">{distributionData.length?<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distributionData} dataKey="value" nameKey="name" outerRadius={92} label={({name})=>name}>{distributionData.map((e,i)=><Cell key={e.name} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>:<div className="h-full flex items-center justify-center text-sm text-gray-400">No students match this range.</div>}</div></section></div></div>
    </>}</>}
  </div>;
}
