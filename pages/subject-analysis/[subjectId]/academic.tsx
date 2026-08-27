import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton, StatCard, GradeBadge, RankedList } from "../../../components/AnalysisWidgets";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ExamKey = "midsem1" | "midsem2" | "combined" | "max";

const TIER_COLORS: Record<string, string> = {
  Excellent: "#10b981",
  Good: "#3b82f6",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

const MAX_PER_EXAM = 30; // confirmed against real sheet data (see chat history)

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2);
}

function gradeFor(marks: number, max: number): string {
  if (max <= 0) return "Critical Risk";
  const pct = (marks / max) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
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
  const [sortDir, setSortDir] = useState<"desc" | "asc" | "none">("desc");

  const [filterExam, setFilterExam] = useState<"midsem1" | "midsem2" | "combined">("combined");
  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(30);

  async function loadAnalysis() {
    if (!subjectId || typeof subjectId !== "string") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load academic analysis");
    } finally {
      setLoading(false);
    }
  }

  async function syncAnalysis() {
    if (!subjectId || typeof subjectId !== "string") return;
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}?sync=1`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to sync analysis");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to sync analysis");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const students = data?.students || [];

  function useSingleExamStats(examKey: "midsem1" | "midsem2") {
    return useMemo(() => {
      const rows = students.map((s: any) => ({
        enrollmentNo: s.enrollmentNo,
        name: s.name,
        marks: examKey === "midsem1" ? s.midsem.first : s.midsem.second,
      }));

      const marksList = rows.map((r) => r.marks as number);
      const classAverage = marksList.length ? round1(marksList.reduce((a, b) => a + b, 0) / marksList.length) : 0;
      const classMedian = median(marksList);
      const highest = marksList.length ? Math.max(...marksList) : 0;
      const passRate = marksList.length
        ? Math.round((rows.filter((r) => r.marks >= MAX_PER_EXAM * 0.4).length / marksList.length) * 100)
        : 0;

      const tiers = { Excellent: 0, Good: 0, "Needs Attention": 0, "Critical Risk": 0 } as Record<string, number>;
      rows.forEach((r) => tiers[gradeFor(r.marks, MAX_PER_EXAM)]++);

      const sorted = [...rows].sort((a, b) => b.marks - a.marks);

      return { rows, classAverage, classMedian, highest, passRate, tiers, sorted };
    }, [students, examKey]);
  }

  const midsem1Stats = useSingleExamStats("midsem1");
  const midsem2Stats = useSingleExamStats("midsem2");

  function renderSingleExamView(examLabel: string, stats: ReturnType<typeof useSingleExamStats>) {
    const pieData = Object.entries(stats.tiers).map(([name, value]) => ({ name, value, color: TIER_COLORS[name] }));

    return (
      <>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{examLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">Marks, class stats, and top/at-risk students for {examLabel}.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Data Sheet</h3>
            <p className="text-xs text-gray-400 mb-3">Pass mark: {Math.round(MAX_PER_EXAM * 0.4)}/{MAX_PER_EXAM} (40%)</p>
            <div className="max-h-[650px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Marks</th>
                    <th className="py-2 pr-3">%age</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rows.map((r) => {
                    const pct = Math.round((r.marks / MAX_PER_EXAM) * 100);
                    const pass = r.marks >= MAX_PER_EXAM * 0.4;
                    return (
                      <tr key={r.enrollmentNo} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td>
                        <td className={`py-2 pr-3 ${pass ? "text-emerald-600" : "text-red-500"}`}>{r.marks}</td>
                        <td className="py-2 pr-3">{pct}%</td>
                        <td className="py-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {pass ? "Pass" : "Fail"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Class Average" value={stats.classAverage} />
              <StatCard label="Class Median" value={stats.classMedian} />
              <StatCard label="Highest Score" value={stats.highest} />
              <StatCard label="Pass Rate" value={`${stats.passRate}%`} />
            </div>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Performance Tier</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(stats.tiers).map(([name, count]) => (
                  <div key={name} className="rounded-lg p-3 text-center" style={{ backgroundColor: `${TIER_COLORS[name]}22` }}>
                    <p className="text-xs text-gray-600">{name}</p>
                    <p className="text-lg font-semibold" style={{ color: TIER_COLORS[name] }}>
                      {count}
                    </p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList title="Top 5 Highest Scorers" positive items={stats.sorted.slice(0, 5).map((r) => ({ name: r.name, marks: r.marks }))} />
              </section>
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList
                  title="Bottom 5 At-Risk Students"
                  positive={false}
                  items={[...stats.sorted].reverse().slice(0, 5).map((r) => ({ name: r.name, marks: r.marks }))}
                />
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  const combinedRows = useMemo(() => {
    return students.map((s: any) => {
      const values: Record<ExamKey, number> = {
        midsem1: s.midsem.first,
        midsem2: s.midsem.second,
        combined: s.midsem.combined,
        max: s.midsem.max,
      };
      return {
        enrollmentNo: s.enrollmentNo,
        name: s.name,
        midsem1: s.midsem.first,
        midsem2: s.midsem.second,
        combined: s.midsem.combined,
        max: s.midsem.max,
        grade: gradeFor(values[gradeBasis], MAX_PER_EXAM),
        sortValue: values[gradeBasis],
      };
    });
  }, [students, gradeBasis]);

  const sortedCombinedRows = useMemo(() => {
    if (sortDir === "none") return combinedRows;
    const sorted = [...combinedRows].sort((a, b) => a.sortValue - b.sortValue);
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [combinedRows, sortDir]);

  const combinedGradeCounts = useMemo(() => {
    const counts = { Excellent: 0, Good: 0, "Needs Attention": 0, "Critical Risk": 0 } as Record<string, number>;
    combinedRows.forEach((r) => counts[r.grade]++);
    return counts;
  }, [combinedRows]);

  const combinedTop5 = useMemo(() => [...combinedRows].sort((a, b) => b.sortValue - a.sortValue).slice(0, 5), [combinedRows]);
  const combinedBottom5 = useMemo(() => [...combinedRows].sort((a, b) => a.sortValue - b.sortValue).slice(0, 5), [combinedRows]);

  const filteredSummaryRows = useMemo(() => {
    return students
      .map((s: any) => {
        const value = filterExam === "midsem1" ? s.midsem.first : filterExam === "midsem2" ? s.midsem.second : s.midsem.combined;
        return { enrollmentNo: s.enrollmentNo, name: s.name, marks: value };
      })
      .filter((r: any) => r.marks >= lowerBound && r.marks <= upperBound);
  }, [students, filterExam, lowerBound, upperBound]);

  const summaryStats = useMemo(() => {
    const combinedValues = students.map((s: any) => s.midsem.combined);
    const overallAverage = combinedValues.length ? round1(combinedValues.reduce((a: number, b: number) => a + b, 0) / combinedValues.length) : 0;
    const highest = combinedValues.length ? Math.max(...combinedValues) : 0;
    const lowest = combinedValues.length ? Math.min(...combinedValues) : 0;
    const passCount = combinedValues.filter((v: number) => v >= MAX_PER_EXAM * 0.4).length;
    const passRate = combinedValues.length ? Math.round((passCount / combinedValues.length) * 100) : 0;

    const midsem1Values = students.map((s: any) => s.midsem.first);
    const midsem2Values = students.map((s: any) => s.midsem.second);
    const midsem1Avg = midsem1Values.length ? round1(midsem1Values.reduce((a: number, b: number) => a + b, 0) / midsem1Values.length) : 0;
    const midsem2Avg = midsem2Values.length ? round1(midsem2Values.reduce((a: number, b: number) => a + b, 0) / midsem2Values.length) : 0;

    const changes = students
      .map((s: any) => ({ name: s.name, change: round1(s.midsem.second - s.midsem.first) }))
      .sort((a, b) => b.change - a.change);

    return {
      overallAverage,
      highest,
      lowest,
      passRate,
      midsem1Avg,
      midsem2Avg,
      increases: changes.slice(0, 5),
      decreases: [...changes].reverse().slice(0, 5),
    };
  }, [students]);

  return (
    <div className="min-h-screen max-w-[1700px] mx-auto px-8 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Subject Analysis</h1>
          {computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          <RawDataButton sheetId={sheetId} />
          <button onClick={syncAnalysis} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}

      <div className="flex gap-2 mb-8 flex-wrap">
        {(
          [
            { key: "midsem1", label: "Midsem 1" },
            { key: "midsem2", label: "Midsem 2" },
            { key: "combined", label: "Combined" },
            { key: "summary", label: "Summary" },
          ] as { key: AcademicView; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`text-sm px-4 py-2 rounded-lg font-medium ${
              view === tab.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading academic analysis...</div>}

      {data && view === "midsem1" && renderSingleExamView("Midsem 1", midsem1Stats)}
      {data && view === "midsem2" && renderSingleExamView("Midsem 2", midsem2Stats)}

      {data && view === "combined" && (
        <>
          <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Midsem Combined</h2>
              <p className="text-sm text-gray-500 mt-1">Choose which numbers grade students, then sort to see who's ahead or behind.</p>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade / Sort By</label>
                <select value={gradeBasis} onChange={(e) => setGradeBasis(e.target.value as ExamKey)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="midsem1">Midsem 1</option>
                  <option value="midsem2">Midsem 2</option>
                  <option value="combined">Combined (average)</option>
                  <option value="max">Max (better of the two)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "desc" | "asc" | "none")} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="none">No Sort (Enrollment Order)</option>
                  <option value="desc">Highest to Lowest</option>
                  <option value="asc">Lowest to Highest</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-medium text-gray-900 mb-4">All Students</h3>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      {sortDir !== "none" && <th className="py-2 pr-3 w-10">Rank</th>}
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">1st</th>
                      <th className="py-2 pr-3">2nd</th>
                      <th className="py-2 pr-3">Combined</th>
                      <th className="py-2 pr-3">Max</th>
                      <th className="py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCombinedRows.map((r, i) => (
                      <tr key={r.enrollmentNo} className="border-b border-gray-50">
                        {sortDir !== "none" && <td className="py-2 pr-3 text-gray-400 font-medium">{i + 1}</td>}
                        <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.midsem1}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.midsem2}</td>
                        <td className="py-2 pr-3">{r.combined}</td>
                        <td className="py-2 pr-3">{r.max}</td>
                        <td className="py-2">
                          <GradeBadge grade={r.grade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Grade Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Object.entries(combinedGradeCounts).map(([name, count]) => ({ name, count }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {Object.keys(combinedGradeCounts).map((name, i) => (
                        <Cell key={i} fill={TIER_COLORS[name]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList title="Top 5 Highest Scorers" positive items={combinedTop5.map((r) => ({ name: r.name, marks: r.sortValue }))} />
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList title="Bottom 5" positive={false} items={combinedBottom5.map((r) => ({ name: r.name, marks: r.sortValue }))} />
              </section>
            </div>
          </div>
        </>
      )}

      {data && view === "summary" && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Academic Summary</h2>
            <p className="text-sm text-gray-500 mt-1">Filter students by marks range, and see who's improving.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Filter Criteria</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Exam</label>
                    <select value={filterExam} onChange={(e) => setFilterExam(e.target.value as any)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="midsem1">Midsem 1</option>
                      <option value="midsem2">Midsem 2</option>
                      <option value="combined">Combined</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Lower Bound</label>
                    <input type="number" value={lowerBound} onChange={(e) => setLowerBound(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Upper Bound</label>
                    <input type="number" value={upperBound} onChange={(e) => setUpperBound(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Filtered Students <span className="text-gray-400 font-normal">({filteredSummaryRows.length})</span>
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3">Enrollment</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaryRows.map((r: any) => (
                      <tr key={r.enrollmentNo} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-500">{r.enrollmentNo}</td>
                        <td className="py-2 pr-3 text-gray-900">{r.name}</td>
                        <td className="py-2">{r.marks}</td>
                      </tr>
                    ))}
                    {filteredSummaryRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-400">
                          No students match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Overall Class Average" value={summaryStats.overallAverage} />
                <StatCard label="Highest Combined Score" value={summaryStats.highest} />
                <StatCard label="Lowest Combined Score" value={summaryStats.lowest} />
                <StatCard label="Overall Pass Rate" value={`${summaryStats.passRate}%`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Midsem 1 Average" value={summaryStats.midsem1Avg} />
                <StatCard label="Midsem 2 Average" value={summaryStats.midsem2Avg} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <section className="bg-white rounded-2xl border border-gray-100 p-6">
                  <RankedList title="Marks Increase (Top 5)" positive items={summaryStats.increases.map((s) => ({ name: s.name, marks: s.change }))} />
                </section>
                <section className="bg-white rounded-2xl border border-gray-100 p-6">
                  <RankedList title="Marks Decrease (Top 5)" positive={false} items={summaryStats.decreases.map((s) => ({ name: s.name, marks: s.change }))} />
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
