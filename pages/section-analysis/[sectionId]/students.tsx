import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Award,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  StickyNote,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";

import AnalysisNav from "../../../components/AnalysisNav";
import { GradeBadge, RawDataButton } from "../../../components/AnalysisWidgets";

interface SubjectScore {
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
}

interface Student {
  enrollmentNo: string;
  name: string;
  email: string;
  overallPct: number;
  overallAttendance: number;
  overallGrade: string;
  subjects: SubjectScore[];
}

interface OverallData {
  subjects: { id: string; name: string; code: string }[];
  students: Student[];
  classAverageOverallPct: number;
}

const gradeTone: Record<string, string> = {
  Excellent: "bg-blue-50 text-blue-700 border-blue-100",
  Good: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Needs Attention": "bg-amber-50 text-amber-700 border-amber-100",
  "Critical Risk": "bg-red-50 text-red-600 border-red-100",
};

const markTone = (pct: number) =>
  pct >= 80 ? "text-blue-600" : pct >= 60 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500";

const gradeFromPct = (pct: number) =>
  pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Needs Attention" : "Critical Risk";

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

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
  const [gradeFilter, setGradeFilter] = useState("All");
  const [selectedEnrollment, setSelectedEnrollment] = useState("");

  async function loadAnalysis(sync = false) {
    if (typeof sectionId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/analysis/section/${sectionId}/overall${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load student report");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt || "");
      setSheetId(json.sheetId || null);
      if (json.data?.students?.length && !selectedEnrollment) {
        setSelectedEnrollment(json.data.students[0].enrollmentNo);
      }
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

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = !query || student.name.toLowerCase().includes(query) || student.enrollmentNo.includes(query);
      const matchesGrade = gradeFilter === "All" || student.overallGrade === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [students, search, gradeFilter]);

  useEffect(() => {
    if (!selectedEnrollment && students[0]) setSelectedEnrollment(students[0].enrollmentNo);
    if (selectedEnrollment && !students.some((student) => student.enrollmentNo === selectedEnrollment) && students[0]) {
      setSelectedEnrollment(students[0].enrollmentNo);
    }
  }, [students, selectedEnrollment]);

  const selected = students.find((student) => student.enrollmentNo === selectedEnrollment) || filteredStudents[0];

  const studentStats = useMemo(() => {
    if (!selected) return null;

    const subjects = selected.subjects.slice(0, 6).map((subject) => {
      const max = Number(subject.basicMax) || 40;
      const mark = Number(subject.basicInternal) || 0;
      const pct = max > 0 ? (mark / max) * 100 : 0;
      return { ...subject, max, mark, pct, grade: subject.grade || gradeFromPct(pct) };
    });

    const total = subjects.reduce((sum, subject) => sum + subject.mark, 0);
    const totalMax = subjects.reduce((sum, subject) => sum + subject.max, 0);
    const average = subjects.length ? total / subjects.length : 0;
    const averageMax = subjects.length ? totalMax / subjects.length : 40;
    const averagePct = averageMax ? (average / averageMax) * 100 : 0;

    const ranked = [...students]
      .map((student) => {
        const scores = student.subjects.slice(0, 6);
        const max = scores.reduce((sum, subject) => sum + (Number(subject.basicMax) || 40), 0);
        const marks = scores.reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0);
        return { enrollmentNo: student.enrollmentNo, average: scores.length ? marks / scores.length : 0, pct: max ? (marks / max) * 100 : 0 };
      })
      .sort((a, b) => b.average - a.average);
    const rankIndex = Math.max(0, ranked.findIndex((item) => item.enrollmentNo === selected.enrollmentNo));
    const percentile = students.length ? Math.round(((students.length - rankIndex) / students.length) * 100) : 0;

    const classAverages = subjects.map((subject) => {
      const values = students.map((student) => {
        const match = student.subjects.find((item) => item.subjectId === subject.subjectId || item.code === subject.code);
        return Number(match?.basicInternal) || 0;
      });
      return {
        ...subject,
        classAverage: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      };
    });

    const highest = [...classAverages].sort((a, b) => b.mark - a.mark)[0];
    const lowest = [...classAverages].sort((a, b) => a.mark - b.mark)[0];

    const gradeCounts = students.reduce((acc, student) => {
      const grade = student.overallGrade || gradeFromPct(student.overallPct);
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      subjects: classAverages,
      total,
      totalMax,
      average,
      averageMax,
      averagePct,
      rank: rankIndex + 1,
      percentile,
      highest,
      lowest,
      gradeCounts,
    };
  }, [selected, students]);

  const navigateStudent = (direction: -1 | 1) => {
    if (!filteredStudents.length || !selected) return;
    const index = filteredStudents.findIndex((student) => student.enrollmentNo === selected.enrollmentNo);
    const nextIndex = Math.min(filteredStudents.length - 1, Math.max(0, index + direction));
    setSelectedEnrollment(filteredStudents[nextIndex].enrollmentNo);
  };

  const gradeCount = (grade: string) => students.filter((student) => student.overallGrade === grade).length;

  return (
    <div className="min-h-screen max-w-[1900px] mx-auto px-6 lg:px-8 py-7 text-slate-900">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Class / Section Analysis</h1>
          {computedAt && <p className="text-xs text-slate-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          <RawDataButton sheetId={sheetId} />
          <button
            onClick={() => loadAnalysis(true)}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3f2a8f] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_22px_rgba(63,42,143,.18)] disabled:opacity-60"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

      {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !data && <div className="py-14 text-center text-sm text-slate-500">Loading student report...</div>}

      {data && (
        <>
          <div className="mt-5 mb-5">
            <h2 className="text-xl font-semibold">Student Report</h2>
            <p className="text-sm text-slate-500 mt-1">Individual performance report across {Math.min(6, data.subjects.length)} theory subjects.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-fit xl:sticky xl:top-5">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Students</h3>
                  <span className="text-xs text-slate-400">{students.length}</span>
                </div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or enrollment no."
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                  {["All", "Good", "Needs Attention", "Critical Risk"].map((grade) => (
                    <button
                      key={grade}
                      onClick={() => setGradeFilter(grade)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                        gradeFilter === grade ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {grade === "All" ? `All ${students.length}` : `${grade} ${gradeCount(grade)}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[690px] overflow-y-auto p-2">
                {filteredStudents.map((student) => {
                  const avg = student.subjects.slice(0, 6).reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0) / Math.max(1, Math.min(6, student.subjects.length));
                  return (
                    <button
                      key={student.enrollmentNo}
                      onClick={() => setSelectedEnrollment(student.enrollmentNo)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${student.enrollmentNo === selected?.enrollmentNo ? "bg-[#4a32a0] text-white shadow-sm" : "hover:bg-slate-50 text-slate-700"}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${student.enrollmentNo === selected?.enrollmentNo ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700"}`}>
                          {student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{student.name}</span>
                          <span className={`block text-[10px] mt-0.5 ${student.enrollmentNo === selected?.enrollmentNo ? "text-violet-100" : "text-slate-400"}`}>{student.enrollmentNo}</span>
                        </span>
                        <span className={`text-xs font-semibold ${student.enrollmentNo === selected?.enrollmentNo ? "text-white" : markTone((avg / 40) * 100)}`}>{formatNumber(avg)}/40</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between pl-10">
                        <span className={`text-[9px] rounded-full border px-1.5 py-0.5 ${student.enrollmentNo === selected?.enrollmentNo ? "border-white/20 bg-white/10 text-white" : gradeTone[student.overallGrade] || "border-slate-200 text-slate-500"}`}>
                          {student.overallGrade}
                        </span>
                        <span className={`text-[10px] ${student.enrollmentNo === selected?.enrollmentNo ? "text-violet-100" : "text-slate-400"}`}>{student.overallAttendance}% attendance</span>
                      </div>
                    </button>
                  );
                })}
                {!filteredStudents.length && <p className="py-10 text-center text-xs text-slate-400">No students match the current filters.</p>}
              </div>
              <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-3">
                <button onClick={() => navigateStudent(-1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={15} /></button>
                <span className="text-[10px] text-slate-400">{filteredStudents.length ? "Student list" : "No results"}</span>
                <button onClick={() => navigateStudent(1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={15} /></button>
              </div>
            </aside>

            {selected && studentStats && (
              <main className="min-w-0 space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
                        {selected.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold truncate">{selected.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 truncate">{selected.enrollmentNo} · {selected.email || "no email on file"}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] text-slate-600">Section · Current</span>
                          <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] text-slate-600">Total Students · {students.length}</span>
                          <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] text-slate-600">Theory Subjects · {studentStats.subjects.length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start justify-between lg:justify-end gap-8">
                      <div>
                        <p className="text-[10px] text-slate-400">Enrollment</p>
                        <p className="mt-1 text-sm font-semibold">{selected.enrollmentNo}</p>
                      </div>
                      <div className="text-right">
                        <GradeBadge grade={selected.overallGrade} />
                        <p className="text-[10px] text-slate-400 mt-3">Rank (by Average)</p>
                        <p className="text-sm font-semibold">{studentStats.rank} / {students.length}</p>
                        <p className="text-[10px] text-slate-400 mt-2">Percentile</p>
                        <p className="text-sm font-semibold">{studentStats.percentile}th</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  <Metric icon={<BarChart3 size={17} />} label="Average (out of 40)" value={formatNumber(studentStats.average)} sub={`${studentStats.averagePct.toFixed(1)}%`} />
                  <Metric icon={<Award size={17} />} label="Total (out of 240)" value={formatNumber(studentStats.total)} sub={`${studentStats.averagePct.toFixed(1)}%`} />
                  <Metric icon={<TrendingUp size={17} />} label="Highest Subject" value={studentStats.highest ? formatNumber(studentStats.highest.mark) : "—"} sub={studentStats.highest?.name || "—"} />
                  <Metric icon={<TrendingDown size={17} />} label="Lowest Subject" value={studentStats.lowest ? formatNumber(studentStats.lowest.mark) : "—"} sub={studentStats.lowest?.name || "—"} />
                  <Metric icon={<CalendarCheck size={17} />} label="Overall Attendance" value={`${selected.overallAttendance}%`} sub="Current attendance" />
                </section>

                <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_290px] gap-4">
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="font-semibold">Subject Performance <span className="text-xs font-normal text-slate-400">(Theory Subjects)</span></h3>
                      <p className="text-[10px] text-slate-400 mt-1">Marks are shown out of 40 and compared with the class average.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] text-slate-400">
                            <th className="px-5 py-3 text-left font-medium">Subject</th>
                            <th className="px-2 py-3 text-right font-medium">Marks / 40</th>
                            <th className="px-2 py-3 text-right font-medium">%</th>
                            <th className="px-2 py-3 text-left font-medium">Grade</th>
                            <th className="px-2 py-3 text-left font-medium">Performance vs Class Avg</th>
                            <th className="px-5 py-3 text-right font-medium">Class Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentStats.subjects.map((subject) => {
                            const difference = subject.mark - subject.classAverage;
                            const maxDifference = 20;
                            const width = Math.min(100, (Math.abs(difference) / maxDifference) * 100);
                            return (
                              <tr key={subject.subjectId} className="border-b border-slate-50 last:border-0">
                                <td className="px-5 py-3 font-medium text-slate-800 max-w-[230px]">{subject.name}</td>
                                <td className={`px-2 py-3 text-right font-semibold ${markTone(subject.pct)}`}>{formatNumber(subject.mark)}</td>
                                <td className="px-2 py-3 text-right text-slate-500">{subject.pct.toFixed(1)}%</td>
                                <td className="px-2 py-3"><GradeBadge grade={subject.grade} /></td>
                                <td className="px-2 py-3 min-w-[230px]">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-12 text-right text-[10px] font-medium ${difference >= 0 ? "text-emerald-600" : "text-red-500"}`}>{difference >= 0 ? "+" : ""}{difference.toFixed(1)}</span>
                                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                      <div className={`h-full rounded-full ${difference >= 0 ? "bg-emerald-400" : "bg-red-400"}`} style={{ width: `${Math.max(3, width / 2)}%`, marginLeft: difference >= 0 ? "50%" : `${50 - width / 2}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right text-slate-500">{formatNumber(subject.classAverage)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-3 text-[9px] text-slate-400 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Below class average</span>
                      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Above class average</span>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <SummaryCard title="Grade Summary">
                      <div className="flex items-center gap-5">
                        <Donut counts={studentStats.gradeCounts} total={students.length} />
                        <div className="space-y-2 text-[10px] flex-1">
                          {["Good", "Needs Attention", "Critical Risk"].map((grade) => (
                            <div key={grade} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${grade === "Good" ? "bg-emerald-500" : grade === "Needs Attention" ? "bg-amber-500" : "bg-red-500"}`} />{grade}</span>
                              <span className="text-slate-500">{studentStats.gradeCounts[grade] || 0} ({students.length ? (((studentStats.gradeCounts[grade] || 0) / students.length) * 100).toFixed(1) : 0}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </SummaryCard>

                    <SummaryCard title="Attendance Overview">
                      <div className="flex items-end justify-between">
                        <div><p className="text-[10px] text-slate-400">Overall Attendance</p><p className="text-xl font-semibold mt-1">{selected.overallAttendance}%</p></div>
                        <span className={`rounded-full px-2 py-1 text-[9px] ${selected.overallAttendance >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{selected.overallAttendance >= 75 ? "On track" : "Needs attention"}</span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, selected.overallAttendance)}%` }} /></div>
                      <div className="grid grid-cols-2 gap-3 mt-4 text-[10px]"><div><span className="text-slate-400">Subject average</span><p className="font-medium mt-1">{studentStats.subjects.length ? (studentStats.subjects.reduce((sum, s) => sum + s.attendance, 0) / studentStats.subjects.length).toFixed(1) : 0}%</p></div><div><span className="text-slate-400">Subjects</span><p className="font-medium mt-1">{studentStats.subjects.length}</p></div></div>
                    </SummaryCard>

                    <SummaryCard title="Assessment Snapshot">
                      <div className="space-y-3">
                        {[
                          ["Midsem 1", studentStats.subjects.reduce((sum, s) => sum + (Number(s.midsem1) || 0), 0) / Math.max(1, studentStats.subjects.length)],
                          ["Midsem 2", studentStats.subjects.reduce((sum, s) => sum + (Number(s.midsem2) || 0), 0) / Math.max(1, studentStats.subjects.length)],
                          ["Combined", studentStats.subjects.reduce((sum, s) => sum + (Number(s.combined) || 0), 0) / Math.max(1, studentStats.subjects.length)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="flex items-center justify-between"><span className="text-[10px] text-slate-500">{label}</span><span className="text-xs font-semibold">{Number(value).toFixed(1)}</span></div>
                        ))}
                      </div>
                    </SummaryCard>
                  </aside>
                </div>

                <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-violet-600 border border-violet-100"><StickyNote size={16} /></span>
                    <div><h4 className="text-xs font-semibold">Teacher's Notes</h4><p className="text-[10px] text-slate-500 mt-1">Performance summary is generated from the synced academic and attendance data. Add teacher observations here when follow-up is required.</p></div>
                  </div>
                  <button className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-2 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Add Note</button>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs"><div className="flex items-center gap-2 font-semibold"><Trophy size={15} className="text-amber-500" />Class position</div><p className="text-[10px] text-slate-400 mt-2">{selected.name} ranks {studentStats.rank} out of {students.length} students by average theory marks.</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs"><div className="flex items-center gap-2 font-semibold"><UserRound size={15} className="text-violet-500" />Report scope</div><p className="text-[10px] text-slate-400 mt-2">Six theory subjects only; no laboratory subjects are included in the academic average.</p></div>
                </div>
              </main>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
      <div className="flex items-center gap-2 text-slate-500"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-violet-600">{icon}</span><span className="text-[10px] truncate">{label}</span></div>
      <p className="text-xl font-semibold mt-3 truncate">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-semibold mb-4">{title}</h3>{children}</section>;
}

function Donut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const good = total ? (counts.Good || 0) / total : 0;
  const attention = total ? (counts["Needs Attention"] || 0) / total : 0;
  const critical = total ? (counts["Critical Risk"] || 0) / total : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: good, className: "stroke-emerald-500" },
    { value: attention, className: "stroke-amber-500" },
    { value: critical, className: "stroke-red-500" },
  ];
  let offset = 0;
  return (
    <div className="relative h-[82px] w-[82px] shrink-0">
      <svg viewBox="0 0 82 82" className="h-full w-full -rotate-90">
        <circle cx="41" cy="41" r={radius} fill="none" strokeWidth="10" className="stroke-slate-100" />
        {segments.map((segment, index) => {
          const length = segment.value * circumference;
          const dashOffset = -offset;
          offset += length;
          return <circle key={index} cx="41" cy="41" r={radius} fill="none" strokeWidth="10" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset} className={segment.className} />;
        })}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold">{total}</span>
    </div>
  );
}
