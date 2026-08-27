import {
  ClassRawData,
  MonthTab,
  SessionalRow,
} from "./googleSheetsClass";

import { Trend, round1 } from "./analysis";

export interface TrendSettings {
  previousMonth?: string;
  currentMonth?: string;
  criteria?: number;
}

export interface SectionStudentAnalysis {
  enrollmentNo: string;
  name: string;
  email: string;

  attendancePct: {
    prevMonth: number;
    currMonth: number;
    trend: Trend;
  };

  examMarks: {
    midsem1: number | null;
    midsem2: number | null;
    midsem1Max: number;
    midsem2Max: number;
    midsem1Subjects: { code: string; marks: number | null; max: number; pass: boolean }[];
    midsem2Subjects: { code: string; marks: number | null; max: number; pass: boolean }[];
    combined: number; // average of midsem1 + midsem2 (or whichever exists)
    max: number; // the better (higher) of midsem1 / midsem2
    // legacy field some older views still read — same as `combined`
    total: number;
    grade: string;
  };
}

export interface SectionAnalysis {
  totalStudents: number;

  availableMonths: string[];

  trendCounts: {
    increasing: number;
    decreasing: number;
    stable: number;
  };

  monthsUsed: {
    previous: string | null;
    current: string;
  };

  trendCriteria: number;

  classAverageCurrMonth: number;
  classAveragePrevMonth: number;
  overallTrendPct: number;

  attendanceBuckets: {
    below30: number;
    to49: number;
    to74: number;
    above75: number;
  };

  examPassRate: number;

  topPerformers: {
    name: string;
    marks: number;
  }[];

  atRiskStudents: {
    name: string;
    marks: number;
  }[];

  students: SectionStudentAnalysis[];
}

function gradeForExam(
  total: number,
  max: number
): string {
  if (max <= 0) return "Needs Attention";

  const pct = (total / max) * 100;

  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";

  return "Critical Risk";
}

function overallPctForStudent(
  row:
    | {
        subjects: {
          lh: number;
          la: number;
        }[];
      }
    | undefined
): number {
  if (!row) return 0;

  const totalLh = row.subjects.reduce(
    (sum, subject) => sum + subject.lh,
    0
  );

  const totalLa = row.subjects.reduce(
    (sum, subject) => sum + subject.la,
    0
  );

  if (totalLh <= 0) return 0;

  return (totalLa / totalLh) * 100;
}

function classifyTrendWithCriteria(
  previous: number,
  current: number,
  criteria: number
): Trend {
  const difference = current - previous;

  if (difference >= criteria) {
    return "Increasing";
  }

  if (difference <= -criteria) {
    return "Decreasing";
  }

  return "Stable";
}

function createRoster(
  currentMonth: MonthTab,
  previousMonth?: MonthTab
) {
  const roster = new Map<
    string,
    {
      enrollmentNo: string;
      name: string;
      email: string;
    }
  >();

  // Previous month first.
  // Current month overwrites the name/email if necessary.
  (previousMonth?.rows || []).forEach((student) => {
    if (!roster.has(student.enrollmentNo)) {
      roster.set(student.enrollmentNo, {
        enrollmentNo: student.enrollmentNo,
        name: student.name,
        email: student.email,
      });
    }
  });

  currentMonth.rows.forEach((student) => {
    roster.set(student.enrollmentNo, {
      enrollmentNo: student.enrollmentNo,
      name: student.name,
      email: student.email,
    });
  });

  return Array.from(roster.values());
}

export function computeSectionAnalysis(
  raw: ClassRawData,
  settings: TrendSettings = {}
): SectionAnalysis {
  const months = raw.months;

  if (months.length === 0) {
    throw new Error(
      "No attendance month sheets were found."
    );
  }

  let currentMonth: MonthTab | undefined;
  let previousMonth: MonthTab | undefined;

  if (settings.currentMonth) {
    currentMonth = months.find(
      (month) =>
        month.tabName === settings.currentMonth
    );
  }

  if (!currentMonth) {
    currentMonth = months[months.length - 1];
  }

  if (settings.previousMonth) {
    previousMonth = months.find(
      (month) =>
        month.tabName === settings.previousMonth
    );
  }

  if (!previousMonth) {
    const currentIndex = months.findIndex(
      (month) =>
        month.tabName === currentMonth?.tabName
    );

    previousMonth =
      currentIndex > 0
        ? months[currentIndex - 1]
        : undefined;
  }

  const trendCriteria =
    typeof settings.criteria === "number" &&
    Number.isFinite(settings.criteria) &&
    settings.criteria >= 0
      ? settings.criteria
      : 5;

  const roster = createRoster(
    currentMonth,
    previousMonth
  );

  // Each sessional tab (1st sessional, 2nd sessional, ...) is kept
  // separate now, so Midsem 1 and Midsem 2 can be shown/graded on their
  // own, not just merged into one pool.
  const assumedMaxPerSubject = 30;
  const PASS_MARKS = 12; // 40% of 30 — confirmed passing threshold

  const exam1Tab = raw.sessionals?.[0];
  const exam2Tab = raw.sessionals?.[1];

  const exam1ByEnrollment = new Map<string, SessionalRow>(
    (exam1Tab?.rows || []).map((row) => [row.enrollmentNo, row])
  );
  const exam2ByEnrollment = new Map<string, SessionalRow>(
    (exam2Tab?.rows || []).map((row) => [row.enrollmentNo, row])
  );

  function examTotalFor(row: SessionalRow | undefined): number | null {
    if (!row) return null;
    return row.subjects.reduce((sum, s) => sum + (s.marks ?? 0), 0);
  }

  function examMaxFor(row: SessionalRow | undefined): number {
    return (row?.subjects.length || 0) * assumedMaxPerSubject;
  }

  function subjectBreakdownFor(row: SessionalRow | undefined) {
    return (row?.subjects || []).map((s) => ({
      code: s.code,
      marks: s.marks,
      max: assumedMaxPerSubject,
      pass: (s.marks ?? 0) >= PASS_MARKS,
    }));
  }

  const currByEnrollment = new Map(
    currentMonth.rows.map((row) => [
      row.enrollmentNo,
      row,
    ])
  );

  const prevByEnrollment = new Map(
    (previousMonth?.rows || []).map((row) => [
      row.enrollmentNo,
      row,
    ])
  );

  const students: SectionStudentAnalysis[] =
    roster.map((student) => {
      const currPct = round1(
        overallPctForStudent(
          currByEnrollment.get(
            student.enrollmentNo
          )
        )
      );

      const prevPct = round1(
        overallPctForStudent(
          prevByEnrollment.get(
            student.enrollmentNo
          )
        )
      );

      const midsem1 = examTotalFor(exam1ByEnrollment.get(student.enrollmentNo));
      const midsem2 = examTotalFor(exam2ByEnrollment.get(student.enrollmentNo));
      const midsem1Max = examMaxFor(exam1ByEnrollment.get(student.enrollmentNo));
      const midsem2Max = examMaxFor(exam2ByEnrollment.get(student.enrollmentNo));
      const midsem1Subjects = subjectBreakdownFor(exam1ByEnrollment.get(student.enrollmentNo));
      const midsem2Subjects = subjectBreakdownFor(exam2ByEnrollment.get(student.enrollmentNo));

      // Combined = average of whichever exams exist; Max = the better of the two.
      const presentScores = [midsem1, midsem2].filter(
        (v): v is number => v !== null
      );
      const combined =
        presentScores.length > 0
          ? round1(presentScores.reduce((a, b) => a + b, 0) / presentScores.length)
          : 0;
      const maxOfTwo = presentScores.length > 0 ? Math.max(...presentScores) : 0;
      const combinedMax = Math.max(midsem1Max, midsem2Max) || 1;

      return {
        enrollmentNo: student.enrollmentNo,
        name: student.name,
        email: student.email,

        attendancePct: {
          prevMonth: prevPct,
          currMonth: currPct,
          trend: classifyTrendWithCriteria(
            prevPct,
            currPct,
            trendCriteria
          ),
        },

        examMarks: {
          midsem1,
          midsem2,
          midsem1Max,
          midsem2Max,
          midsem1Subjects,
          midsem2Subjects,
          combined,
          max: maxOfTwo,
          total: combined, // legacy alias
          grade: gradeForExam(combined, combinedMax),
        },
      };
    });

  const trendCounts = students.reduce(
    (counts, student) => {
      if (
        student.attendancePct.trend ===
        "Increasing"
      ) {
        counts.increasing++;
      } else if (
        student.attendancePct.trend ===
        "Decreasing"
      ) {
        counts.decreasing++;
      } else {
        counts.stable++;
      }

      return counts;
    },
    {
      increasing: 0,
      decreasing: 0,
      stable: 0,
    }
  );

  const totalStudents = students.length;

  const safeTotalStudents =
    totalStudents || 1;

  const classAverageCurrMonth =
    students.reduce(
      (sum, student) =>
        sum +
        student.attendancePct.currMonth,
      0
    ) / safeTotalStudents;

  const classAveragePrevMonth =
    students.reduce(
      (sum, student) =>
        sum +
        student.attendancePct.prevMonth,
      0
    ) / safeTotalStudents;

  const attendanceBuckets = students.reduce(
    (acc, student) => {
      const pct =
        student.attendancePct.currMonth;

      if (pct < 30) {
        acc.below30++;
      } else if (pct < 50) {
        acc.to49++;
      } else if (pct < 75) {
        acc.to74++;
      } else {
        acc.above75++;
      }

      return acc;
    },
    {
      below30: 0,
      to49: 0,
      to74: 0,
      above75: 0,
    }
  );

  const passCount = students.filter(
    (student) =>
      student.examMarks.total > 0
  ).length;

  const examPassRate = Math.round(
    (passCount / safeTotalStudents) * 100
  );

  const sortedByMarks = [...students].sort(
    (a, b) =>
      b.examMarks.total -
      a.examMarks.total
  );

  return {
    totalStudents,

    availableMonths: months.map(
      (month) => month.tabName
    ),

    trendCounts,

    monthsUsed: {
      previous:
        previousMonth?.tabName ?? null,
      current: currentMonth.tabName,
    },

    trendCriteria,

    classAverageCurrMonth: round1(
      classAverageCurrMonth
    ),

    classAveragePrevMonth: round1(
      classAveragePrevMonth
    ),

    overallTrendPct: round1(
      classAverageCurrMonth -
        classAveragePrevMonth
    ),

    attendanceBuckets,

    examPassRate,

    topPerformers: sortedByMarks
      .slice(0, 5)
      .map((student) => ({
        name: student.name,
        marks: student.examMarks.total,
      })),

    atRiskStudents: sortedByMarks
      .slice(-5)
      .reverse()
      .map((student) => ({
        name: student.name,
        marks: student.examMarks.total,
      })),

    students,
  };
}