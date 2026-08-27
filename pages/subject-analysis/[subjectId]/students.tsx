import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton, GradeBadge } from "../../../components/AnalysisWidgets";

function round1(n: number) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function shortMonth(month: string) {
  return month.replace(/\s*20\d{2}/, "");
}

export default function SubjectStudentReportPage() {
  const router = useRouter();
  const { subjectId } = router.query;

  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState<string>("");

  async function loadAnalysis() {
    if (!subjectId || typeof subjectId !== "string") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}`);
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

  const filteredList = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter((s: any) => s.name.toLowerCase().includes(q) || s.enrollmentNo.includes(q));
  }, [students, search]);

  const selected: any = students.find((s: any) => s.enrollmentNo === selectedEnrollment);

  const assessmentRows = selected ? [
    { label: "Assignment", value: selected.assignment?.submitted ?? 0, max: selected.assignment?.total ?? 0, raw: `${selected.assignment?.submitted ?? 0}/${selected.assignment?.total ?? 0}` },
    { label: "Presentation", value: selected.presentation ?? 0, max: 10, raw: `${selected.presentation ?? 0}/10` },
    { label: "Midsem 1", value: selected.midsem?.first ?? 0, max: 30, raw: `${selected.midsem?.first ?? 0}/30` },
    { label: "Midsem 2", value: selected.midsem?.second ?? 0, max: 30, raw: `${selected.midsem?.second ?? 0}/30` },
    { label: "Midsem Combined", value: selected.midsem?.combined ?? 0, max: 30, raw: `${selected.midsem?.combined ?? 0}/30` },
  ] : [];

  const basicMarks = round1(selected?.internalMarks?.basic ?? 0);
  const moderatedMarks = Math.ceil(Number(selected?.internalMarks?.moderated ?? 0));
  const moderationGain = round1(moderatedMarks - basicMarks);
  const previousAttendance = round1(selected?.attendancePct?.prevMonth ?? 0);
  const currentAttendance = round1(selected?.attendancePct?.currMonth ?? 0);
  const attendanceChange = round1(currentAttendance - previousAttendance);
  const classAverage = round1(data?.classAverageBasicMarks ?? 0);
  const attendanceHistory = selected?.attendanceHistory || [];

  const classRank = useMemo(() => {
    if (!selected || !students.length) return null;
    const ordered = [...students].sort((a: any, b: any) => {
      const scoreA = Number(a.internalMarks?.basic ?? 0);
      const scoreB = Number(b.internalMarks?.basic ?? 0);
      return scoreB - scoreA || String(a.name).localeCompare(String(b.name));
    });
    const index = ordered.findIndex((s: any) => s.enrollmentNo === selected.enrollmentNo);
    return index >= 0 ? index + 1 : null;
  }, [selected, students]);

  const betterThan = basicMarks > 0 && students.length
    ? Math.min(100, Math.max(0, Math.round((students.filter((s: any) => Number(s.internalMarks?.basic ?? 0) < basicMarks).length / students.length) * 100)))
    : null;

  const performanceStatus = (value: number, max: number) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    if (pct >= 80) return { label: "Excellent", tone: "bg-emerald-50 text-emerald-700" };
    if (pct >= 60) return { label: "Good", tone: "bg-blue-50 text-blue-700" };
    if (pct >= 40) return { label: "Needs Attention", tone: "bg-amber-50 text-amber-700" };
    return { label: "Critical", tone: "bg-red-50 text-red-600" };
  };

  const currentOverallStatus = selected ? performanceStatus(basicMarks, 40) : { label: "—", tone: "bg-gray-100 text-gray-600" };

  const insights = selected ? [
    currentAttendance < 75 ? { kind: "warning", title: `Attendance is ${currentAttendance}%, below the desired level.`, body: "Try to maintain at least 75% attendance." } : null,
    selected.assignment?.total > 0 && selected.assignment?.submitted < selected.assignment?.total ? { kind: "critical", title: `Assignment marks are ${selected.assignment.submitted}/${selected.assignment.total}.`, body: "Complete all assignments to avoid losing easy internal marks." } : null,
    selected.attendancePct?.trend === "Decreasing" ? { kind: "trend", title: "Attendance trend is decreasing.", body: "Consistent attendance can help improve the current position." } : null,
    (selected.midsem?.first ?? 0) >= 24 || (selected.midsem?.second ?? 0) >= 24 ? { kind: "good", title: "Test performance is strong.", body: "Good performance across the midsemester assessments." } : null,
  ].filter(Boolean) as { kind: string; title: string; body: string }[] : [];

  return (
    <div className="min-h-screen max-w-[1700px] mx-auto px-6 md:px-8 py-8 md:py-10 bg-[#fcfaf5]">
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

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading student report...</div>}

      {data && selected && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Student Performance Report</h2>
            <p className="text-sm text-gray-500 mt-1">A subject-wise report card with attendance, coursework and internal marks.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
            <section className="bg-white rounded-2xl border border-gray-100 p-5 h-fit xl:sticky xl:top-5">
              <input type="text" placeholder="Search name or enrollment" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
              <div className="max-h-[680px] overflow-y-auto space-y-1 pr-1">
                {filteredList.map((s: any) => (
                  <button key={s.enrollmentNo} onClick={() => setSelectedEnrollment(s.enrollmentNo)} className={`w-full text-left px-3 py-3 rounded-xl transition ${s.enrollmentNo === selectedEnrollment ? "bg-gray-900 text-white" : "hover:bg-gray-50 text-gray-700"}`}>
                    <span className="block text-sm font-medium truncate">{s.name}</span>
                    <span className={`block text-xs mt-1 ${s.enrollmentNo === selectedEnrollment ? "text-gray-300" : "text-gray-400"}`}>{s.enrollmentNo}</span>
                  </button>
                ))}
                {!filteredList.length && <p className="text-sm text-gray-400 text-center py-6">No matches.</p>}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-7 md:px-8 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Subject performance report</p>
                    <h3 className="text-3xl font-semibold tracking-tight text-gray-900 mt-2">{selected.name}</h3>
                    <p className="text-sm text-gray-500 mt-2">{selected.enrollmentNo} · {selected.email || "Email not available"}</p>
                  </div>
                  <div className="sm:text-right">
                    <GradeBadge grade={currentOverallStatus.label === "Excellent" ? "Excellent" : selected.midsem?.grade || currentOverallStatus.label} />
                    <p className="text-xs text-gray-400 mt-2">Based on current subject performance</p>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs text-gray-400">Current Attendance</p>
                    <p className="text-3xl font-semibold mt-2">{currentAttendance}%</p>
                    <p className={`text-xs mt-2 font-medium ${attendanceChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>{attendanceChange > 0 ? "+" : ""}{attendanceChange}% from previous</p>
                    <span className={`inline-flex mt-2 text-xs px-2.5 py-1 rounded-full ${selected.attendancePct?.trend === "Decreasing" ? "bg-red-50 text-red-600" : selected.attendancePct?.trend === "Increasing" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{selected.attendancePct?.trend || "Stable"}</span>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs text-gray-400">Internal Score (Basic)</p>
                    <p className="text-3xl font-semibold mt-2">{basicMarks} <span className="text-base text-gray-400 font-normal">/ 40</span></p>
                    <p className={`text-xs mt-2 font-medium ${basicMarks >= classAverage ? "text-emerald-600" : "text-red-500"}`}>{classAverage ? `${basicMarks >= classAverage ? "+" : ""}${round1(basicMarks - classAverage)} vs class avg` : ""}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs text-gray-400">Class Rank</p>
                    <p className="text-3xl font-semibold mt-2">{classRank ? `#${classRank}` : "—"} <span className="text-base text-gray-400 font-normal">/ {students.length}</span></p>
                    <p className="text-xs mt-2 font-medium text-indigo-600">{classRank ? `Top ${Math.max(1, Math.round((classRank / Math.max(1, students.length)) * 100))}% of class` : ""}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs text-gray-400">Moderated Score</p>
                    <p className="text-3xl font-semibold mt-2">{moderatedMarks} <span className="text-base text-gray-400 font-normal">/ 40</span></p>
                    <p className={`text-xs mt-2 font-medium ${moderationGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>{moderationGain >= 0 ? "+" : ""}{moderationGain} after moderation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="rounded-2xl border border-gray-100 p-5">
                    <h4 className="text-lg font-semibold text-gray-900">Assessment Breakdown</h4>
                    <p className="text-xs text-gray-400 mt-1">Raw marks obtained by the student.</p>
                    <div className="mt-4 divide-y divide-gray-100">
                      {assessmentRows.map((row) => {
                        const status = performanceStatus(row.value, row.max);
                        return <div key={row.label} className="flex items-center justify-between gap-3 py-3.5"><span className="text-sm text-gray-600">{row.label}</span><div className="flex items-center gap-3"><span className="font-semibold text-gray-900">{row.raw}</span><span className={`text-[11px] px-2.5 py-1 rounded-full ${status.tone}`}>{status.label}</span></div></div>;
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-100 p-5">
                    <h4 className="text-lg font-semibold text-gray-900">Performance Insights</h4>
                    <div className="mt-4 space-y-4">
                      {insights.length ? insights.map((item) => <div key={item.title} className="flex gap-3"><div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs ${item.kind === "critical" ? "bg-red-50 text-red-600" : item.kind === "warning" || item.kind === "trend" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>•</div><div><p className="text-sm font-medium text-gray-900">{item.title}</p><p className="text-xs text-gray-500 mt-1">{item.body}</p></div></div>) : <p className="text-sm text-gray-500">No immediate performance concerns.</p>}
                      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-sm font-medium text-gray-900">Primary focus</p><p className="text-sm text-gray-600 mt-1">{currentAttendance < 75 || (selected.assignment?.total > 0 && selected.assignment?.submitted < selected.assignment?.total) ? "Attendance and assignment completion." : "Maintain consistency across attendance and assessments."}</p></div>
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="rounded-2xl border border-gray-100 p-5">
                    <h4 className="text-lg font-semibold text-gray-900">Internal Marks Summary</h4>
                    <p className="text-xs text-gray-400 mt-1">Basic marks are the weighted total. Moderated marks are rank-adjusted using the subject moderation tiers.</p>
                    <div className="mt-5 space-y-5">
                      <div><div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Raw Performance (Basic)</span><span className="font-semibold">{basicMarks} / 40</span></div><div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gray-500" style={{ width: `${Math.min(100, (basicMarks / 40) * 100)}%` }} /></div></div>
                      <div><div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Moderated Performance</span><span className="font-semibold">{moderatedMarks} / 40</span></div><div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gray-900" style={{ width: `${Math.min(100, (moderatedMarks / 40) * 100)}%` }} /></div></div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm"><span className="font-medium text-emerald-700">{moderationGain >= 0 ? "+" : ""}{moderationGain} marks after moderation</span></div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-100 p-5">
                    <h4 className="text-lg font-semibold text-gray-900">Class Comparison</h4>
                    <p className="text-xs text-gray-400 mt-1">See how the student compares with the rest of the class.</p>
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <div className="rounded-xl border border-gray-100 p-4 text-center"><p className="text-xs text-gray-400">Your Score</p><p className="text-2xl font-semibold text-blue-600 mt-2">{basicMarks}</p><p className="text-xs text-gray-400">/ 40</p></div>
                      <div className="rounded-xl border border-gray-100 p-4 text-center"><p className="text-xs text-gray-400">Class Average</p><p className="text-2xl font-semibold text-gray-900 mt-2">{classAverage}</p><p className="text-xs text-gray-400">/ 40</p></div>
                      <div className="rounded-xl border border-gray-100 p-4 text-center"><p className="text-xs text-gray-400">Difference</p><p className={`text-2xl font-semibold mt-2 ${basicMarks >= classAverage ? "text-emerald-600" : "text-red-500"}`}>{basicMarks - classAverage >= 0 ? "+" : ""}{round1(basicMarks - classAverage)}</p><p className="text-xs text-gray-400">vs average</p></div>
                    </div>
                    <div className="mt-5"><div className="flex justify-between text-xs text-gray-400"><span>0%</span><span className="font-medium text-gray-700">{betterThan !== null ? `Better than ${betterThan}% of class` : ""}</span><span>100%</span></div><div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${betterThan ?? 0}%` }} /></div></div>
                  </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)] gap-5">
                  <section className="rounded-2xl border border-gray-100 p-5">
                    <div><h4 className="text-lg font-semibold text-gray-900">Performance Trend</h4><p className="text-xs text-gray-400 mt-1">Attendance from every available month in the raw sheet.</p></div>
                    <div className="mt-5 flex items-end gap-4 h-44">
                      <div className="text-[10px] text-gray-400 h-full flex flex-col justify-between py-1"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
                      <div className="relative flex-1 h-full flex items-end gap-2 sm:gap-3 border-l border-b border-gray-200 px-3 pb-1 overflow-x-auto">
                        {attendanceHistory.map((point: any) => {
                          const value = round1(point.percentage ?? 0);
                          const height = value > 0 ? Math.max(6, Math.min(100, value)) : 0;
                          return <div key={point.month} className="min-w-[58px] flex-1 h-full flex flex-col items-center justify-end"><div className="w-full max-w-[55px] rounded-t-lg bg-gray-900/80" style={{ height: `${height}%` }} title={`${point.month}: ${value}%`} /><span className="text-[10px] text-gray-400 mt-2 text-center whitespace-nowrap">{shortMonth(point.month)}</span></div>;
                        })}
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">Attendance changed from <span className="font-semibold">{previousAttendance}%</span> to <span className="font-semibold">{currentAttendance}%</span> in the selected comparison.</div>
                  </section>

                  <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                    <h4 className="text-lg font-semibold text-gray-900">What can help?</h4>
                    <div className="mt-5 space-y-4 text-sm">
                      <div><p className="font-medium text-gray-900">Attend regularly</p><p className="text-xs text-gray-500 mt-1">Aim to maintain at least 75% attendance.</p></div>
                      <div><p className="font-medium text-gray-900">Complete all assignments</p><p className="text-xs text-gray-500 mt-1">Avoid losing easy internal marks.</p></div>
                      <div><p className="font-medium text-gray-900">Keep up the good work</p><p className="text-xs text-gray-500 mt-1">Use strong assessment performance to offset weaker areas.</p></div>
                    </div>
                  </section>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span className="font-semibold">Keep it up, {String(selected.name).split(" ")[0]}.</span> Focus on improving attendance and completing coursework to strengthen the overall subject performance.</div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
