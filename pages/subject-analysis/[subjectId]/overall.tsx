import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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
    else {
      next[key] = round1(((Math.max(0, weights[key]) || 1) / total) * TARGET);
      used += next[key];
    }
  });
  return next;
}

function linear(rank: number, tier: Criteria) {
  if (tier.to <= tier.from) return tier.maxMarks;
  return tier.maxMarks + ((rank - tier.from) / (tier.to - tier.from)) * (tier.minMarks - tier.maxMarks);
}

function columnValue(row: any, column: ColumnKey) {
  return Number(row[column] ?? 0);
}

function scoreClass(value: number, max = 40) {
  const ratio = max ? value / max : 0;
  if (ratio >= 0.8) return "text-emerald-600 font-semibold";
  if (ratio >= 0.6) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
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
  const [criteria, setCriteria] = useState<Criteria[]>(DEFAULT_CRITERIA);
  const [sortColumn, setSortColumn] = useState<ColumnKey>("moderated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [riskColumn, setRiskColumn] = useState<ColumnKey>("basic");
  const [riskLower, setRiskLower] = useState(0);
  const [riskUpper, setRiskUpper] = useState(40);

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load overall analysis");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load overall analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { loadAnalysis(); }, [subjectId]);

  const selectedTotal = useMemo(() => round1(basicColumns.reduce((sum, key) => sum + draftWeights[key], 0)), [basicColumns, draftWeights]);

  const baseRows = useMemo(() => {
    const preliminary = (data?.students || []).map((s: any, originalIndex: number) => ({
      enrollmentNo: s.enrollmentNo,
      name: s.name,
      originalIndex,
      assignmentRaw: Number(s.assignment?.submitted || 0),
      assignmentTotal: Number(s.assignment?.total || 0),
      presentationRaw: Number(s.presentation || 0),
      attendanceRaw: Number(s.attendancePct?.currMonth || 0),
      assignment: weighted(Number(s.assignment?.submitted || 0), Number(s.assignment?.total || 0), weights.assignment),
      presentation: weighted(Number(s.presentation || 0), 10, weights.presentation),
      attendance: weighted(Number(s.attendancePct?.currMonth || 0), 100, weights.attendance),
      midsem1: weighted(Number(s.midsem?.first || 0), 30, weights.midsem1),
      midsem2: weighted(Number(s.midsem?.second || 0), 30, weights.midsem2),
    }));

    const rankedAttendance = [...preliminary].sort((a, b) => b.attendanceRaw - a.attendanceRaw || a.originalIndex - b.originalIndex);
    const attendanceMap = new Map<string, number>();
    const n = rankedAttendance.length;
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
    rankedBasic.forEach((row, i) => {
      const rank = i + 1;
      const tier = criteria.find(c => rank >= c.from && rank <= c.to);
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
    const lo = Math.min(riskLower, riskUpper);
    const hi = Math.max(riskLower, riskUpper);
    return baseRows.filter(row => {
      const value = columnValue(row, riskColumn);
      return value >= lo && value <= hi;
    });
  }, [baseRows, riskColumn, riskLower, riskUpper]);

  const topFive = useMemo(() => [...filteredRiskRows].sort((a, b) => columnValue(b, riskColumn) - columnValue(a, riskColumn)).slice(0, 5), [filteredRiskRows, riskColumn]);

  const riskDistribution = useMemo(() => [
    { name: "Above 32", value: baseRows.filter(r => r.basic > 32).length },
    { name: "24–32", value: baseRows.filter(r => r.basic >= 24 && r.basic <= 32).length },
    { name: "16–24", value: baseRows.filter(r => r.basic >= 16 && r.basic < 24).length },
    { name: "Below 16", value: baseRows.filter(r => r.basic < 16).length },
  ], [baseRows]);

  function updateWeight(key: WeightKey, value: string) {
    setDraftWeights(current => ({ ...current, [key]: num(value, current[key]) }));
  }

  function toggleBasic(key: WeightKey) {
    setBasicColumns(current => {
      if (current.includes(key)) return current.filter(x => x !== key);
      if (key === "attendance") return [...current.filter(x => x !== "moderatedAttendance"), key];
      if (key === "moderatedAttendance") return [...current.filter(x => x !== "attendance"), key];
      return [...current, key];
    });
  }

  function applyWeights() {
    setApplyingWeights(true);
    const applied = normalize(basicColumns, draftWeights);
    setWeights(applied);
    setDraftWeights(applied);
    window.setTimeout(() => setApplyingWeights(false), 250);
  }

  function updateCriteria(i: number, field: keyof Criteria, value: string) {
    setCriteria(current => {
      const next = current.map(row => ({ ...row }));
      const parsed = num(value, next[i][field]);
      if (field === "from") return next;
      if (field === "to") {
        next[i].to = Math.max(next[i].from, Math.floor(parsed));
        for (let index = i + 1; index < next.length; index++) {
          next[index].from = next[index - 1].to + 1;
          if (next[index].to < next[index].from) next[index].to = next[index].from;
        }
      } else {
        next[i][field] = parsed;
      }
      next[0].from = 1;
      for (let index = 1; index < next.length; index++) {
        next[index].from = next[index - 1].to + 1;
        if (next[index].to < next[index].from) next[index].to = next[index].from;
      }
      return next;
    });
  }

  function selectRiskRange(index: number) {
    setRiskColumn("basic");
    if (index === 0) { setRiskLower(32.1); setRiskUpper(40); }
    if (index === 1) { setRiskLower(24); setRiskUpper(32); }
    if (index === 2) { setRiskLower(16); setRiskUpper(23.9); }
    if (index === 3) { setRiskLower(0); setRiskUpper(15.9); }
  }

  return <div className="min-h-screen max-w-[1900px] mx-auto px-6 py-7">
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Subject Analysis</h1>
        {computedAt && <p className="text-xs text-slate-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}
      </div>
      <div className="flex items-center gap-2">
        <RawDataButton sheetId={sheetId}/>
        <button onClick={() => loadAnalysis(true)} disabled={syncing} className="text-sm bg-[#33228f] text-white rounded-lg px-4 py-2.5 shadow-sm disabled:opacity-50">{syncing ? "Syncing..." : "Sync now"}</button>
      </div>
    </div>

    {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} 
    {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mt-4">{error}</div>}
    {loading && !data && <div className="text-sm text-slate-500 py-10">Loading overall analysis...</div>}

    {data && <>
      <div className="flex items-center gap-2 mt-4 mb-3">
        <button onClick={() => setView("internal")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "internal" ? "bg-[#3d2aa0] text-white shadow-sm" : "bg-slate-100 text-slate-600"}`}>Internal Marks</button>
        <button onClick={() => setView("risk")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "risk" ? "bg-[#3d2aa0] text-white shadow-sm" : "bg-slate-100 text-slate-600"}`}>At Risk</button>
      </div>

      {view === "internal" ? <>
        <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-3 mb-3 items-start">
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Applied Components Summary</h3>
                <p className="text-xs text-slate-500 mt-0.5">Choose components and set their weightage.</p>
              </div>
              <span className={`text-xs font-semibold ${selectedTotal === TARGET ? "text-emerald-600" : "text-amber-600"}`}>Selected total: {selectedTotal}/40</span>
            </div>
            <div className="grid grid-cols-3 grid-rows-2 gap-2">
              {COMPONENTS.map(({ key, label }) => {
                const checked = basicColumns.includes(key);
                return <label key={key} className={`min-w-0 rounded-lg border p-2.5 cursor-pointer transition ${checked ? "border-violet-200 bg-violet-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input type="checkbox" checked={checked} onChange={() => toggleBasic(key)} className="h-4 w-4 accent-[#4a35b3] shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
                  </div>
                  <input aria-label={`${label} weightage`} type="number" min="0" step="0.1" value={draftWeights[key]} onChange={e => updateWeight(key, e.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-violet-400" />
                </label>;
              })}
            </div>
            <div className="flex items-center justify-between mt-2.5 gap-3">
              <p className="text-[11px] leading-4 text-slate-400">Only checked components count. Weightage is normalized to exactly 40 when applied.</p>
              <button onClick={applyWeights} disabled={applyingWeights || selectedTotal <= 0} className="shrink-0 bg-[#3d2aa0] text-white text-sm font-semibold rounded-lg px-4 py-2 shadow-sm disabled:opacity-50">{applyingWeights ? "Applying..." : "Apply"}</button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Moderated Marks Criteria</h3>
                <p className="text-[11px] leading-4 text-slate-500 mt-0.5">Rank ranges map continuously to a marks range. Marks are defined from and to.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <select value="Moderate" onChange={() => undefined} className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-white"><option>Moderate</option></select>
                <select value={sortDirection} onChange={e => setSortDirection(e.target.value as SortDirection)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-white"><option value="none">No sort</option><option value="asc">Low to high</option><option value="desc">High to low</option></select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {criteria.map((tier, index) => <div key={index} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-violet-50 px-3 py-1.5 text-xs font-semibold text-slate-800">Tier {index + 1}</div>
                <div className="grid grid-cols-4 divide-x divide-slate-200">
                  {(["from", "to", "minMarks", "maxMarks"] as const).map(field => <div key={field} className="p-1.5">
                    <label className="block text-[9px] uppercase tracking-wide text-slate-400 mb-1">{field === "minMarks" ? "Marks from" : field === "maxMarks" ? "Marks to" : field}</label>
                    <input type="number" value={tier[field]} onChange={e => updateCriteria(index, field, e.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-1.5 py-1.5 text-xs text-slate-800" />
                  </div>)}
                </div>
              </div>)}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Internal Marks Data</h3>
            <p className="text-xs text-slate-500 mt-0.5">Basic marks use the selected components. Moderated marks are calculated from the configured rank criteria.</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col className="w-[4%]"/><col className="w-[14%]"/><col className="w-[11%]"/>
                <col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[10%]"/>
                <col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[9%]"/><col className="w-[10%]"/>
              </colgroup>
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-center px-1 py-2.5 font-semibold">#</th>
                  <th className="text-left px-2 py-2.5 font-semibold">Name</th>
                  <th className="text-center px-1 py-2.5 font-semibold">Enrollment</th>
                  {HEADERS.map(h => <th key={h.key} className="text-center px-1 py-2.5 font-semibold leading-3">{h.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => <tr key={row.enrollmentNo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="text-center px-1 py-2 text-slate-400 tabular-nums">{index + 1}</td>
                  <td className="px-2 py-2 text-slate-800 font-medium truncate" title={row.name}>{row.name}</td>
                  <td className="text-center px-1 py-2 text-slate-500 truncate tabular-nums">{row.enrollmentNo}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.assignment}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.presentation}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.attendance}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.moderatedAttendanceWeighted}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.midsem1}</td>
                  <td className="text-center px-1 py-2 text-slate-700 tabular-nums">{row.midsem2}</td>
                  <td className={`text-center px-1 py-2 ${scoreClass(row.basic)} tabular-nums`}>{row.basic}</td>
                  <td className={`text-center px-1 py-2 ${scoreClass(row.moderated)} tabular-nums`}>{row.moderated}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </> : <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div><h3 className="text-base font-semibold text-slate-900">At-Risk Filters</h3><p className="text-xs text-slate-500 mt-0.5">Filter students by any calculated internal-mark value.</p></div>
              <select value={riskColumn} onChange={e => setRiskColumn(e.target.value as ColumnKey)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs"><option value="basic">Basic</option><option value="moderated">Moderated</option><option value="assignment">Assignment</option><option value="presentation">Presentation</option><option value="attendance">Attendance</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option></select>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <label className="text-xs text-slate-500">Lower bound<input type="number" min="0" max="40" value={riskLower} onChange={e => setRiskLower(num(e.target.value, riskLower))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label>
              <label className="text-xs text-slate-500">Upper bound<input type="number" min="0" max="40" value={riskUpper} onChange={e => setRiskUpper(num(e.target.value, riskUpper))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {riskDistribution.map((item, index) => <button key={item.name} onClick={() => selectRiskRange(index)} className="rounded-lg border border-slate-200 p-2.5 text-left hover:bg-slate-50"><div className="text-xs text-slate-500">{item.name}</div><div className="text-lg font-semibold text-slate-900 mt-0.5">{item.value}</div></button>)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Distribution</h3>
            <div className="h-52 mt-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>{riskDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-base font-semibold text-slate-900">Filtered Students</h3><p className="text-xs text-slate-500 mt-0.5">Showing {filteredRiskRows.length} of {baseRows.length} students.</p></div><span className="text-xs rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{filteredRiskRows.length} Students</span></div>
          <div className="max-h-[620px] overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed text-[11px] border-collapse">
              <colgroup><col className="w-[16%]"/><col className="w-[20%]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[14%]"/><col className="w-[14%]"/></colgroup>
              <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-slate-200 text-slate-500"><th className="text-left px-3 py-2.5">Enrollment</th><th className="text-left px-3 py-2.5">Student</th><th className="text-center px-2 py-2.5">Marks</th><th className="text-center px-2 py-2.5">Moderated</th><th className="text-center px-2 py-2.5">Rank</th><th className="text-center px-2 py-2.5">Tier</th><th className="text-center px-2 py-2.5">Status</th></tr></thead>
              <tbody>{filteredRiskRows.map(row => <tr key={row.enrollmentNo} className="border-b border-slate-100"><td className="px-3 py-2 text-slate-500 truncate">{row.enrollmentNo}</td><td className="px-3 py-2 font-medium text-slate-800 truncate">{row.name}</td><td className={`text-center px-2 py-2 ${scoreClass(row.basic)}`}>{row.basic}</td><td className={`text-center px-2 py-2 ${scoreClass(row.moderated)}`}>{row.moderated}</td><td className="text-center px-2 py-2 text-slate-600">{row.rank}</td><td className="text-center px-2 py-2 text-slate-600">{criteria.findIndex(c => row.rank >= c.from && row.rank <= c.to) + 1 || "—"}</td><td className="text-center px-2 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${row.basic < 16 ? "bg-red-50 text-red-600" : row.basic < 24 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{row.basic < 16 ? "Critical Risk" : row.basic < 24 ? "Needs Attention" : "Good"}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm mt-3 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-base font-semibold text-slate-900">Top Students in Filter</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">{topFive.map(row => <div key={row.enrollmentNo} className="p-3"><div className="text-xs font-semibold text-slate-800 truncate">{row.name}</div><div className={`text-lg mt-1 ${scoreClass(columnValue(row, riskColumn))}`}>{columnValue(row, riskColumn)}</div></div>)}</div>
        </section>
      </>}
    </>}
  </div>;
}
