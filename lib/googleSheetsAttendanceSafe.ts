import { getSheetsClient } from "./googleSheetsClient";
import { syncMonthlyAttendanceFromTeacherDiary } from "./googleSheetsAttendance";

export interface AttendanceSheetStudent {
  enrollmentNo: string;
  present: boolean;
}

const TIME_SLOT_ORDER = [
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
      normalize(row?.[2]).includes("student")
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
  const slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === normalize(match[2]));
  return `${match[1]}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(match[2])}`;
}

function sessionId(subjectCode: string, date: string, slot: string): string {
  return `ATT-${date.replace(/-/g, "")}-${subjectCode
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()}-${slot.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
}

async function refreshLatestSessionMetadata(params: {
  sheets: ReturnType<typeof getSheetsClient>;
  spreadsheetId: string;
  title: string;
}): Promise<void> {
  const result = await params.sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${params.title}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.title.replace(/^TD-/i, "")} does not have the expected student header`);

  const attendanceHeaderRow = headerRow - 1;
  const sessionInfoRow = headerRow - 2;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let latestColumn = -1;
  let latestSortKey: string | null = null;

  for (let col = 3; col < maxColumns - 1; col++) {
    if (
      normalize(rows[attendanceHeaderRow]?.[col]) !== "lh" ||
      normalize(rows[attendanceHeaderRow]?.[col + 1]) !== "la"
    ) continue;
    const key = sessionSortKey(rows[sessionInfoRow]?.[col]);
    if (key && (latestSortKey === null || key > latestSortKey)) {
      latestSortKey = key;
      latestColumn = col;
    }
  }

  if (latestColumn === -1) return;

  const latestHeader = String(rows[sessionInfoRow]?.[latestColumn] || "").trim();
  const separator = latestHeader.indexOf("|");
  const latestDate = separator === -1 ? latestHeader : latestHeader.slice(0, separator).trim();
  const latestSlot = separator === -1 ? "" : latestHeader.slice(separator + 1).trim();
  const code = params.title.replace(/^TD-/i, "").trim();
  const latestKey = sessionId(code, latestDate, latestSlot);

  // Only update the two metadata value cells. Never rewrite the surrounding
  // A1:H5 block: that block contains the session date/slot row and template data.
  await params.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `'${params.title}'!B4`, values: [[`${latestDate} | ${latestSlot}`]] },
        { range: `'${params.title}'!E4`, values: [[latestKey]] },
      ],
    },
  });
}

export async function writeTeacherDiaryAttendanceSafe(params: {
  spreadsheetId: string;
  subjectCode: string;
  date: string;
  slot: string;
  students: AttendanceSheetStudent[];
}): Promise<{ sheetTitle: string; startColumn: number; present: number; total: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))",
  });
  const sheetsList = metadata.data.sheets || [];
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = sheetsList.find(
    (sheet) => (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget
  );
  const sheetId = target?.properties?.sheetId;
  if (!target?.properties?.title || typeof sheetId !== "number") {
    throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  }

  const title = target.properties.title;
  const rowCount = Math.max(500, target.properties.gridProperties?.rowCount || 500);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!A1:AZ${rowCount}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);
  if (headerRow === -1) {
    throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
  }

  const attendanceHeaderRow = headerRow - 1;
  const studentStartRow = headerRow + 1;
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

  let startColumn = -1;
  let lastSessionEnd = 2;
  let insertionColumn = -1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  const slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === normalize(params.slot));
  const newSortKey = `${params.date}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(params.slot)}`;

  for (let col = 3; col < maxColumns - 1; col++) {
    if (
      normalize(rows[attendanceHeaderRow]?.[col]) === "lh" &&
      normalize(rows[attendanceHeaderRow]?.[col + 1]) === "la"
    ) {
      lastSessionEnd = col + 1;
      const existingHeader = rows[attendanceHeaderRow - 1]?.[col];
      if (sessionHeaderMatches(existingHeader, params.date, params.slot)) {
        startColumn = col;
        break;
      }
      const existingSortKey = sessionSortKey(existingHeader);
      if (insertionColumn === -1 && existingSortKey && newSortKey < existingSortKey) {
        insertionColumn = col;
      }
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
                range: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: startColumn,
                  endIndex: startColumn + 3,
                },
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

  // The Teacher Diary template is structural data. Only touch the new session
  // header cells and the attendance cells. Do not rewrite A1:H5 or any other
  // template range, because row 5 contains the date/time evidence for the
  // session and other cells contain class/subject/teacher metadata.
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!${startCol}${headerRow - 1}:${endCol}${headerRow - 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [[`${params.date} | ${params.slot}`, ""]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!${startCol}${headerRow}:${endCol}${headerRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [["LH", "LA"]] },
  });

  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) {
    if (!incoming.has(enrollmentNo)) continue;
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] });
    writeRanges.push({
      range: `'${title}'!${endCol}${rowNumber}`,
      values: [[incoming.get(enrollmentNo) ? 1 : 0]],
    });
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: writeRanges },
  });

  await refreshLatestSessionMetadata({
    sheets,
    spreadsheetId: params.spreadsheetId,
    title,
  });

  // Because the session date/slot was never cleared, the monthly rebuild sees
  // the newly written LH/LA pair in the same operation.
  await syncMonthlyAttendanceFromTeacherDiary({
    spreadsheetId: params.spreadsheetId,
    subjectCode: params.subjectCode,
    date: params.date,
  });

  return {
    sheetTitle: title,
    startColumn,
    present: params.students.filter((student) => student.present).length,
    total: params.students.length,
  };
}
