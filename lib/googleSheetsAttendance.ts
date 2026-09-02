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
 * The TD layout is column-oriented:
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

  const sheetId = target?.properties?.sheetId;
  if (!target?.properties?.title || typeof sheetId !== "number") {
    throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  }

  const title = target.properties.title;
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
    const enrollmentNo = cleanEnrollment(student.enrollmentNo);
    if (enrollmentNo) incoming.set(enrollmentNo, student.present);
  }

  if (incoming.size !== params.students.length) {
    throw new Error(`Attendance contains a student with an invalid enrollment number`);
  }

  for (const enrollmentNo of incoming.keys()) {
    if (!enrollmentRows.has(enrollmentNo)) {
      throw new Error(`Student ${enrollmentNo} is missing from TD-${params.subjectCode}; attendance was not written`);
    }
  }

  // Find an existing session first. This makes Edit update the same columns
  // rather than creating a duplicate session.
  let startColumn = -1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  for (let col = 3; col < maxColumns - 1; col++) {
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
    for (let col = 3; col < maxColumns - 1; col++) {
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
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!${startCol}6:${endCol}8`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [params.sessionKey, ""],
        [`${params.date} | ${params.slot}`, ""],
        ["LH", "LA"],
      ],
    },
  });

  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) {
    if (!incoming.has(enrollmentNo)) continue;
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] });
    writeRanges.push({ range: `'${title}'!${endCol}${rowNumber}`, values: [[incoming.get(enrollmentNo) ? 1 : 0]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: writeRanges,
    },
  });

  // Keep the top of the Teacher Diary useful while retaining the per-session
  // date/slot and unique key in the attendance table itself.
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

/**
 * Removes one attendance session's two-column block from the matching TD-* sheet.
 * The session is located by its stored date and time slot, not by a hard-coded
 * column position, so deleting an older or middle session keeps the remaining
 * sessions intact.
 */
export async function deleteTeacherDiaryAttendance(params: {
  spreadsheetId: string;
  subjectCode: string;
  date: string;
  slot: string;
}): Promise<{ sheetTitle: string; startColumn: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))",
  });

  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = (metadata.data.sheets || []).find((sheet) => {
    const title = sheet.properties?.title || "";
    return title.toLowerCase().replace(/\s+/g, "") === normalizedTarget;
  });

  const sheetId = target?.properties?.sheetId;
  const title = target?.properties?.title;
  if (!title || typeof sheetId !== "number") {
    throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  }

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
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let startColumn = -1;
  for (let col = 3; col < maxColumns - 1; col++) {
    if (
      sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) &&
      normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" &&
      normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la"
    ) {
      startColumn = col;
      break;
    }
  }

  if (startColumn === -1) {
    throw new Error(`Attendance session for ${params.date} at ${params.slot} was not found in TD-${params.subjectCode}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: startColumn,
              endIndex: startColumn + 2,
            },
          },
        },
      ],
    },
  });

  return { sheetTitle: title, startColumn };
}
