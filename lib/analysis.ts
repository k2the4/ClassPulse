import {
  ClassRawData,
  MonthTab,
  SessionalRow,
  AssignmentRow,
  subjectCodesMatch,
} from "./googleSheetsClass";

export type Trend = "Increasing" | "Decreasing" | "Stable";

export interface StudentAnalysis {
  enrollmentNo: string;
  name: string;
  email: string;
  attendancePct: { prevMonth: number; currMonth: number; trend: Trend };
  attendanceHistory: { month: string; percentage: number }[];
  assignment: { submitted: number; total: number };
  presentation: number;
  midsem: { first: number; second: number; combined: number; max: number; grade: string };
  internalMarks: { basic: number; moderated: number };
}

export interface SubjectAnalysis {
  subjectCode: string;
  totalStudents: number;
  trendCriteria: number;
  availableMonths: string[];
  monthsUsed: { previous: string | null; current: string };
  classAverageCurrMonth: number;
  classAveragePrevMonth: number;
  classAverageBasicMarks: number;
  overallTrendPct: number;
  attendanceBuckets: { below30: number; to49: number; to74: number; above75: number };
  trendCounts: { increasing: number; decreasing: number; stable: number };
  midsemPassRate: number;
  topPerformers: { name: string; marks: number }[];
  atRiskStudents: { name: string; marks: number }[];
  students: StudentAnalysis[];
}

const DEFAULT_TREND_THRESHOLD = 3;
const MAX_PER_EXAM = 30;

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function classifyTrend(prev: number, curr: number, threshold = DEFAULT_TREND_THRESHOLD): Trend {
  const diff = curr - prev;
  if (diff > threshold) return "Increasing";
  if (diff < -threshold) return "Decreasing";
  return "Stable";
}

export function gradeFor(combined: number, max = MAX_PER_EXAM): string {
  if (max <= 0) return "Critical Risk";
  const pct = (combined / max) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}

function normalizeAttendanceSubjectCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Calculate attendance for the selected subject only.
 * The monthly source sheets use cumulative LH/LA totals, so use the
 * selected subject's exact LH/LA pair rather than combining subjects.
 */
function attendancePctForSubject(
  row: MonthTab["rows"][number] | undefined,
  subjectCode: string
): number {
  if (!row) return 0;

  const target = normalizeAttendanceSubjectCode(subjectCode);
  let match = row.subjects.find(
    (subject) => normalizeAttendanceSubjectCode(subject.code) === target
  );

  if (!match) {
    match = row.subjects.find((subject) => {
      const code = normalizeAttendanceSubjectCode(subject.code);
      const firstToken = code.split(/[\s(\[]+/)[0];
      const targetToken = target.split(/[\s(\[]+/)[0];
      const isLab = /(?:^|\s)LAB(?:\s|$)/.test(code);
      return !isLab && firstToken === targetToken;
    });
  }

  if (!match || match.lh <= 0) return 0;
  return round1((match.la / match.lh) * 100);
}

function marksForSubject(row: SessionalRow | undefined, subjectCode: string): number {
  if (!row) return 0;
  const match = row.subjects.find((s) => subjectCodesMatch(s.code, subjectCode));
  return match?.marks ?? 0;
}

function assignmentForSubject(
  row: AssignmentRow | undefined,
  subjectCode: string
): { submitted: number; total: number } {
  if (!row) return { submitted: 0, total: 0 };
  const match = row.subjects.find((s) => subjectCodesMatch(s.code, subjectCode));
  return match ? { submitted: match.submitted, total: match.total } : { submitted: 0, total: 0 };
}

export interface SubjectTrendSettings {
  previousMonth?: string;
  currentMonth?: string;
  trendCriteria?: number;
}

export function computeSubjectAnalysis(
  raw: ClassRawData,
  subjectCode: string,
  settings: SubjectTrendSettings = {}
): SubjectAnalysis {
  const trendCriteria = settings.trendCriteria ?? DEFAULT_TREND_THRESHOLD;
  const months = raw.months;

  let currentMonth: MonthTab | undefined;
  let previousMonth: MonthTab | undefined;

  if (settings.currentMonth) {
    currentMonth = months.find((m) => m.tabName === settings.currentMonth);
  }
  if (!currentMonth) currentMonth = months[months.length - 1];

  if (settings.previousMonth) {
    previousMonth = months.find((m) => m.tabName === settings.previousMonth);
  }
  if (!previousMonth && currentMonth) {
    const currentIndex = months.findIndex((m) => m.tabName === currentMonth?.tabName);
    previousMonth = currentIndex > 0 ? months[currentIndex - 1] : undefined;
  }

  if (!currentMonth) {
    throw new Error("No attendance months available for this subject analysis.");
  }

  const roster = currentMonth.rows.map((r) => ({
    enrollmentNo: r.enrollmentNo,
    name: r.name,
    email: r.email,
  }));

  const exam1 = raw.sessionals?.[0];
  const exam2 = raw.sessionals?.[1];
  const exam1ByEnrollment = new Map((exam1?.rows || []).map((r) => [r.enrollmentNo, r]));
  const exam2ByEnrollment = new Map((exam2?.rows || []).map((r) => [r.enrollmentNo, r]));
  const assignmentByEnrollment = new Map((raw.assignment || []).map((r) => [r.enrollmentNo, r]));
  const presentationByEnrollment = new Map((raw.presentation || []).map((r) => [r.enrollmentNo, r]));
  const currByEnrollment = new Map(currentMonth.rows.map((r) => [r.enrollmentNo, r]));
  const prevByEnrollment = new Map((previousMonth?.rows || []).map((r) => [r.enrollmentNo, r]));
  const monthRowsByEnrollment = new Map(
    months.map((month) => [month.tabName, new Map(month.rows.map((r) => [r.enrollmentNo, r]))])
  );

  const students: StudentAnalysis[] = roster.map((student) => {
    const currPct = attendancePctForSubject(currByEnrollment.get(student.enrollmentNo), subjectCode);
    const prevPct = attendancePctForSubject(prevByEnrollment.get(student.enrollmentNo), subjectCode);
    const attendanceHistory = months.map((month) => ({
      month: month.tabName,
      percentage: attendancePctForSubject(
        monthRowsByEnrollment.get(month.tabName)?.get(student.enrollmentNo),
        subjectCode
      ),
    }));

    const midsem1 = marksForSubject(exam1ByEnrollment.get(student.enrollmentNo), subjectCode);
    const midsem2 = marksForSubject(exam2ByEnrollment.get(student.enrollmentNo), subjectCode);
    const combined = round1((midsem1 + midsem2) / 2);

    const assignment = assignmentForSubject(assignmentByEnrollment.get(student.enrollmentNo), subjectCode);
    const presentation = marksForSubject(presentationByEnrollment.get(student.enrollmentNo), subjectCode);

    const weightedAssignment = assignment.total > 0 ? (assignment.submitted / assignment.total) * 5 : 0;
    const weightedPresentation = (presentation / 10) * 5;
    const weightedAttendance = (currPct / 100) * 10;
    const weightedMidsem1 = (midsem1 / 30) * 10;
    const weightedMidsem2 = (midsem2 / 30) * 10;
    const basic = round1(
      weightedAssignment + weightedPresentation + weightedAttendance + weightedMidsem1 + weightedMidsem2
    );

    return {
      enrollmentNo: student.enrollmentNo,
      name: student.name,
      email: student.email,
      attendancePct: {
        prevMonth: prevPct,
        currMonth: currPct,
        trend: classifyTrend(prevPct, currPct, trendCriteria),
      },
      attendanceHistory,
      assignment,
      presentation,
      midsem: {
        first: midsem1,
        second: midsem2,
        combined,
        max: Math.max(midsem1, midsem2),
        grade: gradeFor(combined),
      },
      internalMarks: { basic, moderated: 0 },
    };
  });

  const defaultCriteria = [
    { from: 1, to: 10, min: 38, max: 40 },
    { from: 11, to: 25, min: 35, max: 38 },
    { from: 26, to: 40, min: 31, max: 35 },
    { from: 41, to: 65, min: 25, max: 30 },
  ];

  [...students]
    .sort((a, b) => b.internalMarks.basic - a.internalMarks.basic || a.name.localeCompare(b.name))
    .forEach((student, index) => {
      const rank = index + 1;
      const tier = defaultCriteria.find((t) => rank >= t.from && rank <= t.to);
      if (!tier) {
        student.internalMarks.moderated = student.internalMarks.basic;
        return;
      }
      const t = tier.to === tier.from ? 0 : (rank - tier.from) / (tier.to - tier.from);
      student.internalMarks.moderated = round1(tier.max + (tier.min - tier.max) * t);
    });

  const totalStudents = students.length || 1;
  const classAverageCurrMonth = students.reduce((s, x) => s + x.attendancePct.currMonth, 0) / totalStudents;
  const classAveragePrevMonth = students.reduce((s, x) => s + x.attendancePct.prevMonth, 0) / totalStudents;
  const classAverageBasicMarks = students.reduce((s, x) => s + x.internalMarks.basic, 0) / totalStudents;

  const attendanceBuckets = students.reduce(
    (acc, s) => {
      const pct = s.attendancePct.currMonth;
      if (pct < 30) acc.below30++;
      else if (pct < 50) acc.to49++;
      else if (pct < 75) acc.to74++;
      else acc.above75++;
      return acc;
    },
    { below30: 0, to49: 0, to74: 0, above75: 0 }
  );

  const passCount = students.filter((s) => s.midsem.combined >= MAX_PER_EXAM * 0.4).length;
  const midsemPassRate = Math.round((passCount / totalStudents) * 100);

  const trendCounts = students.reduce(
    (acc, s) => {
      if (s.attendancePct.trend === "Increasing") acc.increasing++;
      else if (s.attendancePct.trend === "Decreasing") acc.decreasing++;
      else acc.stable++;
      return acc;
    },
    { increasing: 0, decreasing: 0, stable: 0 }
  );

  const sortedByMarks = [...students].sort((a, b) => b.midsem.combined - a.midsem.combined);

  return {
    subjectCode,
    totalStudents: students.length,
    trendCriteria,
    availableMonths: months.map((m) => m.tabName),
    monthsUsed: { previous: previousMonth?.tabName ?? null, current: currentMonth.tabName },
    classAverageCurrMonth: round1(classAverageCurrMonth),
    classAveragePrevMonth: round1(classAveragePrevMonth),
    classAverageBasicMarks: round1(classAverageBasicMarks),
    overallTrendPct: round1(
      ((classAverageCurrMonth - classAveragePrevMonth) / (classAveragePrevMonth || 1)) * 100
    ),
    attendanceBuckets,
    trendCounts,
    midsemPassRate,
    topPerformers: sortedByMarks.slice(0, 5).map((s) => ({ name: s.name, marks: s.midsem.combined })),
    atRiskStudents: sortedByMarks
      .slice(-5)
      .reverse()
      .map((s) => ({ name: s.name, marks: s.midsem.combined })),
    students,
  };
}

export function computeAllSubjectAnalyses(
  raw: ClassRawData,
  subjectCodes: string[],
  settings: SubjectTrendSettings = {}
): Record<string, SubjectAnalysis> {
  const result: Record<string, SubjectAnalysis> = {};
  subjectCodes.forEach((code) => {
    result[code] = computeSubjectAnalysis(raw, code, settings);
  });
  return result;
}
