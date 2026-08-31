import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";

type MarkMode = "basic" | "internal";
type View = "internal" | "risk";
type SortDirection = "none" | "asc" | "desc";
type Subject = { id: string; name: string; code: string };
type SubjectScore = {
  subjectId: string;
  code: string;
  name: string;
  attendance: number;
  midsem1: number;
  midsem2: number;
  combined: number;
  basicInternal: number;
  moderatedInternal: number;
  basicMax: number;
  grade: string;
};
type Student = {
  enrollmentNo: string;
  name: string;
  email: string;
  subjects: SubjectScore[];
  overallPct: number;
  overallAttendance: number;
  overallGrade: string;
};
type OverallData = { subjects: Subject[]; students: Student[]; classAverageOverallPct: number };
type Row = Student & {
  originalIndex: number;
  subjects: (Subject & { mark: number; max: number; pct: number })[];
  overallPct: number;
  tier: string;
};

const TIER_COLORS: Record<string, string> = {
  Excellent: "#2563eb",
  Good: "#16a34a",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

const tierFor = (pct: number) =>
  pct > 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Needs Attention" : "Critical Risk";

const tierClass = (tier: string) =>
  tier === "Excellent"
    ? "bg-blue-50 text-blue-700"
    : tier === "Good"
      ? "bg-green-50 text-green-700"
      : tier === "Needs Attention"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

const scoreClass = (pct: number) =>
  pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-500";

export default function SectionOverallPage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("risk");
  const [markMode, setMarkMode] = useState<MarkMode>("basic");
  const [lower, setLower] = useState(0);
  const [upper, setUpper] = useState(100);
  const [draftLower, setDraftLower] = useState(0);
  const [draftUpper, setDraftUpper] = useState(100);
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>("none");

  async function loadAnalysis(sync = false) {
    if (!sectionId || typeof sectionId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}/overall${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load overall analysis");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt || "");
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load overall analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
  }, [sectionId]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return data.students.map((student, originalIndex) => {
      const subjects = data.subjects.map((subject) => {
        const score = student.subjects.find(
          (item) => item.subjectId === subject.id || item.code === subject.code
        );
        const mark = markMode === "basic"
          ? Number(score?.basicInternal || 0)
          : Number(score?.moderatedInternal || 0);
        const max = Number(score?.basicMax || 0);
        return {
          ...subject,
          mark,
          max,
          pct: max > 0 ? (mark / max) * 100 : 0,
        };
      });
      const overallPct = subjects.length
        ? subjects.reduce((sum, subject) => sum + subject.pct, 0) / subjects.length
        : 0;
      return { ...student, originalIndex, subjects, overallPct, tier: tierFor(overallPct) };
    });
  }, [data, markMode]);

  const filteredRows = useMemo(() => {
    const lo = Math.min(lower, upper);
    const hi = Math.max(lower, upper);
    const result = rows.filter((row) => row.overallPct >= lo && row.overallPct <= hi);
    if (sortDirection === "none") {
      return result.sort((a, b) => a.originalIndex - b.originalIndex);
    }
    return result.sort((a, b) =>
      sortDirection === "asc"
        ? a.overallPct - b.overallPct || a.name.localeCompare(b.name)
        : b.overallPct - a.overallPct || a.name.localeCompare(b.name)
    );
  }, [rows, lower, upper, sortDirection]);

  const tierCounts = useMemo(
    () => rows.reduce((acc, row) => {
      acc[row.tier] = (acc[row.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [rows]
  );

  const classAverage = useMemo(
    () => rows.length ? rows.reduce((sum, row) => sum + row.overallPct, 0) / rows.length : 0,
    [rows]
  );

  const passRate = useMemo(
    () => rows.length ? Math.round(rows.filter((row) => row.overallPct >= 40).length / rows.length * 100) : 0,
    [rows]
  );

  const topFive = useMemo(
    () => [...rows].sort((a, b) => b.overallPct - a.overallPct || a.originalIndex - b.originalIndex).slice(0, 5),
    [rows]
  );

  function applyFilters() {
    setLower(Math.min(draftLower, draftUpper));
    setUpper(Math.max(draftLower, draftUpper));
    setSortDirection(draftSortDirection);
  }

  function resetRiskFilter() {
    setDraftLower(0);
    setDraftUpper(100);
    setLower(0);
    setUpper(100);
    setDraftSortDirection("none");
    setSortDirection("none");
  }

  return (
    <div className="analysis-layout">
      <aside className="analysis-sidebar">
        <div className="analysis-brand">
          <span className="analysis-brand__mark"><BarChart3 size={18} /></span>
          <span>ClassPulse</span>
        </div>
        <nav className="analysis-side-nav">
          <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a className="is-active" href="/class-analysis"><BookOpen size={18} />Class Analysis</a>
          <a href="/subject-analysis"><GraduationCap size={18} />Subject Analysis</a>
        </nav>
        <RawDataButton sheetId={sheetId} />
        <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="analysis-page">
        <header className="analysis-topbar">
          <div className="analysis-title-row">
            <h1>Class / Section Analysis</h1>
            {computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}
          </div>
          <div className="analysis-top-actions">
            <button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}>
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
        </header>

        {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

        <div className="analysis-view-switch">
          <button onClick={() => setView("internal")} className={view === "internal" ? "is-active" : ""}>Internal Marks</button>
          <button onClick={() => setView("risk")} className={view === "risk" ? "is-active" : ""}>At Risk</button>
        </div>

        {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
        {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading overall analysis...</div>}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Class Average</p>
                <p className="mt-1 text-[28px] font-extrabold text-slate-900">{classAverage.toFixed(1)}%</p>
                <p className="mt-1 text-[10px] text-slate-400">across all {data.subjects.length} subjects</p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Students</p>
                <p className="mt-1 text-[28px] font-extrabold text-slate-900">{rows.length}</p>
                <p className="mt-1 text-[10px] text-slate-400">students assessed</p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Pass Rate</p>
                <p className="mt-1 text-[28px] font-extrabold text-slate-900">{passRate}%</p>
                <p className="mt-1 text-[10px] text-slate-400">students at or above 40%</p>
              </section>
            </div>

            {view === "risk" ? (
              <>
                <section className="at-risk-filter rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="at-risk-filter-inner">
                    <div className="at-risk-filter-title">
                      <h3>At-Risk Filters</h3>
                      <p>Choose mark type, range and sort.</p>
                    </div>
                    <div className="at-risk-filter-controls">
                      <label>
                        <span>Marks shown</span>
                        <select value={markMode} onChange={(e) => setMarkMode(e.target.value as MarkMode)}>
                          <option value="basic">Basic</option>
                          <option value="internal">Internal Marks</option>
                        </select>
                      </label>
                      <label>
                        <span>Lower bound</span>
                        <input type="number" min="0" max="100" value={draftLower} onChange={(e) => setDraftLower(Number(e.target.value))} />
                      </label>
                      <label>
                        <span>Upper bound</span>
                        <input type="number" min="0" max="100" value={draftUpper} onChange={(e) => setDraftUpper(Number(e.target.value))} />
                      </label>
                      <label>
                        <span>Sort</span>
                        <select value={draftSortDirection} onChange={(e) => setDraftSortDirection(e.target.value as SortDirection)}>
                          <option value="none">No sort</option>
                          <option value="desc">High to Low</option>
                          <option value="asc">Low to High</option>
                        </select>
                      </label>
                      <button type="button" onClick={applyFilters} className="at-risk-apply">Apply</button>
                    </div>
                  </div>
                </section>

                <div className="at-risk-layout mt-4">
                  <section className="at-risk-table rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Filtered Students</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Showing {filteredRows.length} of {rows.length} students.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] rounded-full bg-slate-100 px-2 py-1 text-slate-600">{data.subjects.length} Subjects</span>
                        <button type="button" onClick={resetRiskFilter} className="text-[10px] font-semibold text-[#4a35b3]">Reset</button>
                      </div>
                    </div>
                    <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
                      <table className="w-full table-fixed text-[10px] border-collapse">
                        <colgroup>
                          {sortDirection !== "none" && <col className="w-[6%]" />}
                          <col className="w-[22%]" />
                          {data.subjects.map((subject) => <col key={subject.id} className="w-[9%]" />)}
                          <col className="w-[9%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 text-slate-500">
                            {sortDirection !== "none" && <th className="text-center px-1 py-2">Rank</th>}
                            <th className="text-left px-2 py-2">Student</th>
                            {data.subjects.map((subject) => <th key={subject.id} className="text-center px-1 py-2">{subject.code || subject.name}</th>)}
                            <th className="text-center px-1 py-2">%AGE</th>
                            <th className="text-center px-1 py-2">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row, index) => (
                            <tr key={row.enrollmentNo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                              {sortDirection !== "none" && <td className="text-center px-1 py-2 text-slate-500 tabular-nums">{index + 1}</td>}
                              <td className="px-2 py-2 font-medium text-slate-800 truncate" title={row.name}>{row.name}</td>
                              {row.subjects.map((subject) => (
                                <td key={subject.id} className={`text-center px-1 py-2 tabular-nums ${scoreClass(subject.pct)}`} title={`${subject.mark}/${subject.max}`}>
                                  {Number.isInteger(subject.mark) ? subject.mark : subject.mark.toFixed(1)}
                                </td>
                              ))}
                              <td className={`text-center px-1 py-2 font-semibold tabular-nums ${scoreClass(row.overallPct)}`}>{row.overallPct.toFixed(0)}%</td>
                              <td className="text-center px-1 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${tierClass(row.tier)}`}>{row.tier}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <aside className="at-risk-side-stack">
                    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900">Distribution</h3>
                      <p className="mt-0.5 text-[10px] text-slate-500">Overall performance across all subjects.</p>
                      <div className="mt-3 space-y-2">
                        {["Excellent", "Good", "Needs Attention", "Critical Risk"].map((tier) => {
                          const count = tierCounts[tier] || 0;
                          const width = rows.length ? Math.max(2, count / rows.length * 100) : 0;
                          return (
                            <button key={tier} type="button" onClick={() => {
                              const ranges: Record<string, [number, number]> = { Excellent: [80.0001, 100], Good: [60, 80], "Needs Attention": [40, 59.9999], "Critical Risk": [0, 39.9999] };
                              const [lo, hi] = ranges[tier];
                              setDraftLower(lo); setDraftUpper(hi);
                            }} className="w-full text-left">
                              <div className="flex items-center justify-between text-[10px] text-slate-600"><span>{tier}</span><span>{count}</span></div>
                              <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: TIER_COLORS[tier] }} /></div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-900">Top Students</h3><p className="text-[10px] text-slate-500 mt-0.5">Highest overall percentages.</p></div>
                      <div className="grid grid-cols-1 divide-y divide-slate-100">
                        {topFive.map((row) => <div key={row.enrollmentNo} className="px-3 py-2.5 flex items-center justify-between gap-3"><div className="text-[10px] font-semibold text-slate-800 truncate">{row.name}</div><div className="text-sm text-green-600 shrink-0">{row.overallPct.toFixed(1)}%</div></div>)}
                      </div>
                    </section>
                  </aside>
                </div>
              </>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div><h3 className="text-sm font-semibold text-slate-900">Internal Marks</h3><p className="text-[10px] text-slate-500 mt-0.5">Showing {markMode === "basic" ? "Basic" : "Internal (moderated)"} marks for all subjects.</p></div>
                  <select value={markMode} onChange={(e) => setMarkMode(e.target.value as MarkMode)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-700 bg-white"><option value="basic">Basic</option><option value="internal">Internal Marks</option></select>
                </div>
                <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
                  <table className="w-full table-fixed border-collapse text-[10px]">
                    <colgroup><col className="w-[24%]" />{data.subjects.map((subject) => <col key={subject.id} className="w-[9%]" />)}<col className="w-[10%]" /><col className="w-[12%]" /></colgroup>
                    <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-slate-200 text-slate-500"><th className="text-left px-2 py-2">Student</th>{data.subjects.map((subject) => <th key={subject.id} className="text-center px-1 py-2">{subject.code || subject.name}</th>)}<th className="text-center px-1 py-2">%AGE</th><th className="text-center px-1 py-2">Grade</th></tr></thead>
                    <tbody>{rows.map((row) => <tr key={row.enrollmentNo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-2 py-2 font-medium text-slate-800 truncate">{row.name}</td>{row.subjects.map((subject) => <td key={subject.id} className={`text-center px-1 py-2 tabular-nums ${scoreClass(subject.pct)}`}>{Number.isInteger(subject.mark) ? subject.mark : subject.mark.toFixed(1)}</td>)}<td className={`text-center px-1 py-2 font-semibold ${scoreClass(row.overallPct)}`}>{row.overallPct.toFixed(0)}%</td><td className="text-center px-1 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${tierClass(row.tier)}`}>{row.tier}</span></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
