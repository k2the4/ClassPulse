import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

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
    midsem1: number;
    midsem2: number;
    combined: number;
    basicInternal: number;
    moderatedInternal: number;
    basicMax: number;
    grade: string;
  }[];
}

interface OverallData {
  subjects: { id: string; name: string; code: string }[];
  students: OverallStudent[];
  classAverageOverallPct: number;
}

export default function SectionStudentReportPage() {
  const router = useRouter();
  const { sectionId } = router.query;

  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState<string>("");

  async function loadAnalysis(sync = false) {
    if (!sectionId || typeof sectionId !== "string") return;
    if (sync) setSyncing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}/overall${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load student report");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
      if (json.data?.students?.[0]) setSelectedEnrollment(json.data.students[0].enrollmentNo);
    } catch (e: any) {
      setError(e.message || "Failed to load student report");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const students = data?.students || [];

  const filteredList = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.enrollmentNo.includes(q));
  }, [students, search]);

  const selected = students.find((s) => s.enrollmentNo === selectedEnrollment);

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
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading student report...</div>}

      {data && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Student Report</h2>
            <p className="text-sm text-gray-500 mt-1">Full report card across all {data.subjects.length} subjects for one student.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-1">
              <input
                type="text"
                placeholder="Search by name or enrollment no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
              />
              <div className="max-h-[600px] overflow-y-auto space-y-1">
                {filteredList.map((s) => (
                  <button
                    key={s.enrollmentNo}
                    onClick={() => setSelectedEnrollment(s.enrollmentNo)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg ${
                      s.enrollmentNo === selectedEnrollment ? "bg-gray-900 text-white" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {s.name}
                    <span className={`block text-xs ${s.enrollmentNo === selectedEnrollment ? "text-gray-300" : "text-gray-400"}`}>
                      {s.enrollmentNo} · {s.overallGrade}
                    </span>
                  </button>
                ))}
                {filteredList.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No matches.</p>}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-2">
              {!selected && <p className="text-sm text-gray-400">Select a student to see their report card.</p>}
              {selected && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                    <GradeBadge grade={selected.overallGrade} />
                  </div>
                  <p className="text-sm text-gray-400 mb-6">
                    {selected.enrollmentNo} · {selected.email || "no email on file"}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <StatCard label="Overall Attendance" value={`${selected.overallAttendance}%`} />
                    <StatCard label="Overall Internal %" value={`${selected.overallPct}%`} />
                    <StatCard label="Overall Grade" value={selected.overallGrade} />
                  </div>

                  <h4 className="text-sm font-medium text-gray-900 mb-3">Per-Subject Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-100">
                          <th className="py-2 pr-3">Subject</th>
                          <th className="py-2 pr-3">Attendance</th>
                          <th className="py-2 pr-3">Midsem 1</th>
                          <th className="py-2 pr-3">Midsem 2</th>
                          <th className="py-2 pr-3">Combined</th>
                          <th className="py-2 pr-3">Internal (Basic)</th>
                          <th className="py-2">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.subjects.map((sub) => (
                          <tr key={sub.subjectId} className="border-b border-gray-50">
                            <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{sub.name}</td>
                            <td className="py-2 pr-3 text-gray-500">{sub.attendance}%</td>
                            <td className="py-2 pr-3 text-gray-500">{sub.midsem1}</td>
                            <td className="py-2 pr-3 text-gray-500">{sub.midsem2}</td>
                            <td className="py-2 pr-3">{sub.combined}</td>
                            <td className="py-2 pr-3">
                              {sub.basicInternal}/{sub.basicMax}
                            </td>
                            <td className="py-2">
                              <GradeBadge grade={sub.grade} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
