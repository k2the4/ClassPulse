import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";

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
type RowSubject = Subject & { mark: number; max: number; pct: number; grade: string };
type Row = Student & {
  originalIndex: number;
  subjects: RowSubject[];
  total: number;
  totalMax: number;
  average: number;
  averageMax: number;
  overallPct: number;
  tier: string;
};

const TIER_COLORS: Record<string, string> = {
  Excellent: "#2563eb",
  Good: "#16a34a",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

const tierForPct = (pct: number) =>
  pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Needs Attention" : "Critical Risk";

const tierClass = (tier: string) =>
  tier === "Excellent"
    ? "bg-blue-50 text-blue-700"
    : tier === "Good"
      ? "bg-green-50 text-green-700"
      : tier === "Needs Attention"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

const formatMark = (mark: number) => (Number.isInteger(mark) ? mark : mark.toFixed(1));

export default function SectionOverallPage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lower, setLower] = useState(0);
  const [upper, setUpper] = useState(40);
  const [draftLower, setDraftLower] = useState(0);
  const [draftUpper, setDraftUpper] = useState(40);
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>("none");

  async function loadAnalysis(sync = false) {
    if (typeof sectionId !== "string") return;
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

  const theorySubjects = useMemo(() => data?.subjects.slice(0, 6) || [], [data]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];

    return data.students.map((student, originalIndex) => {
      const subjects: RowSubject[] = theorySubjects.map((subject) => {
        const score = student.subjects.find(
          (item) => item.subjectId === subject.id || item.code === subject.code
        );
        const mark = Number(score?.basicInternal || 0);
        const max = Number(score?.basicMax || 0);
        const pct = max > 0 ? (mark / max) * 100 : 0;
        return { ...subject, mark, max, pct, grade: tierForPct(pct) };
      });

      const total = subjects.reduce((sum, subject) => sum + subject.mark, 0);
      const totalMax = subjects.reduce((sum, subject) => sum + subject.max, 0);
      const average = subjects.length ? total / subjects.length : 0;
      const averageMax = subjects.length ? totalMax / subjects.length : 0;
      const overallPct = averageMax > 0 ? (average / averageMax) * 100 : 0;

      return {
        ...student,
        originalIndex,
        subjects,
        total,
        totalMax,
        average,
        averageMax,
        overallPct,
        tier: tierForPct(overallPct),
      };
    });
  }, [data, theorySubjects]);

  const orderedRows = useMemo(() => {
    if (sortDirection === "none") {
      return [...rows].sort((a, b) => a.originalIndex - b.originalIndex);
    }

    return [...rows].sort((a, b) =>
      sortDirection === "asc"
        ? a.average - b.average || a.name.localeCompare(b.name)
        : b.average - a.average || a.name.localeCompare(b.name)
    );
  }, [rows, sortDirection]);

  const filteredRows = useMemo(() => {
    const lo = Math.max(0, Math.min(40, Math.min(lower, upper)));
    const hi = Math.max(0, Math.min(40, Math.max(lower, upper)));
    return orderedRows.filter((row) => row.average >= lo && row.average <= hi);
  }, [orderedRows, lower, upper]);

  const filteredEnrollmentSet = useMemo(
    () => new Set(filteredRows.map((row) => row.enrollmentNo)),
    [filteredRows]
  );

  const tierCounts = useMemo(
    () =>
      rows.reduce((acc, row) => {
        acc[row.tier] = (acc[row.tier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [rows]
  );

  const classAveragePct = rows.length
    ? rows.reduce((sum, row) => sum + row.overallPct, 0) / rows.length
    : 0;
  const passRate = rows.length
    ? Math.round((rows.filter((row) => row.overallPct >= 40).length / rows.length) * 100)
    : 0;
  const topFive = [...rows]
    .sort((a, b) => b.overallPct - a.overallPct || a.originalIndex - b.originalIndex)
    .slice(0, 5);

  function applyFilters() {
    const nextLower = Math.max(0, Math.min(40, Math.min(draftLower, draftUpper)));
    const nextUpper = Math.max(0, Math.min(40, Math.max(draftLower, draftUpper)));
    setLower(nextLower);
    setUpper(nextUpper);
    setDraftLower(nextLower);
    setDraftUpper(nextUpper);
    setSortDirection(draftSortDirection);
  }

  function resetFilter() {
    setDraftLower(0);
    setDraftUpper(40);
    setLower(0);
    setUpper(40);
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
          <a
            className="is-active"
            href={typeof sectionId === "string" ? `/class-analysis/${sectionId}` : "/class-analysis"}
          >
            <BookOpen size={18} />Class Analysis
          </a>
          <a href="/subject-analysis"><GraduationCap size={18} />Subject Analysis</a>
        </nav>
        <RawDataButton sheetId={sheetId} />
        <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="analysis-page">
        <header className="analysis-topbar">
          <div className="analysis-title-row">
            <h1>Class / Section Analysis</h1>
            {computedAt && (
              <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="analysis-top-actions">
            <button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}>
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
        </header>

        {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

        {error && (
          <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>
            {error}
          </div>
        )}
        {loading && !data && (
          <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading overall analysis...</div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Class Average</p>
                <p className="mt-1 text-[28px] font-extrabold text-slate-900">{classAveragePct.toFixed(1)}%</p>
                <p className="mt-1 text-[10px] text-slate-400">across all 6 theory subjects</p>
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

            <section className="at-risk-filter rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="at-risk-filter-inner">
                <div className="at-risk-filter-title">
                  <h3>Filters</h3>
                  <p>Filter by average marks and sort.</p>
                </div>
                <div className="at-risk-filter-controls">
                  <label>
                    <span>Lower bound</span>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={draftLower}
                      onChange={(e) => setDraftLower(Math.min(40, Math.max(0, Number(e.target.value))))}
                    />
                  </label>
                  <label>
                    <span>Upper bound</span>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={draftUpper}
                      onChange={(e) => setDraftUpper(Math.min(40, Math.max(0, Number(e.target.value))))}
                    />
                  </label>
                  <label>
                    <span>Sort</span>
                    <select
                      value={draftSortDirection}
                      onChange={(e) => setDraftSortDirection(e.target.value as SortDirection)}
                    >
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
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Showing {filteredRows.length} of {rows.length} students.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      6 Theory Subjects
                    </span>
                    <button type="button" onClick={resetFilter} className="text-[10px] font-semibold text-[#4a35b3]">
                      Reset
                    </button>
                  </div>
                </div>

                <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
                  <table className="w-full table-fixed text-[10px] border-collapse">
                    <colgroup>
                      {sortDirection !== "none" && <col className="w-[5%]" />}
                      <col className="w-[18%]" />
                      {theorySubjects.map((subject) => <col key={subject.id} className="w-[7%]" />)}
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[8%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-200 text-slate-500">
                        {sortDirection !== "none" && <th className="text-center px-1 py-2">Rank</th>}
                        <th className="text-left px-2 py-2">Student</th>
                        {theorySubjects.map((subject) => (
                          <th key={subject.id} className="text-center px-1 py-2" title={subject.name}>
                            {subject.code || subject.name}
                          </th>
                        ))}
                        <th className="text-center px-1 py-2">Total</th>
                        <th className="text-center px-1 py-2">Average</th>
                        <th className="text-center px-1 py-2">%AGE</th>
                        <th className="text-center px-1 py-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedRows.map((row, index) => {
                        const visible = filteredEnrollmentSet.has(row.enrollmentNo);
                        return (
                          <tr
                            key={row.enrollmentNo}
                            style={{ display: visible ? "table-row" : "none" }}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                          >
                            {sortDirection !== "none" && (
                              <td className="text-center px-1 py-2 text-slate-500 tabular-nums">{index + 1}</td>
                            )}
                            <td className="px-2 py-2 font-medium text-slate-800 truncate" title={row.name}>
                              {row.name}
                            </td>
                            {row.subjects.map((subject) => (
                              <td
                                key={subject.id}
                                className="text-center px-1 py-2 tabular-nums font-medium"
                                style={{ color: TIER_COLORS[subject.grade] }}
                                title={`${formatMark(subject.mark)}/${formatMark(subject.max)} · ${subject.grade}`}
                              >
                                {formatMark(subject.mark)}
                              </td>
                            ))}
                            <td className="text-center px-1 py-2 font-semibold tabular-nums text-slate-900">
                              {formatMark(row.total)}
                            </td>
                            <td
                              className="text-center px-1 py-2 font-semibold tabular-nums"
                              style={{ color: TIER_COLORS[row.tier] }}
                              title={`Average out of ${formatMark(row.averageMax)}`}
                            >
                              {formatMark(row.average)}
                            </td>
                            <td
                              className="text-center px-1 py-2 font-semibold tabular-nums"
                              style={{ color: TIER_COLORS[row.tier] }}
                            >
                              {row.overallPct.toFixed(0)}%
                            </td>
                            <td className="text-center px-1 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${tierClass(row.tier)}`}
                              >
                                {row.tier}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="at-risk-side-stack">
                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Distribution</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">Overall performance across the six theory subjects.</p>
                  <div className="mt-3 space-y-2">
                    {["Excellent", "Good", "Needs Attention", "Critical Risk"].map((tier) => {
                      const count = tierCounts[tier] || 0;
                      const width = rows.length ? Math.max(2, (count / rows.length) * 100) : 0;
                      return (
                        <div key={tier}>
                          <div className="flex items-center justify-between text-[10px] text-slate-600">
                            <span>{tier}</span>
                            <span>{count}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: TIER_COLORS[tier] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Top Students</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Highest overall percentages.</p>
                  </div>
                  {topFive.map((row) => (
                    <div key={row.enrollmentNo} className="px-3 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-800 truncate">{row.name}</div>
                      <div className="text-sm font-medium" style={{ color: TIER_COLORS[row.tier] }}>
                        {row.overallPct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
