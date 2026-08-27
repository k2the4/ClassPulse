import { getSheetsClient } from "./googleSheetsClient";

export interface MonthlyAttendanceRow {
  enrollmentNo: string;
  name: string;
  email: string;
  subjects: {
    code: string;
    lh: number;
    la: number;
  }[];
}

export interface MonthTab {
  tabName: string;
  rows: MonthlyAttendanceRow[];
}

export interface SessionalRow {
  enrollmentNo: string;
  name: string;
  email: string;
  subjects: {
    code: string;
    marks: number | null;
  }[];
}

export interface SessionalTab {
  tabName: string;
  rows: SessionalRow[];
}

export interface AssignmentRow {
  enrollmentNo: string;
  name: string;
  email: string;
  subjects: {
    code: string;
    submitted: number;
    total: number;
  }[];
}

export interface ClassRawData {
  months: MonthTab[];
  // one entry per sessional exam tab found (e.g. "1st sessional", "2nd sessional")
  sessionals: SessionalTab[];
  // "Assignment" tab: AS/TA (submitted/total) pairs, one pair per subject
  assignment: AssignmentRow[];
  // "Presentation" tab: single mark per subject, out of 10
  presentation: SessionalRow[];
}

const NON_MONTH_TAB_HINTS = [
  "dashboard",
  "insight",
  "analysis",
  "sessional",
  "midsem",
  "mid sem",
  "summary",
  "risk",
  "raw data",
  "rawdata",
  "assignment",
  "presentation",
];

const MONTH_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*[-,/_]?\s*(\d{2,4}))?/i;

function looksLikeMonthTab(title: string): boolean {
  const clean = title.trim();
  const lower = clean.toLowerCase();

  if (!clean) return false;

  if (NON_MONTH_TAB_HINTS.some((hint) => lower.includes(hint))) {
    return false;
  }

  return MONTH_PATTERN.test(clean);
}

function looksLikeSessionalTab(title: string): boolean {
  const lower = title.trim().toLowerCase();

  return (
    lower.includes("sessional") ||
    lower.includes("midsem") ||
    lower.includes("mid sem")
  );
}

function sessionalOrdinal(title: string): number {
  const match = title.trim().toLowerCase().match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function monthSortKey(title: string): number {
  const clean = title.trim();
  const match = clean.match(MONTH_PATTERN);

  if (!match) return Number.MAX_SAFE_INTEGER;

  const monthName = match[1].toLowerCase();
  const yearRaw = match[2];

  const monthMap: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  const month = monthMap[monthName] ?? 0;

  let year = 2026;

  if (yearRaw) {
    year = Number(yearRaw);

    if (year < 100) {
      year += 2000;
    }
  }

  return new Date(year, month, 1).getTime();
}

function cleanEnrollment(value: unknown): string {
  let raw = String(value ?? "").trim();

  if (!raw) return "";

  raw = raw.replace(/^'+/, "").replace(/\s+/g, "");

  const scientificMatch = raw.match(
    /^(\d+(?:\.\d+)?)e\+?(\d+)$/i
  );

  if (scientificMatch) {
    const num = Number(raw);

    if (Number.isFinite(num)) {
      return Math.round(num).toString();
    }
  }

  raw = raw.replace(/\.0$/, "");

  return raw;
}

function parseNumber(value: unknown): number {
  const raw = String(value ?? "").trim();

  if (!raw) return 0;

  const cleaned = raw.replace(/,/g, "");
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Parses one monthly attendance sheet. Subject columns are detected by
 * scanning the row for contiguous LH/LA pairs wherever they start — we
 * don't assume a fixed number of leading ID columns (S.No, Enrollment no,
 * Name, Email, ...), since that count isn't guaranteed to match every
 * sheet exactly and being off by even one column means zero pairs match.
 */
function parseMonthRows(
  allRows: string[][]
): MonthlyAttendanceRow[] {
  function findLhLaStart(row: string[]): number {
    for (let col = 0; col + 1 < row.length; col++) {
      const left = String(row[col] ?? "").trim().toLowerCase();
      const right = String(row[col + 1] ?? "").trim().toLowerCase();
      if (left === "lh" && right === "la") return col;
    }
    return -1;
  }

  const headerRowIndex = allRows.findIndex((row) => {
    if (!row || row.length < 5) return false;
    return findLhLaStart(row) !== -1;
  });

  if (headerRowIndex === -1) {
    return [];
  }

  const headerRow = allRows[headerRowIndex] || [];
  const startCol = findLhLaStart(headerRow);

  const possibleSubjectRows = [
    headerRowIndex - 2,
    headerRowIndex - 1,
  ].filter((index) => index >= 0);

  const subjectCols: {
    code: string;
    lhCol: number;
    laCol: number;
  }[] = [];

  for (let col = startCol; col + 1 < headerRow.length; col += 2) {
    const headerLeft = String(headerRow[col] ?? "")
      .trim()
      .toLowerCase();

    const headerRight = String(headerRow[col + 1] ?? "")
      .trim()
      .toLowerCase();

    // Stop once we hit the trailing Total Held/Total Attended/%/Sign
    // columns — they aren't an LH/LA pair, which ends the subject block.
    if (headerLeft !== "lh" || headerRight !== "la") {
      break;
    }

    let code = "";

    for (const subjectRowIndex of possibleSubjectRows) {
      const candidate = String(
        allRows[subjectRowIndex]?.[col] ?? ""
      ).trim();

      if (candidate) {
        code = candidate;
        break;
      }
    }

    subjectCols.push({
      code: code || `Subject ${subjectCols.length + 1}`,
      lhCol: col,
      laCol: col + 1,
    });
  }

  // Enrollment No. and Name are almost always columns 1 and 2 (S.No is 0),
  // regardless of how many ID columns exist before the subjects start.
  const enrollmentCol = 1;
  const nameCol = 2;

  const students: MonthlyAttendanceRow[] = [];

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < allRows.length;
    rowIndex++
  ) {
    const row = allRows[rowIndex] || [];

    const enrollmentNo = cleanEnrollment(row[enrollmentCol]);
    const name = String(row[nameCol] ?? "").trim();

    // Skip blank/formatting rows without stopping the parser.
    if (!enrollmentNo) {
      continue;
    }

    // Only student enrollment numbers are expected here.
    if (!/^\d+$/.test(enrollmentNo)) {
      continue;
    }

    students.push({
      enrollmentNo,
      name,
      email: String(row[3] ?? "").trim(),
      subjects: subjectCols.map((subject) => ({
        code: subject.code,
        lh: parseNumber(row[subject.lhCol]),
        la: parseNumber(row[subject.laCol]),
      })),
    });
  }

  return students;
}

function parseSessionalRows(
  allRows: string[][]
): SessionalRow[] {
  const headerRowIndex = allRows.findIndex((row) => {
    const enrollment = String(row?.[1] ?? "")
      .trim()
      .toLowerCase()
      .replace(/\./g, "");

    return (
      enrollment === "enrollment no" ||
      enrollment === "enrollment number" ||
      enrollment === "enrollmentno"
    );
  });

  if (headerRowIndex === -1) {
    return [];
  }

  const headerRow = allRows[headerRowIndex] || [];

  const subjectCols: {
    code: string;
    col: number;
  }[] = [];

  for (let col = 4; col < headerRow.length; col++) {
    const raw = String(headerRow[col] ?? "").trim();

    if (!raw) continue;

    const code = raw.split("\n")[0].split(/\s+/)[0].trim();

    if (code) {
      subjectCols.push({
        code,
        col,
      });
    }
  }

  const students: SessionalRow[] = [];

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < allRows.length;
    rowIndex++
  ) {
    const row = allRows[rowIndex] || [];

    const enrollmentNo = cleanEnrollment(row[1]);

    if (!enrollmentNo) {
      continue;
    }

    if (!/^\d+$/.test(enrollmentNo)) {
      continue;
    }

    const name = String(row[2] ?? "").trim();
    const email = String(row[3] ?? "").trim();

    students.push({
      enrollmentNo,
      name,
      email,
      subjects: subjectCols.map((subject) => {
        const raw = String(
          row[subject.col] ?? ""
        ).trim();

        const marks = Number(raw);

        // Non-numeric entries (—, AB, A, blank, etc.) mean the student
        // didn't sit that subject's exam — treated as 0 marks, not as
        // missing data, so they still show up in totals and filters.
        return {
          code: subject.code,
          marks:
            raw !== "" && Number.isFinite(marks)
              ? marks
              : 0,
        };
      }),
    });
  }

  return students;
}

// Normalizes a subject code for matching across tabs that spell it
// differently (e.g. month tabs use "SSMDA", Assignment/Presentation/
// Sessional tabs use "SSM&DA") — uppercase, strip anything that isn't a
// letter or digit.
export function normalizeSubjectCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function subjectCodesMatch(a: string, b: string): boolean {
  const left = normalizeSubjectCode(a);
  const right = normalizeSubjectCode(b);

  // Exact match first.
  if (left === right) return true;

  // The raw sheets and database do not always store the same full label.
  // Examples from this project:
  //   Sheet: "DA"          Database: "DA 338 T"
  //   Sheet: "PME"         Database: "PME (MS-302)"
  //   Sheet: "SSM&DA"      Database: "SSM&DA DA 304 T"
  // In those cases the subject abbreviation is the first token.
  const firstToken = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .split(/[\s(\[]+/)[0]
      .replace(/[^A-Z0-9]/g, "");

  const leftToken = firstToken(a);
  const rightToken = firstToken(b);

  return Boolean(leftToken && rightToken && leftToken === rightToken);
}

/**
 * Parses the "Assignment" tab: AS (submitted) / TA (total) pairs, one pair
 * per subject — same physical layout as the monthly LH/LA attendance pairs,
 * just with different column labels and only 6 subjects (no UHE here).
 */
function parseAssignmentRows(allRows: string[][]): AssignmentRow[] {
  function findAsTaStart(row: string[]): number {
    for (let col = 0; col + 1 < row.length; col++) {
      const left = String(row[col] ?? "").trim().toLowerCase();
      const right = String(row[col + 1] ?? "").trim().toLowerCase();
      if (left === "as" && right === "ta") return col;
    }
    return -1;
  }

  const headerRowIndex = allRows.findIndex((row) => {
    if (!row || row.length < 5) return false;
    return findAsTaStart(row) !== -1;
  });

  if (headerRowIndex === -1) return [];

  const headerRow = allRows[headerRowIndex] || [];
  const startCol = findAsTaStart(headerRow);

  const possibleSubjectRows = [headerRowIndex - 2, headerRowIndex - 1].filter((i) => i >= 0);

  const subjectCols: { code: string; submittedCol: number; totalCol: number }[] = [];

  for (let col = startCol; col + 1 < headerRow.length; col += 2) {
    const left = String(headerRow[col] ?? "").trim().toLowerCase();
    const right = String(headerRow[col + 1] ?? "").trim().toLowerCase();
    if (left !== "as" || right !== "ta") break;

    let code = "";
    for (const subjectRowIndex of possibleSubjectRows) {
      const candidate = String(allRows[subjectRowIndex]?.[col] ?? "")
        .split("\n")[0]
        .split(/\s+/)[0]
        .trim();
      if (candidate) {
        code = candidate;
        break;
      }
    }

    subjectCols.push({
      code: code || `Subject ${subjectCols.length + 1}`,
      submittedCol: col,
      totalCol: col + 1,
    });
  }

  const rows: AssignmentRow[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < allRows.length; rowIndex++) {
    const row = allRows[rowIndex] || [];
    const enrollmentNo = cleanEnrollment(row[1]);
    if (!enrollmentNo) continue;
    if (!/^\d+$/.test(enrollmentNo)) continue;

    rows.push({
      enrollmentNo,
      name: String(row[2] ?? "").trim(),
      email: String(row[3] ?? "").trim(),
      subjects: subjectCols.map((s) => ({
        code: s.code,
        submitted: parseNumber(row[s.submittedCol]),
        total: parseNumber(row[s.totalCol]),
      })),
    });
  }

  return rows;
}

export async function fetchClassRawData(
  sheetId: string
): Promise<ClassRawData> {
  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
  });

  const allTitles = (meta.data.sheets || [])
    .map((sheet) => sheet.properties?.title || "")
    .filter(Boolean);

  const monthTitles = allTitles
    .filter(looksLikeMonthTab)
    .sort((a, b) => monthSortKey(a) - monthSortKey(b));

  const sessionalTitles = allTitles
    .filter(looksLikeSessionalTab)
    .sort((a, b) => sessionalOrdinal(a) - sessionalOrdinal(b));

  const months: MonthTab[] = [];

  for (const title of monthTitles) {
    const result =
      await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${title}'!A1:AZ500`,
      });

    const rows = parseMonthRows(
      result.data.values || []
    );

    if (rows.length > 0) {
      months.push({
        tabName: title,
        rows,
      });
    }
  }

  const sessionals: SessionalTab[] = [];

  for (const title of sessionalTitles) {
    const result =
      await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${title}'!A1:AZ500`,
      });

    const rows = parseSessionalRows(
      result.data.values || []
    );

    if (rows.length > 0) {
      sessionals.push({ tabName: title, rows });
    }
  }

  if (months.length === 0) {
    throw new Error(
      `No monthly attendance tabs were detected. Available tabs: ${allTitles.join(
        ", "
      )}`
    );
  }

  const assignmentTitle = allTitles.find(
    (t) => t.trim().toLowerCase() === "assignment"
  );
  const presentationTitle = allTitles.find(
    (t) => t.trim().toLowerCase() === "presentation"
  );

  let assignment: AssignmentRow[] = [];
  if (assignmentTitle) {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${assignmentTitle}'!A1:AZ500`,
    });
    assignment = parseAssignmentRows(result.data.values || []);
  }

  let presentation: SessionalRow[] = [];
  if (presentationTitle) {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${presentationTitle}'!A1:AZ500`,
    });
    presentation = parseSessionalRows(result.data.values || []);
  }

  return {
    months,
    sessionals,
    assignment,
    presentation,
  };
}
