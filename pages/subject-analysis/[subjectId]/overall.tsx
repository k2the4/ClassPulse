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

const TARGET = 40;
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444"];
const DEFAULT_WEIGHTS: Weights = { assignment: 5, presentation: 5, attendance: 10, midsem1: 10, midsem2: 10 };
const DEFAULT_CRITERIA: Criteria[] = [
  { from: 1, to: 10, minMarks: 38, maxMarks: 40 },
  { from: 11, to: 25, minMarks: 35, maxMarks: 38 },
  { from: 26, to: 40, minMarks: 31, maxMarks: 35 },
  { from: 41, to: 65, minMarks: 25, maxMarks: 30 },
];
const BASIC_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "assignment", label: "Assignment" },
  { key: "presentation", label: "Presentation" },
  { key: "attendance", label: "Attendance" },
  { key: "moderatedAttendance", label: "Moderated Attendance" },
  { key: "midsem1", label: "Midsem 1" },
  { key: "midsem2", label: "Midsem 2" },
];
const HEADERS: { key: ColumnKey; label: string; weight?: WeightKey }[] = [
  { key: "assignment", label: "Assignment", weight: "assignment" },
  { key: "presentation", label: "Presentation", weight: "presentation" },
  { key: "attendance", label: "Attendance", weight: "attendance" },
  { key: "moderatedAttendance", label: "Moderated Att." },
  { key: "midsem1", label: "Midsem 1", weight: "midsem1" },
  { key: "midsem2", label: "Midsem 2", weight: "midsem2" },
  { key: "basic", label: "Basic" },
  { key: "moderated", label: "Moderated" },
];
const ALL_COLUMNS = [...BASIC_COLUMNS, { key: "basic" as ColumnKey, label: "Basic Marks" }, { key: "moderated" as ColumnKey, label: "Moderated Marks" }];

const round1 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
const num = (v: string, fallback = 0) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback;
const weighted = (raw: number, max: number, weight: number) => max > 0 && weight > 0 ? round1(raw / max * weight) : 0;
function weightKey(key: ColumnKey): WeightKey | null {
  if (key === "moderatedAttendance") return "attendance";
  return key === "assignment" || key === "presentation" || key === "attendance" || key === "midsem1" || key === "midsem2" ? key : null;
}
function normalize(columns: ColumnKey[], weights: Weights): Weights {
  const keys = Array.from(new Set(columns.map(weightKey).filter((k): k is WeightKey => !!k)));
  if (!keys.length) return weights;
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0) || keys.length;
  const next = { ...weights }; let used = 0;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) next[k] = round1(Math.max(0, TARGET - used));
    else { next[k] = round1(((Math.max(0, weights[k]) || 1) / total) * TARGET); used += next[k]; }
  });
  return next;
}
function linear(rank: number, tier: Criteria) {
  if (tier.to <= tier.from) return tier.maxMarks;
  return tier.maxMarks + ((rank - tier.from) / (tier.to - tier.from)) * (tier.minMarks - tier.maxMarks);
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
  const [riskLower, setRiskLower] = useState(0);
  const [riskUpper, setRiskUpper] = useState(40);

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

  const selectedTotal = useMemo(() => round1(basicColumns.reduce((s, c) => { const k = weightKey(c); return s + (k ? weights[k] : 0); }, 0)), [basicColumns, weights]);
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
    const ranked = [...preliminary].sort((a, b) => b.attendanceRaw - a.attendanceRaw || a.originalIndex - b.originalIndex);
    const n = ranked.length;
    const attendanceMap = new Map<string, number>();
    ranked.forEach((row, i) => attendanceMap.set(row.enrollmentNo, n ? 10 - Math.min(9, Math.floor((i / n) * 10)) : 0));
    const withBasic = preliminary.map(row => {
      const moderatedAttendance = attendanceMap.get(row.enrollmentNo) ?? 0;
      const values: Record<string, number> = { ...row, moderatedAttendance };
      const basic = round1(basicColumns.reduce((sum, key) => sum + (Number(values[key]) || 0), 0));
      return { ...row, moderatedAttendance, basic };
    });
    const rankedBasic = [...withBasic].sort((a, b) => b.basic - a.basic || a.originalIndex - b.originalIndex);
    const moderated = new Map<string, { rank: number; moderated: number }>();
    rankedBasic.forEach((row, i) => {
      const rank = i + 1; const tier = criteria.find(c => rank >= c.from && rank <= c.to);
      moderated.set(row.enrollmentNo, { rank, moderated: Math.ceil(tier ? linear(rank, tier) : row.basic) });
    });
    return withBasic.map(row => ({ ...row, ...(moderated.get(row.enrollmentNo) || { rank: 0, moderated: Math.ceil(row.basic) }) }));
  }, [data, weights, basicColumns, criteria]);

  const sortedRows = useMemo(() => {
    const rows = [...baseRows];
    if (sortDirection === "none") return rows.sort((a, b) => a.originalIndex - b.originalIndex);
    return rows.sort((a: any, b: any) => ((sortDirection === "asc" ? a[sortColumn] - b[sortColumn] : b[sortColumn] - a[sortColumn]) || a.name.localeCompare(b.name)));
  }, [baseRows, sortColumn, sortDirection]);
  const filteredRiskRows = useMemo(() => {
    const lo = Math.min(riskLower, riskUpper), hi = Math.max(riskLower, riskUpper);
    return baseRows.filter(row => row.basic >= lo && row.basic <= hi);
  }, [baseRows, riskLower, riskUpper]);
  const topFive = useMemo(() => [...filteredRiskRows].sort((a, b) => b.basic - a.basic).slice(0, 5), [filteredRiskRows]);
  const riskDistribution = useMemo(() => [
    { name: `Above 32 (${filteredRiskRows.filter(r => r.basic > 32).length})`, value: filteredRiskRows.filter(r => r.basic > 32).length },
    { name: `24–32 (${filteredRiskRows.filter(r => r.basic >= 24 && r.basic <= 32).length})`, value: filteredRiskRows.filter(r => r.basic >= 24 && r.basic <= 32).length },
    { name: `16–24 (${filteredRiskRows.filter(r => r.basic >= 16 && r.basic < 24).length})`, value: filteredRiskRows.filter(r => r.basic >= 16 && r.basic < 24).length },
    { name: `Below 16 (${filteredRiskRows.filter(r => r.basic < 16).length})`, value: filteredRiskRows.filter(r => r.basic < 16).length },
  ], [filteredRiskRows]);

  function updateWeight(key: WeightKey, value: string) { setWeights(current => normalize(basicColumns, { ...current, [key]: num(value, current[key]) })); }
  function toggleBasic(key: ColumnKey) {
    setBasicColumns(current => {
      const next = current.includes(key) ? current.filter(x => x !== key) : key === "attendance" ? [...current.filter(x => x !== "moderatedAttendance"), key] : key === "moderatedAttendance" ? [...current.filter(x => x !== "attendance"), key] : [...current, key];
      setWeights(w => normalize(next, w)); return next;
    });
  }
  function updateCriteria(i: number, field: keyof Criteria, value: string) { setCriteria(c => c.map((r, index) => index === i ? { ...r, [field]: num(value, r[field]) } : r)); }

  return <div className="min-h-screen max-w-[1900px] mx-auto px-6 py-8">
    <div className="flex items-start justify-between mb-6"><div><h1 className="text-lg font-semibold text-gray-900">Subject Analysis</h1>{computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}</div><div className="flex items-center gap-2"><RawDataButton sheetId={sheetId}/><button onClick={() => loadAnalysis(true)} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">{syncing ? "Syncing..." : "Sync now"}</button></div></div>
    {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>} {loading && !data && <div className="text-sm text-gray-500 py-10">Loading overall analysis...</div>}
    {data && <><div className="mb-5"><h2 className="text-xl font-semibold text-gray-900">Overall Analysis</h2><p className="text-sm text-gray-500 mt-1">Configure internal marks, moderation, ranking and at-risk filtering for this subject.</p></div><div className="flex gap-2 mb-5"><button onClick={() => setView("internal")} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "internal" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Internal Marks</button><button onClick={() => setView("risk")} className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "risk" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>At Risk</button></div>
    {view === "internal" ? <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <section className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex justify-between gap-3"><h3 className="font-medium text-gray-900">Weightage & Basic Marks</h3><span className={`text-xs font-medium ${selectedTotal === TARGET ? "text-green-700" : "text-red-600"}`}>Selected total: {selectedTotal}/40</span></div><div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">{(Object.keys(DEFAULT_WEIGHTS) as WeightKey[]).map(key => { const active = basicColumns.some(c => weightKey(c) === key); const label = key === "midsem1" ? "Midsem 1" : key === "midsem2" ? "Midsem 2" : key[0].toUpperCase() + key.slice(1); return <label key={key} className={`text-[11px] ${active ? "text-gray-600" : "text-gray-400"}`}>{label}<input type="number" min="0" step="0.5" disabled={!active} value={weights[key]} onChange={e => updateWeight(key, e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"/></label>; })}</div><div className="flex flex-wrap gap-2 mt-3">{BASIC_COLUMNS.map(c => <label key={c.key} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5"><input type="checkbox" checked={basicColumns.includes(c.key)} onChange={() => toggleBasic(c.key)}/>{c.label}</label>)}</div><p className="text-[11px] text-gray-400 mt-2">Only checked components count. Active weights are automatically normalized to exactly 40.</p></section>
        <section className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex flex-col md:flex-row md:justify-between gap-2"><div><h3 className="font-medium text-gray-900">Moderated Marks Criteria</h3><p className="text-[11px] text-gray-500 mt-1">Marks are distributed by rank, then rounded up to a whole mark.</p></div><div className="flex gap-2"><select value={sortColumn} onChange={e => setSortColumn(e.target.value as ColumnKey)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">{ALL_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select><select value={sortDirection} onChange={e => setSortDirection(e.target.value as SortDirection)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"><option value="none">No sorting</option><option value="desc">High to low</option><option value="asc">Low to high</option></select></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">{criteria.map((r, i) => <div key={i} className="border border-gray-100 rounded-xl p-2.5"><p className="text-[11px] font-medium text-gray-700 mb-1.5">Tier {i + 1}</p><div className="grid grid-cols-4 gap-1">{(["from", "to", "minMarks", "maxMarks"] as (keyof Criteria)[]).map(field => <label key={field} className="text-[9px] text-gray-400">{field === "minMarks" ? "Min" : field === "maxMarks" ? "Max" : field[0].toUpperCase() + field.slice(1)}<input type="number" step={field === "minMarks" || field === "maxMarks" ? "0.1" : "1"} value={r[field]} onChange={e => updateCriteria(i, field, e.target.value)} className="mt-1 w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-900"/></label>)}</div></div>)}</div></section>
      </div>
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100"><h3 className="font-medium text-gray-900">Internal Marks Data</h3><p className="text-xs text-gray-500 mt-1">Basic marks use only the checked components and total 40 at maximum.</p></div><div className="overflow-auto max-h-[620px]"><table className="min-w-[1250px] w-full table-fixed text-sm"><colgroup><col className="w-[190px]"/><col className="w-[135px]"/>{HEADERS.map(h => <col key={h.key} className="w-[120px]"/>)}<col className="w-[80px]"/></colgroup><thead className="sticky top-0 bg-white z-10 border-b border-gray-100"><tr className="text-xs text-gray-500"><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-3 py-2 font-medium">Enrollment</th>{HEADERS.map(h => <th key={h.key} className="text-center px-2 py-2 font-medium"><div>{h.label}</div>{h.weight && <div className="text-[10px] text-gray-400 mt-0.5">/{weights[h.weight]}</div>}</th>)}<th className="text-center px-2 py-2 font-medium">Rank</th></tr></thead><tbody>{sortedRows.map((row: any) => <tr key={row.enrollmentNo} className="border-b border-gray-50 text-gray-700"><td className="px-4 py-2 whitespace-nowrap">{row.name}</td><td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.enrollmentNo}</td>{HEADERS.map(h => <td key={h.key} className={`px-2 py-2 text-center ${h.key === "moderated" ? "font-medium" : ""}`}>{h.key === "moderated" ? row.moderated : h.key === "basic" ? row.basic : row[h.key]}</td>)}<td className="px-2 py-2 text-center">{row.rank}</td></tr>)}</tbody></table></div></section>
    </> : <>
      <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4"><h3 className="font-medium text-gray-900">At-Risk Filter</h3><p className="text-xs text-gray-500 mt-1">Filtering, the table and the graph use Basic Marks out of 40.</p><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3"><label className="text-xs text-gray-500">Column<div className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50">Basic Marks</div></label><label className="text-xs text-gray-500">Lower bound<input type="number" min="0" max="40" value={riskLower} onChange={e => setRiskLower(num(e.target.value, riskLower))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"/></label><label className="text-xs text-gray-500">Upper bound<input type="number" min="0" max="40" value={riskUpper} onChange={e => setRiskUpper(num(e.target.value, riskUpper))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"/></label></div></section>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4"><section className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="px-4 py-3 border-b border-gray-100"><h3 className="font-medium text-gray-900">Filtered Students</h3><p className="text-xs text-gray-500 mt-1">{filteredRiskRows.length} students match the selected Basic Marks range.</p></div><div className="overflow-auto max-h-[620px]"><table className="min-w-[1000px] w-full table-fixed text-sm"><thead className="sticky top-0 bg-white z-10 border-b border-gray-100 text-xs text-gray-500"><tr><th className="text-left px-3 py-2 w-[180px]">Name</th><th className="text-left px-3 py-2 w-[135px]">Enrollment</th><th className="text-center px-2 py-2">Assignment</th><th className="text-center px-2 py-2">Presentation</th><th className="text-center px-2 py-2">Attendance</th><th className="text-center px-2 py-2">Moderated Att.</th><th className="text-center px-2 py-2">Midsem 1</th><th className="text-center px-2 py-2">Midsem 2</th><th className="text-center px-2 py-2 font-semibold text-gray-700">Basic Marks</th></tr></thead><tbody>{filteredRiskRows.map(row => <tr key={row.enrollmentNo} className="border-b border-gray-50 text-gray-700"><td className="px-3 py-2 whitespace-nowrap">{row.name}</td><td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.enrollmentNo}</td><td className="text-center px-2 py-2">{row.assignment}</td><td className="text-center px-2 py-2">{row.presentation}</td><td className="text-center px-2 py-2">{row.attendance}</td><td className="text-center px-2 py-2">{row.moderatedAttendance}</td><td className="text-center px-2 py-2">{row.midsem1}</td><td className="text-center px-2 py-2">{row.midsem2}</td><td className="text-center px-2 py-2 font-semibold">{row.basic}</td></tr>)}</tbody></table></div></section><div className="space-y-4"><section className="bg-white rounded-2xl border border-gray-100 p-4"><h3 className="font-medium text-gray-900">Top 5 Students</h3><p className="text-xs text-gray-500 mt-1">Highest Basic Marks among the filtered students.</p><ol className="mt-3 space-y-2 text-sm">{topFive.map((row, i) => <li key={row.enrollmentNo} className="flex justify-between gap-3"><span>{i + 1}. {row.name}</span><span className="font-medium">{row.basic}</span></li>)}</ol></section><section className="bg-white rounded-2xl border border-gray-100 p-4"><h3 className="font-medium text-gray-900">Basic Marks Distribution</h3><p className="text-xs text-gray-500 mt-1">Above 32, 24–32, 16–24 and Below 16.</p><div className="h-[270px] mt-2"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>{riskDistribution.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={COLORS[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div></section></div></div>
    </>}
    </>}
  </div>;
}
