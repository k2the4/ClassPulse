import { getSheetsClient } from "./googleSheetsClient";

export interface AttendanceSheetStudentFixed {
  enrollmentNo: string;
  present: boolean;
}

const TIME_SLOTS = [
  "8 to 9",
  "9 to 10",
  "10 to 11",
  "11 to 12",
  "12.30 to 1.30",
  "1.30 to 2.30",
  "2.30 to 3.30",
  "3.30 to 4.30",
] as const;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
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
  return rows.findIndex(
    (row) =>
      normalize(row?.[0]) === "s.no" &&
      normalize(row?.[1]).includes("enrollment") &&
      normalize(row?.[2]).includes("student"),
  );
}

function sessionHeaderMatches(value: unknown, date: string, slot: string): boolean {
  const text = normalize(value);
  return text === normalize(`${date} | ${slot}`) || text === normalize(`${date} ${slot}`);
}

function sessionSortKey(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
  if (!match) return null;
  const slotIndex = TIME_SLOTS.findIndex((item) => normalize(item) === normalize(match[2]));
  return `${match[1]}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(match[2])}`;
}

/**
 * Writes attendance using the actual Teacher Diary layout:
 * row N-2 = session date/slot, row N-1 = LH/LA, row N = roster header.
 */
export async function writeTeacherDiaryAttendanceFixed(params: {
  spreadsheetId: string;
  subjectCode: string;
  subjectName: string;
  classLabel: string;
  teacherName: string;
  date: string;
  slot: string;
  sessionKey: string;
  students: AttendanceSheetStudentFixed[];
}): Promise<{ sheetTitle: string; startColumn: number; present: number; total: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))",
  });
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = (metadata.data.sheets || []).find(
    (sheet) =>
      (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget,
  );
  const sheetId = target?.properties?.sheetId;
  const title = target?.properties?.title;
  if (!title || typeof sheetId !== "number") {
    throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  }

  const rowCount = Math.max(500, target.properties?.gridProperties?.rowCount || 500);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!A1:AZ${rowCount}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values || [];
  const rosterHeaderRow = findStudentHeader(rows);
  if (rosterHeaderRow < 2) {
    throw new Error(`TD-${params.subjectCode} does not have the expected Teacher Diary layout`);
  }

  // Actual sheet layout: session info is immediately above LH/LA, which is
  // immediately above the S.No / Enrollment / Student Name roster header.
  const attendanceHeaderRow = rosterHeaderRow - 1;
  const sessionInfoRow = rosterHeaderRow - 2;
  const studentStartRow = rosterHeaderRow + 1;

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
    throw new Error("Attendance contains a student with an invalid enrollment number");
  }
  for (const enrollmentNo of incoming.keys()) {
    if (!enrollmentRows.has(enrollmentNo)) {
      throw new Error(`Student ${enrollmentNo} is missing from TD-${params.subjectCode}; attendance was not written`);
    }
  }

  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  const slotIndex = TIME_SLOTS.findIndex((item) => normalize(item) === normalize(params.slot));
  const newSortKey = `${params.date}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(params.slot)}`;
  let startColumn = -1;
  let lastSessionEnd = 2;
  let insertionColumn = -1;

  for (let col = 3; col < maxColumns - 1; col++) {
    if (
      normalize(rows[attendanceHeaderRow]?.[col]) !== "lh" ||
      normalize(rows[attendanceHeaderRow]?.[col + 1]) !== "la"
    ) continue;

    lastSessionEnd = col + 1;
    const existingHeader = rows[sessionInfoRow]?.[col];
    if (sessionHeaderMatches(existingHeader, params.date, params.slot)) {
      startColumn = col;
      break;
    }
    const existingSortKey = sessionSortKey(existingHeader);
    if (insertionColumn === -1 && existingSortKey && newSortKey < existingSortKey) {
      insertionColumn = col;
    }
  }

  if (startColumn === -1) {
    if (insertionColumn !== -1) {
      startColumn = insertionColumn;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: { sheetId, dimension: "COLUMNS", startIndex: startColumn, endIndex: startColumn + 2 },
                inheritFromBefore: startColumn > 3,
              },
            },
          ],
        },
      });
    } else {
      startColumn = lastSessionEnd === 2 ? 3 : lastSessionEnd + 2;
    }
  }

  const requiredColumnCount = startColumn + 2;
  const currentColumnCount = target.properties?.gridProperties?.columnCount || 26;
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

  // Rebuild the metadata scaffold first because it occupies row 5.
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!A1:H5`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [`TEACHER DIARY — ${params.subjectName}`, "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["Class", params.classLabel, "", "Subject", params.subjectName, "", "Teacher", params.teacherName],
        ["Latest Session", "", "", "Session ID", "", "", "", ""],
        ["Attendance is recorded below by date and time slot.", "", "", "", "", "", "", ""],
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!${startCol}${sessionInfoRow + 1}:${endCol}${sessionInfoRow + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [[`${params.date} | ${params.slot}`, ""]] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!${startCol}${attendanceHeaderRow + 1}:${endCol}${attendanceHeaderRow + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [["LH", "LA"]] },
  });

  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) {
    if (!incoming.has(enrollmentNo)) continue;
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] });
    writeRanges.push({ range: `'${title}'!${endCol}${rowNumber}`, values: [[incoming.get(enrollmentNo) ? 1 : 0]] });
  }
  if (writeRanges.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: writeRanges },
    });
  }

  return {
    sheetTitle: title,
    startColumn,
    present: params.students.filter((student) => student.present).length,
    total: params.students.length,
  };
}
