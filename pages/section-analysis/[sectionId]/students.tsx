import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Award,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${tone.border} ${tone.bg} ${tone.text} ${large ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[9px]"} font-semibold`}>
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
    <div className="min-h-screen max-w-[1900px] mx-auto px-6 lg:px-8 py-6 text-slate-900">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Class / Section Analysis</h1>
            {computedAt && <span className="text-[10px] text-slate-400">• Last synced {new Date(computedAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
      {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !data && <div className="py-14 text-center text-sm text-slate-500">Loading student report...</div>}

      {data && (
        <>
          <div className="mt-5 mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Individual academic profile</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Student Report</h2>
              <p className="mt-1 text-xs text-slate-500">Detailed internal performance across {Math.min(SUBJECT_COUNT, data.subjects.length)} theory subjects.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-[10px] font-medium text-violet-700">
              <BarChart3 size={14} /> Internal assessment · 240 marks
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[275px_minmax(0,1fr)] gap-4 items-start">
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden xl:sticky xl:top-5">
              <div className="bg-gradient-to-br from-violet-50 via-white to-white p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-600">Class roster</p>
                    <h3 className="mt-1 font-semibold text-slate-900">Students</h3>
                  </div>
                  <span className="rounded-full bg-white border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">{students.length}</span>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or enrollment no."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
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

              <div className="max-h-[560px] overflow-y-auto p-2">
                {filteredStudents.map((student) => (
                  <button
                    key={student.enrollmentNo}
                    onClick={() => setSelectedEnrollment(student.enrollmentNo)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${student.enrollmentNo === selected?.enrollmentNo ? "bg-[#4a32a0] text-white shadow-[0_7px_18px_rgba(74,50,160,.18)]" : "hover:bg-slate-50 text-slate-700"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold">{student.name}</span>
                        <span className={`block text-[9px] mt-0.5 ${student.enrollmentNo === selected?.enrollmentNo ? "text-violet-100" : "text-slate-400"}`}>{student.enrollmentNo}</span>
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
                <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="absolute inset-y-0 left-0 w-1 bg-violet-600" />
                  <div className="p-5 lg:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-700 ring-4 ring-violet-50">
                          {selected.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Student profile</p>
                          <h3 className="mt-1 text-xl font-semibold tracking-tight truncate">{selected.name}</h3>
                          <p className="text-[10px] text-slate-400 mt-1 truncate">{selected.enrollmentNo} <span className="mx-1">·</span> {selected.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 lg:gap-8">
                        <div className="hidden sm:block h-10 w-px bg-slate-100" />
                        <div className="text-right">
                          <GradePill grade={studentStats.grade} large />
                          <p className="text-[9px] text-slate-400 mt-2">Rank by average</p>
                          <p className="text-sm font-bold text-slate-900">{studentStats.rank} <span className="font-normal text-slate-400">/ {students.length}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Metric icon={<BarChart3 size={16} />} label="Average" value={`${formatNumber(studentStats.average)} / 40`} sub={`${studentStats.averagePct.toFixed(1)}% overall`} />
                  <Metric icon={<Award size={16} />} label="Total" value={`${formatNumber(studentStats.total)} / ${TOTAL_MAX}`} sub="6 subjects · 240 max" />
                  <Metric icon={<TrendingUp size={16} />} label="Highest Subject" value={studentStats.highest ? formatNumber(studentStats.highest.basicInternal) : "—"} sub={studentStats.highest?.code || "—"} />
                  <Metric icon={<TrendingDown size={16} />} label="Lowest Subject" value={studentStats.lowest ? formatNumber(studentStats.lowest.basicInternal) : "—"} sub={studentStats.lowest?.code || "—"} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-white to-violet-50/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-violet-500" />
                        <h3 className="font-semibold text-slate-900">Subject Performance</h3>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600">6 Theory Subjects</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Weighted components and internal marks for each subject.</p>
                    </div>
                    <div className="text-[9px] text-slate-400">Each subject · 40 marks</div>
                  </div>

                  <div className="w-full overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-[9px]">
                      <colgroup>
                        <col className="w-[23%]" />
                        <col className="w-[8.5%]" />
                        <col className="w-[8.5%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-[8px] uppercase tracking-[0.05em] text-slate-500">
                          <th className="px-4 py-3 text-left font-bold">Subject</th>
                          <th className="px-1.5 py-3 text-center font-bold">Assign.<br />/ 5</th>
                          <th className="px-1.5 py-3 text-center font-bold">Present.<br />/ 5</th>
                          <th className="px-1.5 py-3 text-center font-bold">Attend.<br />/ 10</th>
                          <th className="px-1.5 py-3 text-center font-bold">Midsem 1<br />/ 10</th>
                          <th className="px-1.5 py-3 text-center font-bold">Midsem 2<br />/ 10</th>
                          <th className="px-1.5 py-3 text-center font-bold">Basic Internal<br />/ 40</th>
                          <th className="px-1.5 py-3 text-center font-bold">Moderated<br />/ 40</th>
                          <th className="px-1.5 py-3 text-center font-bold">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentStats.subjects.map((subject, index) => (
                          <tr key={subject.subjectId} className="border-b border-slate-50 last:border-0 hover:bg-violet-50/30">
                            <td className="px-4 py-3 text-left align-middle">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[8px] font-bold text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-[10px] text-slate-800 leading-tight truncate" title={subject.name}>{subject.name}</div>
                                  <div className="mt-0.5 text-[8px] text-slate-400">{subject.code}</div>
                                </div>
                              </div>
                            </td>
                            <MarkCell value={subject.assignment} max={5} />
                            <MarkCell value={subject.presentation} max={5} />
                            <MarkCell value={subject.attendanceMark} max={10} />
                            <MarkCell value={subject.midsem1Mark} max={10} />
                            <MarkCell value={subject.midsem2Mark} max={10} />
                            <td className="px-1 py-3 text-center tabular-nums font-bold text-slate-800">{formatNumber(subject.basicInternal)}<span className="text-[8px] font-normal text-slate-400"> / 40</span></td>
                            <td className="px-1 py-3 text-center tabular-nums font-bold text-violet-700">{formatNumber(subject.moderatedInternal)}<span className="text-[8px] font-normal text-violet-300"> / 40</span></td>
                            <td className="px-1 py-3 text-center"><GradePill grade={subject.grade} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/40 text-[8px] text-slate-400">
                    <span>Weighted components contribute to the 40-mark basic internal total.</span>
                    <span className="hidden sm:inline">Moderated Internal shown separately.</span>
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
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-medium ${active ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );
}

function MarkCell({ value, max }: { value: number; max: number }) {
  return (
    <td className="px-1 py-3 text-center tabular-nums">
      <span className="font-semibold text-slate-800">{formatNumber(value)}</span>
      <span className="text-[8px] text-slate-400"> / {max}</span>
    </td>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm min-w-0">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-500/60" />
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">{icon}</span>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">{label}</p>
          <p className="text-base font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-2 truncate">{sub}</p>
    </div>
  );
}
