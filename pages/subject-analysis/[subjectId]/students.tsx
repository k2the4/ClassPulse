import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton } from "../../../components/AnalysisWidgets";

function round1(n: number) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function shortMonth(month: string) {
  return month.replace(/\s*20\d{2}/, "");
}

function statusFor(value: number, max = 40) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 80) return { label: "Excellent", tone: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" };
  if (pct >= 60) return { label: "Good", tone: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-500" };
  if (pct >= 40) return { label: "Needs Attention", tone: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" };
  return { label: "Critical Risk", tone: "bg-red-50 text-red-600 border-red-100", dot: "bg-red-500" };
}

function weightedMarks(selected: any) {
  const attendance = round1(((selected?.attendancePct?.currMonth ?? 0) / 100) * 10);
  const assignment = selected?.assignment?.total > 0
    ? round1(((selected.assignment.submitted ?? 0) / selected.assignment.total) * 5)
    : 0;
  const presentation = round1(((selected?.presentation ?? 0) / 10) * 5);
  const midsem1 = round1(((selected?.midsem?.first ?? 0) / 30) * 10);
  const midsem2 = round1(((selected?.midsem?.second ?? 0) / 30) * 10);
  return { attendance, assignment, presentation, midsem1, midsem2 };
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
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    if (sync) setSyncing(true); else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load student report");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
      if (!selectedEnrollment && json.data?.students?.[0]) setSelectedEnrollment(json.data.students[0].enrollmentNo);
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
  }, [subjectId]);

  const students = data?.students || [];
  const selected: any = students.find((s: any) => s.enrollmentNo === selectedEnrollment) || students[0];

  useEffect(() => {
    if (!selectedEnrollment && students[0]) setSelectedEnrollment(students[0].enrollmentNo);
  }, [students, selectedEnrollment]);

  const studentsWithStatus = useMemo(() => students.map((student: any) => ({ ...student, reportStatus: statusFor(Number(student.internalMarks?.basic ?? 0)) })), [students]);
  const statusCounts = useMemo(() => studentsWithStatus.reduce((acc: Record<string, number>, student: any) => {
    acc[student.reportStatus.label] = (acc[student.reportStatus.label] || 0) + 1;
    return acc;
  }, {}), [studentsWithStatus]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studentsWithStatus.filter((student: any) => {
      const matchesSearch = !q || student.name.toLowerCase().includes(q) || student.enrollmentNo.includes(q);
      const matchesStatus = statusFilter === "All" || student.reportStatus.label === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [studentsWithStatus, search, statusFilter]);

  const basicMarks = round1(selected?.internalMarks?.basic ?? 0);
  const moderatedMarks = round1(selected?.internalMarks?.moderated ?? 0);
  const moderationGain = round1(moderatedMarks - basicMarks);
  const currentAttendance = round1(selected?.attendancePct?.currMonth ?? 0);
  const previousAttendance = round1(selected?.attendancePct?.prevMonth ?? 0);
  const attendanceChange = round1(currentAttendance - previousAttendance);
  const classAverage = round1(data?.classAverageBasicMarks ?? 0);
  const weights = weightedMarks(selected);
  const assessmentTotal = round1(weights.attendance + weights.assignment + weights.presentation + weights.midsem1 + weights.midsem2);
  const selectedStatus = statusFor(basicMarks);
  const attendanceHistory = selected?.attendanceHistory || [];

  const chartPoints = useMemo(() => {
    if (!attendanceHistory.length) return [];
    const width = 700;
    const height = 220;
    const left = 36;
    const right = 12;
    const top = 16;
    const bottom = 28;
    const innerW = width - left - right;
    const innerH = height - top - bottom;
    return attendanceHistory.map((point: any, index: number) => {
      const x = attendanceHistory.length === 1 ? left + innerW / 2 : left + (index / (attendanceHistory.length - 1)) * innerW;
      const value = Number(point.percentage) || 0;
      const y = top + innerH - (value / 100) * innerH;
      return { x, y, value, month: shortMonth(point.month) };
    });
  }, [attendanceHistory]);

  const linePath = chartPoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="analysis-layout">
      <aside className="analysis-sidebar">
        <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div>
        <nav className="analysis-side-nav">
          <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a href="/classes"><BookOpen size={18} />Class Analysis</a>
          <a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/students` : "#"}><GraduationCap size={18} />Subject Analysis</a>
        </nav>
        <RawDataButton sheetId={sheetId} />
        <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="analysis-page">
        <header className="analysis-topbar">
          <div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div>
          <div className="analysis-top-actions"><button className="analysis-primary" onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button></div>
        </header>

        {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}
        {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
        {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading student report...</div>}

        {data && selected && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Student Performance Report</h2>
              <p className="text-sm text-gray-500 mt-1">A subject-wise report card with attendance, coursework and internal marks.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden xl:sticky xl:top-4">
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-gray-900">Students</h3><span className="text-sm text-gray-400">{students.length}</span></div>
                  <input type="text" placeholder="Search by name or enrollment no." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-3 outline-none focus:border-purple-300" />
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {["All", "Excellent", "Good", "Needs Attention", "Critical Risk"].map((filter) => {
                      const count = filter === "All" ? students.length : statusCounts[filter] || 0;
                      return <button key={filter} onClick={() => setStatusFilter(filter)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${statusFilter === filter ? "border-purple-200 bg-purple-50 text-purple-700" : "border-gray-200 bg-white text-gray-500"}`}>{filter === "All" ? `All ${count}` : `${filter} ${count}`}</button>;
                    })}
                  </div>
                </div>
                <div className="max-h-[680px] overflow-y-auto px-2 pb-2">
                  {filteredList.map((student: any) => {
                    const active = student.enrollmentNo === selected.enrollmentNo;
                    return <button key={student.enrollmentNo} onClick={() => setSelectedEnrollment(student.enrollmentNo)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 flex items-center justify-between gap-2 ${active ? "bg-indigo-800 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                      <span className="min-w-0"><span className="block text-sm font-semibold truncate">{student.name}</span><span className={`block text-xs mt-1 ${active ? "text-indigo-200" : "text-gray-400"}`}>{student.enrollmentNo}</span></span>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${active ? "bg-white text-amber-700 border-white" : student.reportStatus.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${student.reportStatus.dot}`} />{student.reportStatus.label}</span>
                    </button>;
                  })}
                  {!filteredList.length && <p className="text-sm text-gray-400 text-center py-8">No matches.</p>}
                </div>
              </section>

              <div className="min-w-0 space-y-4">
                <section className="bg-white rounded-2xl border border-gray-200 px-5 py-5 md:px-7 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0"><div className="h-14 w-14 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-semibold shrink-0">{String(selected.name).split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</div><div className="min-w-0"><h3 className="text-2xl font-semibold text-gray-900 truncate">{selected.name}</h3><p className="text-sm text-gray-400 mt-1 truncate">{selected.enrollmentNo} · {selected.email || "Email not available"}</p></div></div>
                  <div className="text-right shrink-0"><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${selectedStatus.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedStatus.dot}`} />{selectedStatus.label}</span></div>
                </section>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 min-h-[108px]"><p className="text-xs text-gray-500">Class Average</p><p className="text-2xl font-semibold text-gray-900 mt-2">{classAverage} <span className="text-sm text-gray-400 font-normal">/ 40</span></p><p className="text-[11px] text-gray-400 mt-1">Average marks in class</p></div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 min-h-[108px]"><p className="text-xs text-gray-500">Internal Score (Basic)</p><p className="text-2xl font-semibold text-gray-900 mt-2">{basicMarks} <span className="text-sm text-gray-400 font-normal">/ 40</span></p><p className={`text-[11px] mt-1 font-medium ${basicMarks >= classAverage ? "text-emerald-600" : "text-red-500"}`}>{basicMarks - classAverage >= 0 ? "+" : ""}{round1(basicMarks - classAverage)} vs class avg</p></div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 min-h-[108px]"><p className="text-xs text-gray-500">Moderated Score</p><p className="text-2xl font-semibold text-gray-900 mt-2">{moderatedMarks} <span className="text-sm text-gray-400 font-normal">/ 40</span></p><p className={`text-[11px] mt-1 font-medium ${moderationGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>{moderationGain >= 0 ? "+" : ""}{moderationGain} vs basic</p></div>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 min-h-[108px]"><p className="text-xs text-gray-500">Current Attendance</p><p className="text-2xl font-semibold text-gray-900 mt-2">{currentAttendance}%</p><p className={`text-[11px] mt-1 font-medium ${attendanceChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>{attendanceChange >= 0 ? "+" : ""}{attendanceChange}% from previous</p></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] gap-4">
                  <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100"><h4 className="text-base font-semibold text-gray-900">Assessment Breakdown</h4><p className="text-xs text-gray-400 mt-1">Raw marks and their contribution to the subject internal score.</p></div>
                    <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] px-5 py-3 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100"><span>Component</span><span>Raw Marks</span><span>Marks</span></div>
                    {[
                      ["Attendance", `${currentAttendance}%`, `${weights.attendance} / 10`],
                      ["Assignment", `${selected.assignment?.submitted ?? 0}/${selected.assignment?.total ?? 0}`, `${weights.assignment} / 5`],
                      ["Presentation", `${selected.presentation ?? 0}/10`, `${weights.presentation} / 5`],
                      ["Midsem 1", `${selected.midsem?.first ?? 0}/30`, `${weights.midsem1} / 10`],
                      ["Midsem 2", `${selected.midsem?.second ?? 0}/30`, `${weights.midsem2} / 10`],
                    ].map((row) => <div key={row[0]} className="grid grid-cols-[1.2fr_0.9fr_0.9fr] px-5 py-3.5 text-sm border-b border-gray-100"><span className="text-gray-600">{row[0]}</span><span className="font-medium text-gray-800">{row[1]}</span><span className="font-semibold text-gray-900">{row[2]}</span></div>)}
                    <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] px-5 py-4 bg-gray-50/70 text-sm font-semibold"><span>Total</span><span className="text-gray-500">—</span><span>{assessmentTotal} / 40</span></div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100"><h4 className="text-base font-semibold text-gray-900">Performance Trend</h4><p className="text-xs text-gray-400 mt-1">Attendance from every available month in the raw sheet.</p></div>
                    <div className="px-4 pt-4">
                      <svg viewBox="0 0 700 220" className="w-full h-[220px]" role="img" aria-label="Attendance performance trend">
                        {[0,25,50,75,100].map((tick) => { const y = 16 + (220 - 16 - 28) - (tick / 100) * (220 - 16 - 28); return <g key={tick}><line x1="36" x2="688" y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" /><text x="2" y={y + 4} fontSize="10" fill="#9ca3af">{tick}%</text></g>; })}
                        {linePath && <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                        {chartPoints.map((point: any) => <g key={point.month + point.x}><circle cx={point.x} cy={point.y} r="5" fill="white" stroke="#4f46e5" strokeWidth="3" /><text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">{point.value}%</text><text x={point.x} y="214" textAnchor="middle" fontSize="10" fill="#6b7280">{point.month}</text></g>)}
                      </svg>
                    </div>
                    <div className="mx-5 mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700">Attendance changed from {previousAttendance}% to {currentAttendance}% in the selected comparison.</div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
