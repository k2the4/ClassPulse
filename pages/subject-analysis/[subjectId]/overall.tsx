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
function riskScoreClass(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.875) return "text-blue-600 font-semibold";
  if (ratio >= 0.625) return "text-green-600 font-semibold";
  if (ratio >= 0.375) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
}
function riskStatus(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.875) return { label: "Excellent", className: "bg-blue-50 text-blue-700" };
  if (ratio >= 0.625) return { label: "Good", className: "bg-green-50 text-green-700" };
  if (ratio >= 0.375) return { label: "Needs Attention", className: "bg-amber-50 text-amber-700" };
  return { label: "Critical Risk", className: "bg-red-50 text-red-600" };
}
function riskMax(column: ColumnKey, weights: Weights) {
  if (column === "basic" || column === "moderated") return TARGET;
  return weights[column as WeightKey] || 0;
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
      const values = { ...row, moderatedAttendance: moderatedAttendanceWeighted };
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
  const selectedRiskMax = useMemo(() => riskMax(riskColumn, weights), [riskColumn, weights]);
  const draftRiskMax = useMemo(() => riskMax(draftRiskColumn, weights), [draftRiskColumn, weights]);
  const topFive = useMemo(() => [...baseRows].sort((a, b) => columnValue(b, riskColumn) - columnValue(a, riskColumn) || a.originalIndex - b.originalIndex).slice(0, 5), [baseRows, riskColumn]);
  const riskDistribution = useMemo(() => {
    const max = selectedRiskMax;
    const critical = max * 0.375;
    const needsAttention = max * 0.625;
    const good = max * 0.875;
    return [
      { name: "Excellent", value: baseRows.filter(r => columnValue(r, riskColumn) > good).length, lower: round1(good + 0.0001), upper: max },
      { name: "Good", value: baseRows.filter(r => { const v = columnValue(r, riskColumn); return v >= needsAttention && v <= good; }).length, lower: round1(needsAttention), upper: round1(good) },
      { name: "Needs Attention", value: baseRows.filter(r => { const v = columnValue(r, riskColumn); return v >= critical && v < needsAttention; }).length, lower: round1(critical), upper: round1(needsAttention - 0.0001) },
      { name: "Critical Risk", value: baseRows.filter(r => columnValue(r, riskColumn) < critical).length, lower: 0, upper: round1(critical - 0.0001) },
    ];
  }, [baseRows, riskColumn, selectedRiskMax]);
  const riskTotal = Math.max(1, baseRows.length);

  function updateWeight(key: WeightKey, value: string) { setDraftWeights(current => ({ ...current, [key]: num(value, current[key]) })); }
  function toggleBasic(key: WeightKey) { setDraftBasicColumns(current => { if (current.includes(key)) return current.filter(x => x !== key); if (key === "attendance") return [...current.filter(x => x !== "moderatedAttendance"), key]; if (key === "moderatedAttendance") return [...current.filter(x => x !== "attendance"), key]; return [...current, key]; }); }
  function applyWeights() { if (selectedTotal <= 0) return; setApplyingWeights(true); const applied = normalize(draftBasicColumns, draftWeights); setBasicColumns(draftBasicColumns); setWeights(applied); setDraftWeights(applied); window.setTimeout(() => setApplyingWeights(false), 250); }
  function updateCriteria(i: number, field: keyof Criteria, value: string) {
    setCriteria(current => { const next = current.map(row => ({ ...row })); const parsed = num(value, next[i][field]); if (field === "from") return current; if (field === "to") next[i].to = Math.max(next[i].from, Math.floor(parsed)); else next[i][field] = parsed; next[0].from = 1; for (let index = 1; index < next.length; index++) { next[index].from = next[index - 1].to + 1; if (next[index].to < next[index].from) next[index].to = next[index].from; } return next; });
  }
  function applyRiskFilters() {
    const max = riskMax(draftRiskColumn, weights);
    const lo = Math.min(draftRiskLower, draftRiskUpper);
    const hi = Math.min(max, Math.max(draftRiskLower, draftRiskUpper));
    setRiskColumn(draftRiskColumn); setRiskLower(Math.max(0, lo)); setRiskUpper(Math.max(0, hi)); setSortDirection(draftSortDirection);
  }
  const cycleSort = (key: ColumnKey) => { if (sortColumn !== key) { setSortColumn(key); setSortDirection("asc"); return; } setSortDirection(current => current === "none" ? "asc" : current === "asc" ? "desc" : "none"); };

  return (
    <div className="min-h-screen max-w-[1900px] mx-auto px-6 lg:px-8 py-7 text-slate-900">
      <div className="flex items-start justify-between mb-5">
        <div><h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Subject Analysis</h1>{computedAt && <p className="text-xs text-slate-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}</div>
        <div className="flex items-center gap-2"><RawDataButton sheetId={sheetId} /><button onClick={() => loadAnalysis(true)} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-[#3f2a8f] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div>
      </div>
      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
      {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !data && <div className="py-14 text-center text-sm text-slate-500">Loading analysis...</div>}
      {data && (
        <>
          <div className="mt-5 flex items-center gap-2 border-b border-slate-200"><button onClick={() => setView("internal")} className={`px-3 py-2 text-sm font-medium ${view === "internal" ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500"}`}>Internal Marks</button><button onClick={() => setView("risk")} className={`px-3 py-2 text-sm font-medium ${view === "risk" ? "border-b-2 border-violet-600 text-violet-700" : "text-slate-500"}`}>At Risk</button></div>
          {view === "internal" ? (
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Internal Marks</h2><p className="text-xs text-slate-400 mt-1">Basic and moderated internal assessment out of 40.</p></div><div className="flex flex-wrap gap-2">{COMPONENTS.map(({ key, label }) => <button key={key} onClick={() => toggleBasic(key)} className={`rounded-lg border px-3 py-2 text-xs ${basicColumns.includes(key) ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-400"}`}>{label}</button>)}</div></div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">{COMPONENTS.map(({ key, label }) => <label key={key} className="text-xs text-slate-500">{label}<input type="number" min="0" value={draftWeights[key]} onChange={e => updateWeight(key, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label>)}</div>
              <div className="px-5 pb-4 flex items-center justify-between"><span className={`text-xs ${selectedTotal === TARGET ? "text-emerald-600" : "text-amber-600"}`}>Selected total: {formatNumber(selectedTotal)} / {TARGET}</span><button onClick={applyWeights} disabled={selectedTotal <= 0 || applyingWeights} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{applyingWeights ? "Applying..." : "Apply weights"}</button></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500">{["#","Student",...HEADERS.map(h=>h.label)].map((h,i)=><th key={i} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead><tbody>{sortedRows.map((row,i)=><tr key={row.enrollmentNo} className="border-t border-slate-100"><td className="px-4 py-3">{i+1}</td><td className="px-4 py-3 font-medium">{row.name}<div className="text-[10px] text-slate-400">{row.enrollmentNo}</div></td>{HEADERS.map(({key})=><td key={key} className={`px-4 py-3 ${scoreClass(columnValue(row,key), key === "assignment" ? weights.assignment : key === "presentation" ? weights.presentation : key === "attendance" ? weights.attendance : key === "moderatedAttendance" ? weights.moderatedAttendance : key === "midsem1" || key === "midsem2" ? weights[key] : TARGET)}`}>{formatNumber(columnValue(row,key))}</td>)}</tr>)}</tbody></table></div>
            </section>
          ) : (
            <section className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4 flex-wrap"><div><h2 className="font-semibold">At Risk</h2><p className="text-xs text-slate-400 mt-1">Filter students by a selected assessment score.</p></div><div className="flex gap-2"><select value={draftRiskColumn} onChange={e => { const key = e.target.value as ColumnKey; setDraftRiskColumn(key); const max = riskMax(key, weights); setDraftRiskUpper(Math.min(draftRiskUpper, max)); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">{HEADERS.map(h=><option key={h.key} value={h.key}>{h.label}</option>)}</select><input type="number" min="0" max={draftRiskMax} value={draftRiskLower} onChange={e=>setDraftRiskLower(num(e.target.value,draftRiskLower))} className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs"/><input type="number" min="0" max={draftRiskMax} value={draftRiskUpper} onChange={e=>setDraftRiskUpper(num(e.target.value,draftRiskUpper))} className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs"/><button onClick={applyRiskFilters} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white">Apply</button></div></div></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-sm">Risk Distribution</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>{riskDistribution.map((entry,index)=><Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-sm">Top 5</h3><div className="mt-3 space-y-2">{topFive.map(row=><div key={row.enrollmentNo} className="flex items-center justify-between text-xs"><span className="truncate mr-3">{row.name}</span><span className={riskScoreClass(columnValue(row,riskColumn),selectedRiskMax)}>{formatNumber(columnValue(row,riskColumn))}</span></div>)}</div></div></div>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-4 py-3 text-left">Student</th><th className="px-4 py-3 text-left">Score</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredRiskRows.map(row=>{const value=columnValue(row,riskColumn);const status=riskStatus(value,selectedRiskMax);return <tr key={row.enrollmentNo} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{row.name}<div className="text-[10px] text-slate-400">{row.enrollmentNo}</div></td><td className={`px-4 py-3 ${riskScoreClass(value,selectedRiskMax)}`}>{formatNumber(value)} / {formatNumber(selectedRiskMax)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span></td></tr>})}</tbody></table></div><div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">Showing {filteredRiskRows.length} of {riskTotal === 1 && !baseRows.length ? 0 : baseRows.length} students</div></div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
