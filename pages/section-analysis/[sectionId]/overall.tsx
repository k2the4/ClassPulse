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
  Cell,
} from "recharts";

import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton, StatCard, GradeBadge } from "../../../components/AnalysisWidgets";

interface OverallSubject {
  subjectId: string;
  code: string;
  name: string;
  attendance: number;
  combined: number;
  basicInternal: number;
  grade: string;
}

interface OverallStudent {
  enrollmentNo: string;
  name: string;
  email: string;
  overallPct: number;
  overallAttendance: number;
  overallGrade: string;
  subjects: OverallSubject[];
}

interface OverallData {
  subjects: { id: string; name: string; code: string }[];
  students: OverallStudent[];
  classAverageOverallPct: number;
}

const TIER_COLORS: Record<string, string> = {
  Excellent: "#10b981",
  Good: "#3b82f6",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

const THEORY_SUBJECT_LIMIT = 6;

function isLabSubject(subject: { name: string; code: string }) {
  return /(^|[-_\s])LAB($|[-_\s])/i.test(`${subject.code} ${subject.name}`);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function markClass(grade: string) {
  switch (grade) {
    case "Excellent":
      return "text-emerald-600";
    case "Good":
      return "text-blue-600";
    case "Needs Attention":
      return "text-amber-500";
    case "Critical Risk":
      return "text-red-500";
    default:
      return "text-gray-700";
  }
}

export default function SectionOverallPage() {
  const router = useRouter();
  const { sectionId } = router.query;

  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [lowerBound, setLowerBound] = useState("0");
  const [upperBound, setUpperBound] = useState("40");
  const [sort, setSort] = useState<"none" | "high" | "low">("none");

  async function loadAnalysis(sync = false) {
    if (!sectionId || typeof sectionId !== "string") return;
    if (sync) setSyncing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/analysis/section/${sectionId}/overall${sync ? "?sync=1" : ""}`);
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

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const theorySubjects = useMemo(() => {
    if (!data) return [];

    // Keep the existing database/sheet ordering, remove lab subjects, and
    // use only the six theory subjects required by Class Analysis.
    return data.subjects.filter((subject) => !isLabSubject(subject)).slice(0, THEORY_SUBJECT_LIMIT);
  }, [data]);

  const studentsWithAverage = useMemo(() => {
    if (!data) return [];

    return data.students.map((student) => {
      const theory = theorySubjects
        .map((subject) => student.subjects.find((s) => s.subjectId === subject.id || s.code === subject.code))
        .filter((subject): subject is OverallSubject => Boolean(subject));

      const average = theory.length
        ? round1(theory.reduce((sum, subject) => sum + Number(subject.basicInternal || 0), 0) / theory.length)
        : 0;

      return { ...student, theorySubjects: theory, average };
    });
  }, [data, theorySubjects]);

  const filteredStudents = useMemo(() => {
    const lower = Number(lowerBound);
    const upper = Number(upperBound);
    const min = Number.isFinite(lower) ? lower : 0;
    const max = Number.isFinite(upper) ? upper : 40;

    const result = studentsWithAverage.filter((student) => student.average >= min && student.average <= max);

    if (sort === "high") return [...result].sort((a, b) => b.average - a.average);
    if (sort === "low") return [...result].sort((a, b) => a.average - b.average);
    return result;
  }, [studentsWithAverage, lowerBound, upperBound, sort]);

  const classAverage = useMemo(() => {
    if (!studentsWithAverage.length) return 0;
    return round1(studentsWithAverage.reduce((sum, student) => sum + student.average, 0) / studentsWithAverage.length);
  }, [studentsWithAverage]);

  const classAveragePct = round1((classAverage / 50) * 100);

  const tierCounts = filteredStudents.reduce(
    (acc, student) => {
      acc[student.overallGrade] = (acc[student.overallGrade] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function resetFilters() {
    setLowerBound("0");
    setUpperBound("40");
    setSort("none");
  }

  return (
    <div className="min-h-screen max-w-[1700px] mx-auto px-8 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Class / Section Analysis</h1>
          {computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          <RawDataButton sheetId={sheetId} />
          <button onClick={() => loadAnalysis(true)} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading overall analysis...</div>}

      {data && (
        <>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Overall Analysis</h2>
              <p className="text-sm text-gray-500 mt-1">Performance across the six theory subjects.</p>
            </div>
            <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
              {theorySubjects.length} Theory Subjects
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button className="text-sm bg-[#3d2a91] text-white rounded-lg px-5 py-2.5 shadow-sm">Filter</button>
          </div>

          <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="mb-3">
              <h3 className="font-medium text-gray-900">Filter</h3>
              <p className="text-xs text-gray-500 mt-1">Filter students using their average internal marks across the six theory subjects.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs text-gray-500">
                Lower bound
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={lowerBound}
                  onChange={(e) => setLowerBound(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                Upper bound
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={upperBound}
                  onChange={(e) => setUpperBound(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "none" | "high" | "low")}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="none">No sort</option>
                  <option value="high">Average: High to Low</option>
                  <option value="low">Average: Low to High</option>
                </select>
              </label>
              <button onClick={resetFilters} className="text-sm border border-gray-200 rounded-lg px-4 py-2 bg-white hover:bg-gray-50">
                Reset
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Class Average" value={`${classAverage} / 50`} />
            <StatCard label="Students" value={filteredStudents.length} />
            <StatCard label="Average Percentage" value={`${classAveragePct}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <section className="bg-white rounded-2xl border border-gray-100 p-5 lg:col-span-2 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Filtered Students</h3>
                  <p className="text-xs text-gray-500 mt-1">Showing {filteredStudents.length} of {studentsWithAverage.length} students.</p>
                </div>
                <span className="text-xs text-gray-500">{theorySubjects.length} Theory Subjects</span>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      {sort !== "none" && <th className="py-2 pr-3">Rank</th>}
                      <th className="py-2 pr-3">Student</th>
                      {theorySubjects.map((subject) => (
                        <th key={subject.id} className="py-2 px-2 text-center">{subject.code}</th>
                      ))}
                      <th className="py-2 px-2 text-center">Average</th>
                      <th className="py-2 px-2 text-center">%AGE</th>
                      <th className="py-2 pl-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const subjectByCode = new Map(student.theorySubjects.map((subject) => [subject.code, subject]));
                      return (
                        <tr key={student.enrollmentNo} className="border-b border-gray-50">
                          {sort !== "none" && <td className="py-2 pr-3 text-gray-500">{index + 1}</td>}
                          <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{student.name}</td>
                          {theorySubjects.map((subject) => {
                            const mark = subjectByCode.get(subject.code);
                            return (
                              <td key={subject.id} className={`py-2 px-2 text-center font-medium ${markClass(mark?.grade || "")}`}>
                                {mark ? round1(Number(mark.basicInternal || 0)) : 0}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center font-semibold text-gray-900">{student.average}</td>
                          <td className="py-2 px-2 text-center text-gray-500">{round1((student.average / 50) * 100)}%</td>
                          <td className="py-2 pl-2"><GradeBadge grade={student.overallGrade} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-medium text-gray-900 mb-1">Distribution</h3>
                <p className="text-xs text-gray-500 mb-4">Overall performance of the filtered students.</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={["Excellent", "Good", "Needs Attention", "Critical Risk"].map((name) => ({ name, count: tierCounts[name] || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {["Excellent", "Good", "Needs Attention", "Critical Risk"].map((name, index) => (
                        <Cell key={name} fill={TIER_COLORS[name]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-medium text-gray-900 mb-1">Top Students</h3>
                <p className="text-xs text-gray-500 mb-3">Highest average internal marks.</p>
                {[...studentsWithAverage].sort((a, b) => b.average - a.average).slice(0, 5).map((student) => (
                  <div key={student.enrollmentNo} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-800">{student.name}</span>
                    <span className="text-sm font-medium text-emerald-600">{student.average}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
