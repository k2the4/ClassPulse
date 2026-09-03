import { getSheetsClient } from "./googleSheetsClient";

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

export interface TeacherDiarySession {
  id: string;
  subjectCode: string;
  slot: string;
  date: string;
  teacherName: string;
  presentEnrollmentNos: string[];
}

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

function findStudentHeader(rows: string[][]): number {
  return rows.findIndex((row) => normalize(row?.[0]) === "s.no" && normalize(row?.[1]).includes("enrollment") && normalize(row?.[2]).includes("student"));
}

function sessionSortKey(session: TeacherDiarySession): string {
  const index = TIME_SLOT_ORDER.findIndex((slot) => normalize(slot) === normalize(session.slot));
  return `${session.date}|${String(index === -1 ? 999 : index).padStart(3, "0")}|${normalize(session.slot)}`;
}

function readTeacherName(rows: string[][]): string {
  const row = rows[2] || [];
  for (let i = 0; i < row.length - 1; i++) {
    if (normalize(row[i]) === "teacher") return String(row[i + 1] || "Teacher").trim() || "Teacher";
  }
  return "Teacher";
}

async function readSubjectSessions(spreadsheetId: string, subjectCode: string, date?: string): Promise<TeacherDiarySession[]> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const target = (metadata.data.sheets || []).find((sheet) => {
    const title = sheet.properties?.title || "";
    return title.toLowerCase().replace(/\s+/g, "") === `td-${subjectCode}`.toLowerCase().replace(/\s+/g, "");
  });
  if (!target?.properties?.title) return [];

  const title = target.properties.title;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values || [];
  const headerRow = findStudentHeader(rows);
  if (headerRow === -1) return [];

  const subHeaderRow = headerRow + 1;
  const studentStartRow = headerRow + 2;
  const maxColumns = Math.max(...rows.map((row) => row.length), 4);
  const teacherName = readTeacherName(rows);
  const sessions: TeacherDiarySession[] = [];

  for (let col = 3; col < maxColumns - 1; col++) {
    if (normalize(rows[subHeaderRow]?.[col]) !== "lh" || normalize(rows[subHeaderRow]?.[col + 1]) !== "la") continue;
    const header = String(rows[headerRow]?.[col] || "").trim();
    const match = header.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
    if (!match) continue;
    if (date && match[1] !== date) continue;

    const presentEnrollmentNos: string[] = [];
    for (let rowIndex = studentStartRow; rowIndex < rows.length; rowIndex++) {
      const enrollmentNo = cleanEnrollment(rows[rowIndex]?.[1]);
      if (!/^\d+$/.test(enrollmentNo)) continue;
      const la = Number(rows[rowIndex]?.[col + 1] || 0) || 0;
      if (la > 0) presentEnrollmentNos.push(enrollmentNo);
    }

    const sessionKey = String(rows[headerRow - 1]?.[col] || "").trim();
    const fallbackId = `ATT-${match[1].replace(/-/g, "")}-${subjectCode.replace(/[^a-z0-9]/gi, "").toUpperCase()}-${match[2].replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
    sessions.push({
      id: sessionKey || fallbackId,
      subjectCode,
      date: match[1],
      slot: match[2].trim(),
      teacherName,
      presentEnrollmentNos,
    });
  }

  return sessions.sort((a, b) => sessionSortKey(a).localeCompare(sessionSortKey(b)));
}

export async function readTeacherDiarySessions(params: {
  spreadsheetId: string;
  subjectCodes: string[];
  date?: string;
}): Promise<TeacherDiarySession[]> {
  const results = await Promise.all(params.subjectCodes.map((code) => readSubjectSessions(params.spreadsheetId, code, params.date)));
  return results.flat().sort((a, b) => sessionSortKey(a).localeCompare(sessionSortKey(b)));
}
