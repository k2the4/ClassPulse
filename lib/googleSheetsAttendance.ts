import { getSheetsClient } from "./googleSheetsClient";

export interface AttendanceSheetStudent {
  enrollmentNo: string;
  present: boolean;
}

function cleanEnrollment(value: unknown): string {
  let raw = String(value ?? "").trim().replace(/^'+/, "").replace(/\s+/g, "");
  if (!raw) return "";
  const scientific = raw.match(/^(\d+(?:\.\d+)?)e\+?(\d+)$/i);
  if (scientific) {
    const number = Number(raw);
    if (Number.isFinite(number)) return Math.round(number).toString();
  }
  return raw.replace(/\.0$/, "");
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function columnName(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function findStudentHeader(rows: string[][]): number {
  return rows.findIndex((row) => {
    const a = normalize(row?.[0]);
    const b = normalize(row?.[1]);
    const c = normalize(row?.[2]);
    return a === "s.no" && b.includes("enrollment") && c.includes("student");
  });
}

function sessionHeaderMatches(value: unknown, date: string, slot: string): boolean {
  const text = normalize(value);
  const target = normalize(`${date} | ${slot}`);
  return text === target || text === normalize(`${date} ${slot}`);
}

/**
 * Writes one attendance session into the existing TD-* sheet.
 *
 * The TD layout is intentionally column-oriented:
 *   row N:     date | slot
 *   row N + 1: LH | LA
 *   row N + 2+: student attendance
 *
 * Existing students are matched by enrollment number, never by database row
 * position. This preserves the Google Sheet's serial/order exactly.
 */
export async function writeTeacherDiaryAttendance(params: {
  spreadsheetId: string;
  subjectCode: string;
  subjectName: string;
  classLabel: string;
  teacherName: string;
  date: string;
  slot: string;
  sessionKey: string;
  students: AttendanceSheetStudent[];
}): Promise<{ sheetTitle: string; startColumn: number; present: number; total: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))",
  });

  const sheetsList = metadata.data.sheets || [];
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = sheetsList.find((sheet) => {
    const title = sheet.properties?.title || "";
    return title.toLowerCase().replace(/\s+/g, "") === normalizedTarget;
  });

  if (!target?.properties?.title || target.properties.sheetId === undefined) {
    throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  }

  const title = target.properties.title;
  const sheetId = target.properties.sheetId;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);

  if (headerRow === -1) {
    throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
  }

  const attendanceSubHeaderRow = headerRow + 1;
  const studentStartRow = headerRow + 2;
  const enrollmentRows = new Map<string, number>();

  for (let rowIndex = studentStartRow; rowIndex < rows.length; rowIndex++) {
    const enrollmentNo = cleanEnrollment(rows[rowIndex]?.[1]);
    if (enrollmentNo) enrollmentRows.set(enrollmentNo, rowIndex);
  }

  const incoming = new Map<string, boolean>();
  for (const student of params.students) {
    incoming.set(cleanEnrollment(student.enrollmentNo), student.present);
  }

  for (const enrollmentNo of incoming.keys()) {
    if (!enrollmentRows.has(enrollmentNo)) {
      throw new Error(`Student ${enrollmentNo} is missing from TD-${params.subjectCode}; attendance was not written`);
    }
  }

  // Find an existing session first. This makes Edit update the same columns
  // rather than creating a duplicate session.
  let startColumn = -1;
  for (let col = 3; col < Math.max(...rows.map((row) => row.length), 4); col++) {
    if (
      sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) &&
      normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" &&
      normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la"
    ) {
      startColumn = col;
      break;
    }
  }

  // New sessions are added as a two-column block. Keep one blank separator
  // between sessions, matching the existing TD layout shown in the sheet.
  if (startColumn === -1) {
    let lastSessionEnd = 2;
    for (let col = 3; col < Math.max(...rows.map((row) => row.length), 4) - 1; col++) {
      if (
        normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" &&
        normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la"
      ) {
        lastSessionEnd = col + 1;
      }
    }
    startColumn = lastSessionEnd === 2 ? 3 : lastSessionEnd + 2;
  }

  const requiredColumnCount = startColumn + 2;
  const currentColumnCount = target.properties.gridProperties?.columnCount || 26;
  if (requiredColumnCount > currentColumnCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: "COLUMNS",
              length: requiredColumnCount - currentColumnCount,
            },
          },
        ],
      },
    });
  }

  const startCol = columnName(startColumn);
  const endCol = columnName(startColumn + 1);
  const headerRange = `'${title}'!${startCol}6:${endCol}8`;
  const headerValues = [
    [params.sessionKey, ""],
    [`${params.date} | ${params.slot}`, ""],
    ["LH", "LA"],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: headerRange,
    valueInputOption: "RAW",
    requestBody: { values: headerValues },
  });

  const writeRanges: Array<{ range: string; values: (string | number)[][] }> = [];
  const lhValues: number[][] = [];
  const laValues: number[][] = [];

  for (const rowIndex of enrollmentRows.values()) {
    const enrollmentNo = cleanEnrollment(rows[rowIndex]?.[1]);
    const isPresent = incoming.get(enrollmentNo);
    if (isPresent === undefined) continue;
    lhValues.push([1]);
    laValues.push([isPresent ? 1 : 0]);
  }

  // Build writes by the actual sheet row positions so blank/formatting rows
  // cannot shift attendance onto a different student.
  const lhCells: Array<{ range: string; values: number[][] }> = [];
  const laCells: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) {
    if (!incoming.has(enrollmentNo)) continue;
    const rowNumber = rowIndex + 1;
    lhCells.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] });
    laCells.push({ range: `'${title}'!${endCol}${rowNumber}`, values: [[incoming.get(enrollmentNo) ? 1 : 0]] });
  }

  writeRanges.push(...lhCells, ...laCells);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: writeRanges,
    },
  });

  // Keep the static metadata at the top of the Teacher Diary useful and
  // identify the most recently recorded session without changing the table.
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: `'${title}'!A1:H5`,
          values: [
            [`TEACHER DIARY — ${params.subjectName}`, "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
            ["Class", params.classLabel, "", "Subject", params.subjectName, "", "Teacher", params.teacherName],
            ["Latest Session", params.date, params.slot, "Session ID", params.sessionKey, "", "", ""],
            ["Attendance is recorded below by date and time slot.", "", "", "", "", "", "", ""],
          ],
        },
      ],
    },
  });

  return {
    sheetTitle: title,
    startColumn,
    present: params.students.filter((student) => student.present).length,
    total: params.students.length,
  };
}
