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
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";

const SUBJECT_COUNT = 6;
const SUBJECT_MAX = 40;
const TOTAL_MAX = SUBJECT_COUNT * SUBJECT_MAX;

const GRADE_ORDER = ["Excellent", "Good", "Needs Attention", "Critical Risk"] as const;
type Grade = (typeof GRADE_ORDER)[number];

const GRADE_TONE: Record<Grade, { text: string; bg: string; border: string; dot: string }> = {
  Excellent: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100", dot: "bg-blue-500" },
  Good: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", dot: "bg-emerald-500" },
  "Needs Attention": { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100", dot: "bg-amber-500" },
  "Critical Risk": { text: "text-red-700", bg: "bg-red-50", border: "border-red-100", dot: "bg-red-500" },
};

interface SubjectScore {
  subjectId: string;
  code: string;
  name: string;
  attendance: number;
  midsem1: number;
  midsem2: number;
  combined: number;
  assignment?: { submitted: number; total: number; mark: number };
  presentation?: { raw: number; mark: number };
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

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function studentAverage(student: Student) {
  const subjects = student.subjects.slice(0, SUBJECT_COUNT);
  return subjects.length
    ? subjects.reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0) / subjects.length
    : 0;
}

function gradeFromAverage(average: number): Grade {
  const pct = (average / SUBJECT_MAX) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}

function GradePill({ grade, large = false }: { grade: Grade; large?: boolean }) {
  const tone = GRADE_TONE[grade];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${tone.border} ${tone.bg} ${tone.text} ${large ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[10px]"} font-semibold`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {grade}
    </span>
  );
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
  const [gradeFilter, setGradeFilter] = useState<Grade | "All">("All");
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

      const needsDetailedData = !sync && json.data?.students?.some((student: Student) =>
        student.subjects?.some((subject) => !subject.assignment || !subject.presentation)
      );

      if (needsDetailedData) {
        await loadAnalysis(true);
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

  const studentsWithGrades = useMemo(
    () => students.map((student) => ({
      ...student,
      reportAverage: studentAverage(student),
      reportGrade: gradeFromAverage(studentAverage(student)),
    })),
    [students]
  );

  const classGradeCounts = useMemo(() => {
    return GRADE_ORDER.reduce((acc, grade) => {
      acc[grade] = studentsWithGrades.filter((student) => student.reportGrade === grade).length;
      return acc;
    }, {} as Record<Grade, number>);
  }, [studentsWithGrades]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studentsWithGrades.filter((student) => {
      const matchesSearch = !query || student.name.toLowerCase().includes(query) || student.enrollmentNo.includes(query);
      const matchesGrade = gradeFilter === "All" || student.reportGrade === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [studentsWithGrades, search, gradeFilter]);

  useEffect(() => {
    if (!selectedEnrollment && students[0]) setSelectedEnrollment(students[0].enrollmentNo);
    if (selectedEnrollment && !students.some((student) => student.enrollmentNo === selectedEnrollment) && students[0]) {
      setSelectedEnrollment(students[0].enrollmentNo);
    }
  }, [students, selectedEnrollment]);

  const selected = studentsWithGrades.find((student) => student.enrollmentNo === selectedEnrollment) || filteredStudents[0];

  const studentStats = useMemo(() => {
    if (!selected) return null;

    const subjects = selected.subjects.slice(0, SUBJECT_COUNT).map((subject) => {
      const assignment = subject.assignment?.mark ?? 0;
      const presentation = subject.presentation?.mark ?? 0;
      const attendance = clamp(((Number(subject.attendance) || 0) / 100) * 10, 0, 10);
      const midsem1 = clamp(((Number(subject.midsem1) || 0) / 30) * 10, 0, 10);
      const midsem2 = clamp(((Number(subject.midsem2) || 0) / 30) * 10, 0, 10);
      const basicInternal = Number(subject.basicInternal) || assignment + presentation + attendance + midsem1 + midsem2;
      const moderatedInternal = Number(subject.moderatedInternal);

      return {
        ...subject,
        assignment,
        presentation,
        attendanceMark: attendance,
        midsem1Mark: midsem1,
        midsem2Mark: midsem2,
        basicInternal,
        moderatedInternal: Number.isFinite(moderatedInternal) ? moderatedInternal : basicInternal,
        grade: gradeFromAverage(basicInternal),
      };
    });

    const total = subjects.reduce((sum, subject) => sum + subject.basicInternal, 0);
    const average = subjects.length ? total / subjects.length : 0;

    const ranked = [...studentsWithGrades].sort(
      (a, b) => b.reportAverage - a.reportAverage || a.name.localeCompare(b.name)
    );
    const rankIndex = Math.max(0, ranked.findIndex((item) => item.enrollmentNo === selected.enrollmentNo));

    const highest = [...subjects].sort((a, b) => b.basicInternal - a.basicInternal)[0];
    const lowest = [...subjects].sort((a, b) => a.basicInternal - b.basicInternal)[0];

    return {
      subjects,
      total,
      average,
      averagePct: (average / SUBJECT_MAX) * 100,
      rank: rankIndex + 1,
      highest,
      lowest,
      grade: gradeFromAverage(average),
    };
  }, [selected, studentsWithGrades]);

  const navigateStudent = (direction: -1 | 1) => {
    if (!filteredStudents.length || !selected) return;
    const index = filteredStudents.findIndex((student) => student.enrollmentNo === selected.enrollmentNo);
    const nextIndex = Math.min(filteredStudents.length - 1, Math.max(0, index + direction));
    setSelectedEnrollment(filteredStudents[nextIndex].enrollmentNo);
  };

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
            <p className="text-sm text-slate-500 mt-1">Individual performance report across {Math.min(SUBJECT_COUNT, data.subjects.length)} theory subjects.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)] gap-4 items-start">
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden xl:sticky xl:top-5">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Students</h3>
                  <span className="text-xs text-slate-400">{students.length}</span>
                </div>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or enrollment no."
                    style={{ paddingLeft: 38 }}
                    className="w-full rounded-lg border border-slate-200 py-2.5 pr-3 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                  <FilterPill active={gradeFilter === "All"} onClick={() => setGradeFilter("All")} label={`All ${students.length}`} />
                  {GRADE_ORDER.map((grade) => (
                    <FilterPill
                      key={grade}
                      active={gradeFilter === grade}
                      onClick={() => setGradeFilter(grade)}
                      label={`${grade} ${classGradeCounts[grade] || 0}`}
                    />
                  ))}
                </div>
              </div>

              <div className="max-h-[650px] overflow-y-auto p-2">
                {filteredStudents.map((student) => (
                  <button
                    key={student.enrollmentNo}
                    onClick={() => setSelectedEnrollment(student.enrollmentNo)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ${student.enrollmentNo === selected?.enrollmentNo ? "bg-[#4a32a0] text-white shadow-sm" : "hover:bg-slate-50 text-slate-700"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{student.name}</span>
                        <span className={`block text-[10px] mt-1 ${student.enrollmentNo === selected?.enrollmentNo ? "text-violet-100" : "text-slate-400"}`}>{student.enrollmentNo}</span>
                      </span>
                      <GradePill grade={student.reportGrade} />
                    </div>
                  </button>
                ))}
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
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
                        {selected.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold truncate">{selected.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 truncate">Student report · {Math.min(SUBJECT_COUNT, selected.subjects.length)} theory subjects</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 lg:gap-8">
                      <div className="text-right">
                        <GradePill grade={studentStats.grade} large />
                        <p className="text-[10px] text-slate-400 mt-2">Rank by average</p>
                        <p className="text-sm font-semibold">{studentStats.rank} / {students.length}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <Metric icon={<BarChart3 size={17} />} label="Average" value={`${formatNumber(studentStats.average)} / 40`} sub={`${studentStats.averagePct.toFixed(1)}%`} />
                  <Metric icon={<Award size={17} />} label="Total" value={`${formatNumber(studentStats.total)} / ${TOTAL_MAX}`} sub="6 subjects × 40" />
                  <Metric icon={<TrendingUp size={17} />} label="Highest Subject" value={studentStats.highest ? formatNumber(studentStats.highest.basicInternal) : "—"} sub={studentStats.highest?.name || "—"} />
                  <Metric icon={<TrendingDown size={17} />} label="Lowest Subject" value={studentStats.lowest ? formatNumber(studentStats.lowest.basicInternal) : "—"} sub={studentStats.lowest?.name || "—"} />
                  <Metric icon={<CalendarCheck size={17} />} label="Overall Attendance" value={`${selected.overallAttendance}%`} sub="Current attendance" />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold">Subject Performance <span className="text-xs font-normal text-slate-400">(Theory Subjects)</span></h3>
                    <p className="text-[10px] text-slate-400 mt-1">Internal marks distribution for each subject. Every subject contributes 40 marks.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-xs table-fixed">
                      <colgroup>
                        <col className="w-[22%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[11%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] text-slate-500">
                          <th className="px-5 py-3 text-left font-semibold">Subject</th>
                          <th className="px-2 py-3 text-center font-semibold">Assignment / 5</th>
                          <th className="px-2 py-3 text-center font-semibold">Presentation / 5</th>
                          <th className="px-2 py-3 text-center font-semibold">Attendance / 10</th>
                          <th className="px-2 py-3 text-center font-semibold">Midsem 1 / 10</th>
                          <th className="px-2 py-3 text-center font-semibold">Midsem 2 / 10</th>
                          <th className="px-2 py-3 text-center font-semibold">Basic Internal / 40</th>
                          <th className="px-2 py-3 text-center font-semibold">Moderated Internal / 40</th>
                          <th className="px-2 py-3 text-center font-semibold">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentStats.subjects.map((subject) => (
                          <tr key={subject.subjectId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 font-medium text-slate-800 leading-snug">{subject.name}</td>
                            <MarkCell value={subject.assignment} max={5} />
                            <MarkCell value={subject.presentation} max={5} />
                            <MarkCell value={subject.attendanceMark} max={10} />
                            <MarkCell value={subject.midsem1Mark} max={10} />
                            <MarkCell value={subject.midsem2Mark} max={10} />
                            <td className="px-2 py-3.5 text-center tabular-nums font-semibold text-slate-800">{formatNumber(subject.basicInternal)} / 40</td>
                            <td className="px-2 py-3.5 text-center tabular-nums font-semibold text-violet-700">{formatNumber(subject.moderatedInternal)} / 40</td>
                            <td className="px-2 py-3.5 text-center"><GradePill grade={subject.grade} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 text-[9px] text-slate-400">
                    Assignment, presentation, attendance, Midsem 1 and Midsem 2 are shown as their weighted contribution to the 40-mark internal total. Moderated Internal is shown separately from the basic internal marks.
                  </div>
                </section>
              </main>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${active ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );
}

function MarkCell({ value, max }: { value: number; max: number }) {
  return (
    <td className="px-2 py-3.5 text-center tabular-nums">
      <span className="font-semibold text-slate-800">{formatNumber(value)}</span>
      <span className="text-[9px] text-slate-400"> / {max}</span>
    </td>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm min-w-0 text-center">
      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600">{icon}</span>
        <span className="text-[10px] font-medium leading-tight">{label}</span>
      </div>
      <p className="text-lg font-semibold mt-3 truncate">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  );
}
