import { getSheetsClient } from "./googleSheetsClient";

export interface AttendanceSheetStudent {
  enrollmentNo: string;
  present: boolean;
}

const TIME_SLOT_ORDER = ["8 to 9", "9 to 10", "10 to 11", "11 to 12", "12.30 to 1.30", "1.30 to 2.30", "2.30 to 3.30", "3.30 to 4.30"] as const;

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

function normalize(value: unknown): string { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function normalizeSubjectCode(value: unknown): string { return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function subjectCodesMatch(a: unknown, b: unknown): boolean {
  const left = normalizeSubjectCode(a), right = normalizeSubjectCode(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const token = (value: string) => value.trim().toUpperCase().split(/[\s(\[]+/)[0].replace(/[^A-Z0-9]/g, "");
  return token(String(a ?? "")) === token(String(b ?? ""));
}
function columnName(index: number): string {
  let n = index + 1, result = "";
  while (n > 0) { const remainder = (n - 1) % 26; result = String.fromCharCode(65 + remainder) + result; n = Math.floor((n - 1) / 26); }
  return result;
}
function findStudentHeader(rows: string[][]): number {
  return rows.findIndex((row) => normalize(row?.[0]) === "s.no" && normalize(row?.[1]).includes("enrollment") && normalize(row?.[2]).includes("student"));
}
function sessionHeaderMatches(value: unknown, date: string, slot: string): boolean {
  const text = normalize(value), target = normalize(`${date} | ${slot}`);
  return text === target || text === normalize(`${date} ${slot}`);
}
function sessionSortKey(value: unknown): string | null {
  const text = String(value ?? "").trim(), match = text.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
  if (!match) return null;
  const slot = normalize(match[2]), slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === slot);
  return `${match[1]}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${slot}`;
}
function monthTabInfo(title: string): { year: number; month: number } | null {
  const match = title.trim().toLowerCase().match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*[-,/_]?\s*(\d{2,4}))?/i);
  if (!match) return null;
  const map: Record<string, number> = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };
  let year = match[2] ? Number(match[2]) : 2026;
  if (year < 100) year += 2000;
  return { year, month: map[match[1]] ?? 0 };
}
function monthTabMatches(title: string, date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const month = parsed.toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toLowerCase();
  const lower = title.trim().toLowerCase(), year = parsed.getUTCFullYear().toString();
  return lower.includes(year) && (lower.includes(month) || lower.includes(month.slice(0, 3)));
}
async function refreshLatestSessionMetadata(params: { sheets: ReturnType<typeof getSheetsClient>; spreadsheetId: string; title: string }): Promise<void> {
  const result = await params.sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${params.title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = result.data.values || [], headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.title.replace(/^TD-/i, "")} does not have the expected student header`);
  const subHeaderRow = headerRow + 1, maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let latestColumn = -1, latestSortKey: string | null = null;
  for (let col = 3; col < maxColumns - 1; col++) {
    if (normalize(rows[subHeaderRow]?.[col]) !== "lh" || normalize(rows[subHeaderRow]?.[col + 1]) !== "la") continue;
    const key = sessionSortKey(rows[headerRow]?.[col]);
    if (key && (latestSortKey === null || key > latestSortKey)) { latestSortKey = key; latestColumn = col; }
  }
  if (latestColumn === -1) {
    await params.sheets.spreadsheets.values.update({ spreadsheetId: params.spreadsheetId, range: `'${params.title}'!B4:E4`, valueInputOption: "RAW", requestBody: { values: [["", "", "", ""]] } });
    return;
  }
  const latestHeader = String(rows[headerRow]?.[latestColumn] || ""), latestKey = String(rows[headerRow - 1]?.[latestColumn] || ""), separator = latestHeader.indexOf("|");
  const latestDate = separator === -1 ? latestHeader : latestHeader.slice(0, separator).trim(), latestSlot = separator === -1 ? "" : latestHeader.slice(separator + 1).trim();
  await params.sheets.spreadsheets.values.update({ spreadsheetId: params.spreadsheetId, range: `'${params.title}'!B4:E4`, valueInputOption: "RAW", requestBody: { values: [[latestDate, latestSlot, "Session ID", latestKey]] } });
}

/** Rebuilds a month's LH/LA from Teacher Diary and adds the previous month's cumulative totals. */
export async function syncMonthlyAttendanceFromTeacherDiary(params: { spreadsheetId: string; subjectCode: string; date: string }): Promise<{ monthTitle: string; presentColumns: number; studentCount: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: params.spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))" });
  const sheetList = metadata.data.sheets || [];
  const tdTarget = sheetList.find((sheet) => (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, ""));
  if (!tdTarget?.properties?.title) throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found`);
  const monthTarget = sheetList.find((sheet) => monthTabMatches(sheet.properties?.title || "", params.date));
  if (!monthTarget?.properties?.title) throw new Error(`Monthly attendance sheet for ${params.date.slice(0, 7)} was not found`);

  const tdTitle = tdTarget.properties.title, monthTitle = monthTarget.properties.title;
  const tdResult = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${tdTitle}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const monthResult = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${monthTitle}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const tdRows = tdResult.data.values || [], monthRows = monthResult.data.values || [];
  const tdHeaderRow = findStudentHeader(tdRows);
  if (tdHeaderRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected student header`);
  const tdSubHeaderRow = tdHeaderRow + 1, tdStudentStart = tdHeaderRow + 2;
  const monthHeaderRow = monthRows.findIndex((row) => row.some((_, col) => normalize(row[col]) === "lh" && normalize(row[col + 1]) === "la"));
  if (monthHeaderRow === -1) throw new Error(`Monthly sheet ${monthTitle} does not have LH/LA attendance columns`);
  const monthSubjectRow = monthHeaderRow - 1, monthParentSubjectRow = monthHeaderRow - 2;
  let monthLhCol = -1;
  for (let col = 0; col + 1 < (monthRows[monthHeaderRow]?.length || 0); col++) {
    if (normalize(monthRows[monthHeaderRow]?.[col]) !== "lh" || normalize(monthRows[monthHeaderRow]?.[col + 1]) !== "la") continue;
    if (subjectCodesMatch(monthRows[monthSubjectRow]?.[col], params.subjectCode) || subjectCodesMatch(monthRows[monthParentSubjectRow]?.[col], params.subjectCode)) { monthLhCol = col; break; }
  }
  if (monthLhCol === -1) throw new Error(`Subject ${params.subjectCode} was not found in monthly sheet ${monthTitle}`);

  const monthEnrollmentRows = new Map<string, number>();
  for (let rowIndex = monthHeaderRow + 1; rowIndex < monthRows.length; rowIndex++) {
    const enrollmentNo = cleanEnrollment(monthRows[rowIndex]?.[1]);
    if (/^\d+$/.test(enrollmentNo)) monthEnrollmentRows.set(enrollmentNo, rowIndex);
  }

  // IMPORTANT: the current month's sheet is never used as the cumulative base.
  // We always read the immediately preceding month so rerunning the agent for
  // September, October, etc. does not double-count the already-written total.
  const currentInfo = monthTabInfo(monthTitle);
  const previousTotals = new Map<string, { lh: number; la: number }>();
  if (currentInfo) {
    const previousMonthValue = currentInfo.month === 0 ? { year: currentInfo.year - 1, month: 11 } : { year: currentInfo.year, month: currentInfo.month - 1 };
    const previousTarget = sheetList.find((sheet) => {
      const info = monthTabInfo(sheet.properties?.title || "");
      return !!info && info.year === previousMonthValue.year && info.month === previousMonthValue.month;
    });
    if (previousTarget?.properties?.title) {
      const previousResult = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${previousTarget.properties.title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
      const previousRows = previousResult.data.values || [];
      const previousHeaderRow = previousRows.findIndex((row) => row.some((_, col) => normalize(row[col]) === "lh" && normalize(row[col + 1]) === "la"));
      if (previousHeaderRow !== -1) {
        const previousSubjectRow = previousHeaderRow - 1, previousParentSubjectRow = previousHeaderRow - 2;
        let previousLhCol = -1;
        for (let col = 0; col + 1 < (previousRows[previousHeaderRow]?.length || 0); col++) {
          if (normalize(previousRows[previousHeaderRow]?.[col]) !== "lh" || normalize(previousRows[previousHeaderRow]?.[col + 1]) !== "la") continue;
          if (subjectCodesMatch(previousRows[previousSubjectRow]?.[col], params.subjectCode) || subjectCodesMatch(previousRows[previousParentSubjectRow]?.[col], params.subjectCode)) { previousLhCol = col; break; }
        }
        if (previousLhCol !== -1) {
          for (let rowIndex = previousHeaderRow + 1; rowIndex < previousRows.length; rowIndex++) {
            const enrollmentNo = cleanEnrollment(previousRows[rowIndex]?.[1]);
            if (!/^\d+$/.test(enrollmentNo)) continue;
            previousTotals.set(enrollmentNo, { lh: Number(previousRows[rowIndex]?.[previousLhCol] || 0) || 0, la: Number(previousRows[rowIndex]?.[previousLhCol + 1] || 0) || 0 });
          }
        }
      }
    }
  }

  const [targetYear, targetMonth] = params.date.slice(0, 7).split("-").map(Number);
  const totals = new Map<string, { lh: number; la: number }>();
  const tdMaxColumns = Math.max(...tdRows.map((row) => row.length), 4);
  for (let col = 3; col < tdMaxColumns - 1; col++) {
    if (normalize(tdRows[tdSubHeaderRow]?.[col]) !== "lh" || normalize(tdRows[tdSubHeaderRow]?.[col + 1]) !== "la") continue;
    const match = String(tdRows[tdHeaderRow]?.[col] || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})\s*\|/);
    if (!match || Number(match[1]) !== targetYear || Number(match[2]) !== targetMonth) continue;
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
    const current = totals.get(enrollmentNo) || { lh: 0, la: 0 };
    const previous = previousTotals.get(enrollmentNo) || { lh: 0, la: 0 };
    const rowNumber = rowIndex + 1;
    writeRanges.push({ range: `'${monthTitle}'!${columnName(monthLhCol)}${rowNumber}`, values: [[previous.lh + current.lh]] });
    writeRanges.push({ range: `'${monthTitle}'!${columnName(monthLhCol + 1)}${rowNumber}`, values: [[previous.la + current.la]] });
  }
  if (writeRanges.length > 0) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { valueInputOption: "RAW", data: writeRanges } });
  return { monthTitle, presentColumns: writeRanges.length, studentCount: monthEnrollmentRows.size };
}

export async function writeTeacherDiaryAttendance(params: { spreadsheetId: string; subjectCode: string; subjectName: string; classLabel: string; teacherName: string; date: string; slot: string; sessionKey: string; students: AttendanceSheetStudent[] }): Promise<{ sheetTitle: string; startColumn: number; present: number; total: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: params.spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))" });
  const sheetsList = metadata.data.sheets || [];
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = sheetsList.find((sheet) => (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget);
  const sheetId = target?.properties?.sheetId;
  if (!target?.properties?.title || typeof sheetId !== "number") throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  const title = target.properties.title;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = result.data.values || [], headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
  const attendanceSubHeaderRow = headerRow + 1, studentStartRow = headerRow + 2;
  const enrollmentRows = new Map<string, number>();
  for (let rowIndex = studentStartRow; rowIndex < rows.length; rowIndex++) { const enrollmentNo = cleanEnrollment(rows[rowIndex]?.[1]); if (enrollmentNo) enrollmentRows.set(enrollmentNo, rowIndex); }
  const incoming = new Map<string, boolean>();
  for (const student of params.students) { const enrollmentNo = cleanEnrollment(student.enrollmentNo); if (enrollmentNo) incoming.set(enrollmentNo, student.present); }
  if (incoming.size !== params.students.length) throw new Error(`Attendance contains a student with an invalid enrollment number`);
  for (const enrollmentNo of incoming.keys()) if (!enrollmentRows.has(enrollmentNo)) throw new Error(`Student ${enrollmentNo} is missing from TD-${params.subjectCode}; attendance was not written`);
  let startColumn = -1, lastSessionEnd = 2, insertionColumn = -1;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4), slotIndex = TIME_SLOT_ORDER.findIndex((item) => normalize(item) === normalize(params.slot)), newSortKey = `${params.date}|${String(slotIndex === -1 ? 999 : slotIndex).padStart(3, "0")}|${normalize(params.slot)}`;
  for (let col = 3; col < maxColumns - 1; col++) {
    if (sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) && normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") { startColumn = col; break; }
    if (normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") { lastSessionEnd = col + 1; const existingSortKey = sessionSortKey(rows[headerRow]?.[col]); if (insertionColumn === -1 && existingSortKey && newSortKey < existingSortKey) insertionColumn = col; }
  }
  if (startColumn === -1) {
    if (insertionColumn !== -1) { startColumn = insertionColumn; await sheets.spreadsheets.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { requests: [{ insertDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: startColumn, endIndex: startColumn + 3 }, inheritFromBefore: startColumn > 3 } }] } }); }
    else startColumn = lastSessionEnd === 2 ? 3 : lastSessionEnd + 2;
  }
  const requiredColumnCount = startColumn + 2, currentColumnCount = target.properties.gridProperties?.columnCount || 26;
  if (requiredColumnCount > currentColumnCount) await sheets.spreadsheets.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { requests: [{ appendDimension: { sheetId, dimension: "COLUMNS", length: requiredColumnCount - currentColumnCount } }] } });
  const startCol = columnName(startColumn), endCol = columnName(startColumn + 1);
  await sheets.spreadsheets.values.update({ spreadsheetId: params.spreadsheetId, range: `'${title}'!${startCol}6:${endCol}8`, valueInputOption: "RAW", requestBody: { values: [[params.sessionKey, ""], [`${params.date} | ${params.slot}`, ""], ["LH", "LA"]] } });
  const writeRanges: Array<{ range: string; values: number[][] }> = [];
  for (const [enrollmentNo, rowIndex] of enrollmentRows.entries()) { if (!incoming.has(enrollmentNo)) continue; const rowNumber = rowIndex + 1; writeRanges.push({ range: `'${title}'!${startCol}${rowNumber}`, values: [[1]] }); writeRanges.push({ range: `'${title}'!${endCol}${rowNumber}`, values: [[incoming.get(enrollmentNo) ? 1 : 0]] }); }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { valueInputOption: "RAW", data: writeRanges } });
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { valueInputOption: "RAW", data: [{ range: `'${title}'!A1:H5`, values: [[`TEACHER DIARY — ${params.subjectName}`, "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""], ["Class", params.classLabel, "", "Subject", params.subjectName, "", "Teacher", params.teacherName], ["Latest Session", "", "", "Session ID", "", "", "", ""], ["Attendance is recorded below by date and time slot.", "", "", "", "", "", "", ""]] }] } });
  await refreshLatestSessionMetadata({ sheets, spreadsheetId: params.spreadsheetId, title });
  await syncMonthlyAttendanceFromTeacherDiary({ spreadsheetId: params.spreadsheetId, subjectCode: params.subjectCode, date: params.date });
  return { sheetTitle: title, startColumn, present: params.students.filter((student) => student.present).length, total: params.students.length };
}

export async function deleteTeacherDiaryAttendance(params: { spreadsheetId: string; subjectCode: string; date: string; slot: string }): Promise<{ sheetTitle: string; startColumn: number }> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: params.spreadsheetId, fields: "sheets(properties(sheetId,title,gridProperties(columnCount,rowCount)))" });
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = (metadata.data.sheets || []).find((sheet) => (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget);
  const sheetId = target?.properties?.sheetId, title = target?.properties?.title;
  if (!title || typeof sheetId !== "number") throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found in the linked Google Sheet`);
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: params.spreadsheetId, range: `'${title}'!A1:AZ500`, valueRenderOption: "FORMATTED_VALUE" });
  const rows = result.data.values || [], headerRow = findStudentHeader(rows);
  if (headerRow === -1) throw new Error(`TD-${params.subjectCode} does not have the expected S.No / Enrollment No. / Student Name header`);
  const attendanceSubHeaderRow = headerRow + 1, maxColumns = Math.max(...rows.map((row) => row.length), 4);
  let startColumn = -1;
  for (let col = 3; col < maxColumns - 1; col++) if (sessionHeaderMatches(rows[headerRow]?.[col], params.date, params.slot) && normalize(rows[attendanceSubHeaderRow]?.[col]) === "lh" && normalize(rows[attendanceSubHeaderRow]?.[col + 1]) === "la") { startColumn = col; break; }
  if (startColumn !== -1) await sheets.spreadsheets.batchUpdate({ spreadsheetId: params.spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: startColumn, endIndex: startColumn + 2 } } }] } });
  await refreshLatestSessionMetadata({ sheets, spreadsheetId: params.spreadsheetId, title });
  await syncMonthlyAttendanceFromTeacherDiary({ spreadsheetId: params.spreadsheetId, subjectCode: params.subjectCode, date: params.date });
  return { sheetTitle: title, startColumn };
}
