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

import AnalysisNav from "../../../components/AnalysisNav";
import { SectionAnalysis } from "../../../lib/analysisClass";
import { RawDataButton, StatCard, GradeBadge, RankedList } from "../../../components/AnalysisWidgets";

type AcademicView = "midsem1" | "midsem2" | "combined" | "summary";
type ExamKey = "midsem1" | "midsem2" | "combined" | "max";

const TIER_COLORS: Record<string, string> = {
  Excellent: "#10b981",
  Good: "#3b82f6",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// Grades a single exam score against its own max, same thresholds used
// throughout the app (Excellent/Good/Needs Attention/Critical Risk).
function gradeFor(marks: number, max: number): string {
  if (max <= 0) return "Critical Risk";
  const pct = (marks / max) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}

export default function AcademicPage() {
  const router = useRouter();
  const { sectionId } = router.query;

  const [view, setView] = useState<AcademicView>("midsem1");

  const [data, setData] = useState<SectionAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  // Combined view controls
  const [gradeBasis, setGradeBasis] = useState<ExamKey>("combined");
  const [sortDir, setSortDir] = useState<"desc" | "asc" | "none">("desc");

  // Summary (filter) view controls
  const [filterExam, setFilterExam] = useState<"midsem1" | "midsem2" | "both">("both");
  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(100);

  async function loadAnalysis() {
    if (!sectionId || typeof sectionId !== "string") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}`);
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
    if (!sectionId || typeof sectionId !== "string") return;
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}?sync=1`);
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
  }, [sectionId]);

  const students = data?.students || [];

  // ---------- Single-exam view (MidSem 1 / MidSem 2) ----------
  function useSingleExamStats(examKey: "midsem1" | "midsem2") {
    return useMemo(() => {
      const rows = students
        .map((s: any) => ({
          enrollmentNo: s.enrollmentNo,
          name: s.name,
          marks: examKey === "midsem1" ? s.examMarks.midsem1 : s.examMarks.midsem2,
          max: examKey === "midsem1" ? s.examMarks.midsem1Max : s.examMarks.midsem2Max,
          subjects: examKey === "midsem1" ? s.examMarks.midsem1Subjects : s.examMarks.midsem2Subjects,
        }))
        .filter((r: any) => r.marks !== null);

      const marksList = rows.map((r: any) => r.marks as number);
      const max = rows[0]?.max || 1;
      const subjectCodes: string[] = rows[0]?.subjects?.map((s: any) => s.code) || [];

      const classAverage = marksList.length ? round1(marksList.reduce((a, b) => a + b, 0) / marksList.length) : 0;
      const classMedian = median(marksList);
      const highest = marksList.length ? Math.max(...marksList) : 0;
      // Pass = at least 40% of the exam's total max marks (consistent with the
      // 12/30-per-subject rule, scaled up across however many subjects this exam has).
      const passRate = marksList.length
        ? Math.round((rows.filter((r: any) => r.marks >= max * 0.4).length / marksList.length) * 100)
        : 0;

      const tiers = { Excellent: 0, Good: 0, "Needs Attention": 0, "Critical Risk": 0 } as Record<string, number>;
      rows.forEach((r: any) => {
        tiers[gradeFor(r.marks, max)]++;
      });

      const sorted = [...rows].sort((a: any, b: any) => b.marks - a.marks);

      return { rows, max, subjectCodes, classAverage, classMedian, highest, passRate, tiers, sorted };
    }, [students, examKey]);
  }

  const midsem1Stats = useSingleExamStats("midsem1");
  const midsem2Stats = useSingleExamStats("midsem2");

  function renderSingleExamView(examLabel: string, stats: ReturnType<typeof useSingleExamStats>) {
    const pieData = Object.entries(stats.tiers).map(([name, value]) => ({
      name,
      value,
      color: TIER_COLORS[name],
    }));

    return (
      <>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{examLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">Marks, class stats, and top/at-risk students for {examLabel}.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Data Sheet</h3>
            <p className="text-xs text-gray-400 mb-3">Pass mark per subject: 12/30 (40%)</p>
            <div className="max-h-[650px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3 sticky left-0 bg-white">Name</th>
                    {stats.subjectCodes.map((code: string) => (
                      <th key={code} className="py-2 pr-3 whitespace-nowrap">
                        {code}
                      </th>
                    ))}
                    <th className="py-2 pr-3 whitespace-nowrap">Total</th>
                    <th className="py-2">%age</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rows.map((r: any) => {
                    const pct = stats.max > 0 ? Math.round((r.marks / stats.max) * 100) : 0;
                    return (
                      <tr key={r.enrollmentNo} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-900 whitespace-nowrap sticky left-0 bg-white">
                          {r.name}
                        </td>
                        {(r.subjects || []).map((s: any) => (
                          <td
                            key={s.code}
                            className={`py-2 pr-3 ${
                              s.marks === null ? "text-gray-400" : s.pass ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {s.marks === null ? "—" : s.marks}
                          </td>
                        ))}
                        <td className="py-2 pr-3 font-medium text-gray-900">{r.marks}</td>
                        <td className="py-2">{pct}%</td>
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
                  <div
                    key={name}
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: `${TIER_COLORS[name]}22` }}
                  >
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
                <RankedList
                  title="Top 5 Highest Scorers"
                  positive
                  items={stats.sorted.slice(0, 5).map((r: any) => ({ name: r.name, marks: r.marks }))}
                />
              </section>
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList
                  title="Bottom 5 At-Risk Students"
                  positive={false}
                  items={[...stats.sorted]
                    .reverse()
                    .slice(0, 5)
                    .map((r: any) => ({ name: r.name, marks: r.marks }))}
                />
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---------- Combined view ----------
  const combinedRows = useMemo(() => {
    return students.map((s: any) => {
      const values: Record<ExamKey, number> = {
        midsem1: s.examMarks.midsem1 ?? 0,
        midsem2: s.examMarks.midsem2 ?? 0,
        combined: s.examMarks.combined,
        max: s.examMarks.max,
      };
      const basisValue = values[gradeBasis];
      const basisMax = Math.max(s.examMarks.midsem1Max, s.examMarks.midsem2Max) || 1;
      return {
        enrollmentNo: s.enrollmentNo,
        name: s.name,
        email: s.email,
        midsem1: s.examMarks.midsem1,
        midsem2: s.examMarks.midsem2,
        combined: s.examMarks.combined,
        max: s.examMarks.max,
        grade: gradeFor(basisValue, basisMax),
        sortValue: basisValue,
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

  const combinedTop5 = useMemo(
    () => [...combinedRows].sort((a, b) => b.sortValue - a.sortValue).slice(0, 5),
    [combinedRows]
  );

  const combinedBottom5 = useMemo(
    () => [...combinedRows].sort((a, b) => a.sortValue - b.sortValue).slice(0, 5),
    [combinedRows]
  );

  // ---------- Summary (filter) view ----------
  // Per-subject filter: for each student, check every subject's mark (in
  // whichever exam(s) are selected) against the bounds. One result row per
  // matching student+subject+exam — a student can appear more than once if
  // they fall in range on multiple subjects.
  const filteredSummaryRows = useMemo(() => {
    const rows: { enrollmentNo: string; name: string; exam: string; subject: string; marks: number }[] = [];

    students.forEach((s: any) => {
      const examsToCheck: { label: string; subjects: any[] }[] = [];
      if (filterExam === "midsem1" || filterExam === "both") {
        examsToCheck.push({ label: "Midsem 1", subjects: s.examMarks.midsem1Subjects || [] });
      }
      if (filterExam === "midsem2" || filterExam === "both") {
        examsToCheck.push({ label: "Midsem 2", subjects: s.examMarks.midsem2Subjects || [] });
      }

      examsToCheck.forEach((exam) => {
        exam.subjects.forEach((subj: any) => {
          if (subj.marks === null) return;
          if (subj.marks >= lowerBound && subj.marks <= upperBound) {
            rows.push({
              enrollmentNo: s.enrollmentNo,
              name: s.name,
              exam: exam.label,
              subject: subj.code,
              marks: subj.marks,
            });
          }
        });
      });
    });

    return rows;
  }, [students, filterExam, lowerBound, upperBound]);

  const summaryStats = useMemo(() => {
    const combinedValues = students.map((s: any) => s.examMarks.combined);
    const overallAverage = combinedValues.length
      ? round1(combinedValues.reduce((a: number, b: number) => a + b, 0) / combinedValues.length)
      : 0;
    const highest = combinedValues.length ? Math.max(...combinedValues) : 0;
    const lowest = combinedValues.length ? Math.min(...combinedValues) : 0;
    const passCount = combinedValues.filter((v: number) => v > 0).length;
    const passRate = combinedValues.length ? Math.round((passCount / combinedValues.length) * 100) : 0;

    const midsem1Values = students.map((s: any) => s.examMarks.midsem1 ?? 0);
    const midsem2Values = students.map((s: any) => s.examMarks.midsem2 ?? 0);
    const midsem1Avg = midsem1Values.length
      ? round1(midsem1Values.reduce((a: number, b: number) => a + b, 0) / midsem1Values.length)
      : 0;
    const midsem2Avg = midsem2Values.length
      ? round1(midsem2Values.reduce((a: number, b: number) => a + b, 0) / midsem2Values.length)
      : 0;

    const changes = students
      .map((s: any) => ({
        name: s.name,
        change: round1((s.examMarks.midsem2 ?? 0) - (s.examMarks.midsem1 ?? 0)),
      }))
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
          <h1 className="text-lg font-semibold text-gray-900">Class / Section Analysis</h1>
          {computedAt && (
            <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RawDataButton sheetId={sheetId} />
          <button
            onClick={syncAnalysis}
            disabled={syncing}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

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
              <p className="text-sm text-gray-500 mt-1">
                Choose which numbers grade students, then sort to see who's ahead or behind.
              </p>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade / Sort By</label>
                <select
                  value={gradeBasis}
                  onChange={(e) => setGradeBasis(e.target.value as ExamKey)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="midsem1">Midsem 1</option>
                  <option value="midsem2">Midsem 2</option>
                  <option value="combined">Combined (average)</option>
                  <option value="max">Max (better of the two)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "desc" | "asc" | "none")}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
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
                        {sortDir !== "none" && (
                          <td className="py-2 pr-3 text-gray-400 font-medium">{i + 1}</td>
                        )}
                        <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.midsem1 ?? "—"}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.midsem2 ?? "—"}</td>
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
                  <BarChart
                    data={Object.entries(combinedGradeCounts).map(([name, count]) => ({ name, count }))}
                  >
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
                <RankedList
                  title="Top 5 Highest Scorers"
                  positive
                  items={combinedTop5.map((r) => ({ name: r.name, marks: r.sortValue }))}
                />
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <RankedList
                  title="Bottom 5"
                  positive={false}
                  items={combinedBottom5.map((r) => ({ name: r.name, marks: r.sortValue }))}
                />
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
                    <select
                      value={filterExam}
                      onChange={(e) => setFilterExam(e.target.value as any)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="both">Both Midsem 1 &amp; 2</option>
                      <option value="midsem1">Midsem 1</option>
                      <option value="midsem2">Midsem 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Lower Bound</label>
                    <input
                      type="number"
                      value={lowerBound}
                      onChange={(e) => setLowerBound(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Upper Bound</label>
                    <input
                      type="number"
                      value={upperBound}
                      onChange={(e) => setUpperBound(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Filtered Results <span className="text-gray-400 font-normal">({filteredSummaryRows.length})</span>
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3">Exam</th>
                      <th className="py-2">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaryRows.map((r, i) => (
                      <tr key={`${r.enrollmentNo}-${r.exam}-${r.subject}-${i}`} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-900">{r.name}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.subject}</td>
                        <td className="py-2 pr-3 text-gray-500">{r.exam}</td>
                        <td className="py-2">{r.marks}</td>
                      </tr>
                    ))}
                    {filteredSummaryRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-400">
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
                  <RankedList
                    title="Marks Decrease (Top 5)"
                    positive={false}
                    items={summaryStats.decreases.map((s) => ({ name: s.name, marks: s.change }))}
                  />
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
