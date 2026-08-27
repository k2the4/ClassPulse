import { useEffect, useState } from "react";
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

interface OverallStudent {
  enrollmentNo: string;
  name: string;
  email: string;
  overallPct: number;
  overallAttendance: number;
  overallGrade: string;
  subjects: {
    subjectId: string;
    code: string;
    name: string;
    attendance: number;
    combined: number;
    basicInternal: number;
    grade: string;
  }[];
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

export default function SectionOverallPage() {
  const router = useRouter();
  const { sectionId } = router.query;

  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

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

  const tierCounts = data
    ? data.students.reduce(
        (acc, s) => {
          acc[s.overallGrade] = (acc[s.overallGrade] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

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
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Overall Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              Internal marks combined across all {data.subjects.length} subjects: {data.subjects.map((s) => s.name).join(", ")}.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-lg p-3 mb-6">
            Note: each subject's tier/moderation rules aren't configured yet, so this uses each subject's basic
            internal marks (as a percentage of that subject's own max) averaged across all subjects.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Students" value={data.students.length} />
            <StatCard label="Subjects" value={data.subjects.length} />
            <StatCard label="Class Average" value={`${data.classAverageOverallPct}%`} />
            <StatCard label="Excellent Students" value={tierCounts["Excellent"] || 0} positive />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <section className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-2 overflow-x-auto">
              <h3 className="font-medium text-gray-900 mb-4">All Students</h3>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Attendance</th>
                      <th className="py-2 pr-3">Overall %</th>
                      <th className="py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.students]
                      .sort((a, b) => b.overallPct - a.overallPct)
                      .map((s) => (
                        <tr key={s.enrollmentNo} className="border-b border-gray-50">
                          <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{s.name}</td>
                          <td className="py-2 pr-3 text-gray-500">{s.overallAttendance}%</td>
                          <td className="py-2 pr-3">{s.overallPct}%</td>
                          <td className="py-2">
                            <GradeBadge grade={s.overallGrade} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-medium text-gray-900 mb-4">Grade Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={["Excellent", "Good", "Needs Attention", "Critical Risk"].map((name) => ({
                    name,
                    count: tierCounts[name] || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {["Excellent", "Good", "Needs Attention", "Critical Risk"].map((name, i) => (
                      <Cell key={i} fill={TIER_COLORS[name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
