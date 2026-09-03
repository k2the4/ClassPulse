import { getSheetsClient } from "./googleSheetsClient";

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

function normalizeSubjectCode(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function subjectCodesMatch(a: unknown, b: unknown): boolean {
  const left = normalizeSubjectCode(a);
  const right = normalizeSubjectCode(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const token = (value: string) => value.trim().toUpperCase().split(/[\s(\[]+/)[0].replace(/[^A-Z0-9]/g, "");
  return token(String(a ?? "")) === token(String(b ?? ""));
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

function sessionSortKey(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
  if (!match) return null;
  const slot = normalize(match[2]);
  const slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === slot);
  return `${match[1]}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${slot}`;
}

function monthTabMatches(title: string, date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const month = parsed.toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toLowerCase();
  const shortMonth = month.slice(0, 3);
  const year = parsed.getUTCFullYear().toString();
  const lower = title.trim().toLowerCase();
  return lower.includes(year) && (lower.includes(month) || lower.includes(shortMonth));
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
  const subHeaderRow = headerRow + 1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let latestColumn = -1;
  let latestSortKey: string | null = null;
  for (let col = 3; col < maxColumns - 1; col++) {
    if (normalize(rows[subHeaderRow]?.[col]) !== "lh" || normalize(rows[subHeaderRow]?.[col + 1]) !== "la") continue;
    const key = sessionSortKey(rows[headerRow]?.[col]);
    if (key && (latestSortKey === null || key > latestSortKey)) {
      latestSortKey = key;
      latestColumn = col;
    }
  }

  if (latestColumn === -1) {
    await params.sheets.spreadsheets.values.update({
      spreadsheetId: params.spreadsheetId,
      range: `'${params.title}'!B4:E4`,
      valueInputOption: "RAW",
      requestBody: { values: [["", "", "", ""]] },
    });
    return;
  }

  const latestHeader = String(rows[headerRow]?.[latestColumn] || "");
  const latestKey = String(rows[headerRow - 1]?.[latestColumn] || "");
  const separator = latestHeader.indexOf("|");
  const latestDate = separator === -1 ? latestHeader : latestHeader.slice(0, separator).trim();
  const latestSlot = separator === -1 ? "" : latestHeader.slice(separator + 1).trim();
  await params.sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${params.title}'!B4:E4`,
    valueInputOption: "RAW",
    requestBody: { values: [[latestDate, latestSlot, "Session ID", latestKey]] },
  });
}

/**
 * Rebuilds one subject's monthly LH/LA totals from every matching Teacher Diary
 * session in that month. This makes the monthly sheet an aggregate of TD data:
 * LH = number of sessions held; LA = number of sessions attended.
 */
export async function syncMonthlyAttendanceFromTeacherDiary(params: {
  spreadsheetId: string;
  subjectCode: string;
  date: string;
}): Promise<{ monthTitle: string; presentColumns: number; studentCount: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });
  const sheetList = metadata.data.sheets || [];

  const tdTarget = sheetList.find((sheet) => {
    const title = sheet.properties?.title || "";
    return title.toLowerCase().replace(/\s+/g, "") === `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  });
  if (!tdTarget?.properties?.title) throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found`);

  const monthTarget = sheetList.find((sheet) => monthTabMatches(sheet.properties?.title || "", params.date));
  if (!monthTarget?.properties?.title) throw new Error(`Monthly attendance sheet for ${params.date.slice(0, 7)} was not found`);

  const tdTitle = tdTarget.properties.title;
  const monthTitle = monthTarget.properties.title;
  const tdResult = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${tdTitle}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const monthResult = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${monthTitle}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const tdRows = tdResult.data.values || [];
  const monthRows = monthResult.data.values || [];
  const tdHeaderRow = findStudentHeader(tdRows);
  if (tdHeaderRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected student header`);

  const tdSubHeaderRow = tdHeaderRow + 1;
  const tdStudentStart = tdHeaderRow + 2;
  const monthHeaderRow = monthRows.findIndex((row) => {
    for (let col = 0; col + 1 < row.length; col++) {
      if (normalize(row[col]) === "lh" && normalize(row[col + 1]) === "la") return true;
    }
    return false;
  });
  if (monthHeaderRow === -1) throw new Error(`Monthly sheet ${monthTitle} does not have LH/LA attendance columns`);

  const monthSubjectRow = monthHeaderRow - 1;
  const monthParentSubjectRow = monthHeaderRow - 2;
  let monthLhCol = -1;
  for (let col = 0; col + 1 < (monthRows[monthHeaderRow]?.length || 0); col++) {
    if (normalize(monthRows[monthHeaderRow]?.[col]) !== "lh" || normalize(monthRows[monthHeaderRow]?.[col + 1]) !== "la") continue;
    const directCandidate = monthRows[monthSubjectRow]?.[col];
    const parentCandidate = monthRows[monthParentSubjectRow]?.[col];
    if (subjectCodesMatch(directCandidate, params.subjectCode) || subjectCodesMatch(parentCandidate, params.subjectCode)) {
      monthLhCol = col;
      break;
    }
  }
  if (monthLhCol === -1) throw new Error(`Subject ${params.subjectCode} was not found in monthly sheet ${monthTitle}`);

  const monthEnrollmentRows = new Map<string, number>();
  for (let rowIndex = monthHeaderRow + 1; rowIndex < monthRows.length; rowIndex++) {
    const enrollmentNo = cleanEnrollment(monthRows[rowIndex]?.[1]);
    if (/^\d+$/.test(enrollmentNo)) monthEnrollmentRows.set(enrollmentNo, rowIndex);
  }

  const [targetYear, targetMonth] = params.date.slice(0, 7).split("-").map(Number);
  const totals = new Map<string, { lh: number; la: number }>();
  const tdMaxColumns = Math.max(...tdRows.map((row) => row.length), 4);

  for (let col = 3; col < tdMaxColumns - 1; col++) {
    if (normalize(tdRows[tdSubHeaderRow]?.[col]) !== "lh" || normalize(tdRows[tdSubHeaderRow]?.[col + 1]) !== "la") continue;
    const header = String(tdRows[tdHeaderRow]?.[col] || "").trim();
    const match = header.match(/^(\d{4})-(\d{2})-(\d{2})\s*\|/);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year !== targetYear || month !== targetMonth) continue;

    for (let rowIndex = tdStudentStart; rowIndex < tdRows.length; rowIndex++) {
      const enrollmentNo = cleanEnrollment(tdRows[rowIndex]?.[1]);
      if (!/^\d+$/.test(enrollmentNo)) continue;
      const current = totals.get(enrollmentNo) || { lh: 0, la: 0 };
      current.lh += Number(tdRows[rowIndex]?.[col] || 0) || 0;
      current.la += Number(tdRows[rowIndex]?.[col + 1] || 0) || 0;
      totals.set(enrollmentNo, current);
    }
  }

  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of monthEnrollmentRows.entries()) {
    const total = totals.get(enrollmentNo) || { lh: 0, la: 0 };
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${monthTitle}'!${columnName(monthLhCol)}${rowNumber}`, values: [[total.lh]] });
    writeRanges.push({ range: `'${monthTitle}'!${columnName(monthLhCol + 1)}${rowNumber}`, values: [[total.la]] });
  }

  if (writeRanges.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: writeRanges },
    });
  }

  return { monthTitle, presentColumns: writeRanges.length, studentCount: monthEnrollmentRows.size };
}

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
  if (!target?.properties?.title || typeof sheetId !== "number") throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  const title = target.properties.title;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
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
  if (incoming.size !== params.students.length) throw new Error(`Attendance contains a student with an invalid enrollment number`);
  for (const enrollmentNo of incoming.keys()) if (!enrollmentRows.has(enrollmentNo)) throw new Error(`Student ${enrollmentNo} is missing from TD-${params.subjectCode}; attendance was not written`);

  let startColumn = -1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let lastSessionEnd = 2;
  let insertionColumn = -1;
  const slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === normalize(params.slot));
  const newSortKey = `${params.date}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(params.slot)}`;

  for (let col = 3; col < maxColumns - 1; col++) {
    if (sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) && normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") {
      startColumn = col;
      break;
    }
    if (normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") {
      lastSessionEnd = col + 1;
      const existingSortKey = sessionSortKey(rows[headerRow]?.[col]);
      if (insertionColumn === -1 && existingSortKey && newSortKey < existingSortKey) insertionColumn = col;
    }
  }

  if (startColumn === -1) {
    if (insertionColumn !== -1) {
      startColumn = insertionColumn;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheetId,
        requestBody: {
          requests: [{
            insertDimension: {
              range: { sheetId, dimension: "COLUMNS", startIndex: startColumn, endIndex: startColumn + 3 },
              inheritFromBefore: startColumn > 3,
            },
          }],
        },
      });
    } else {
      startColumn = lastSessionEnd === 2 ? 3 : lastSessionEnd + 2;
    }
  }

  const requiredColumnCount = startColumn + 2;
  const currentColumnCount = target.properties.gridProperties?.columnCount || 26;
  if (requiredColumnCount > currentColumnCount) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId, dimension: "COLUMNS", length: requiredColumnCount - currentColumnCount } }] } });
  }

  const startCol = columnName(startColumn);
  const endCol = columnName(startColumn + 1);
  await sheets.spreadsheets.values.update({ spreadsheetId: params.spreadsheetId, range: `'${title}'!${startCol}6:${endCol}8`, valueInputOption: "RAW", requestBody: { values: [[params.sessionKey, ""], [`${params.date} | ${params.slot}`, ""], ["LH", "LA"]] } });

  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) {
    if (!incoming.has(enrollmentNo)) continue;
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] });
    writeRanges.push({ range: `'${title}'!${endCol}${rowNumber}`, values: [[incoming.get(enrollmentNo) ? 1 : 0]] });
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { valueInputOption: "RAW", data: writeRanges } });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { valueInputOption: "RAW", data: [{ range: `'${title}'!A1:H5`, values: [[`TEACHER DIARY — ${params.subjectName}`, "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""], ["Class", params.classLabel, "", "Subject", params.subjectName, "", "Teacher", params.teacherName], ["Latest Session", "", "", "Session ID", "", "", "", ""], ["Attendance is recorded below by date and time slot.", "", "", "", "", "", "", ""]] }] } });
  await refreshLatestSessionMetadata({ sheets, spreadsheetId: params.spreadsheetId, title });

  await syncMonthlyAttendanceFromTeacherDiary({ spreadsheetId: params.spreadsheetId, subjectCode: params.subjectCode, date: params.date });

  return { sheetTitle: title, startColumn, present: params.students.filter((student) => student.present).length, total: params.students.length };
}

export async function deleteTeacherDiaryAttendance(params: {
  spreadsheetId: string;
  subjectCode: string;
  date: string;
  slot: string;
}): Promise<{ sheetTitle: string; startColumn: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: params.spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))" });
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = (metadata.data.sheets || []).find((sheet) => (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget);
  const sheetId = target?.properties?.sheetId;
  const title = target?.properties?.title;
  if (!title || typeof sheetId !== "number") throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
  const attendanceSubHeaderRow = headerRow + 1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let startColumn = -1;
  for (let col = 3; col < maxColumns - 1; col++) {
    if (sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) && normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") { startColumn = col; break; }
  }

  if (startColumn !== -1) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: startColumn, endIndex: startColumn + 2 } } }] } });
  }

  await refreshLatestSessionMetadata({ sheets, spreadsheetId: params.spreadsheetId, title });

  await syncMonthlyAttendanceFromTeacherDiary({ spreadsheetId: params.spreadsheetId, subjectCode: params.subjectCode, date: params.date });
  return { sheetTitle: title, startColumn };
}
