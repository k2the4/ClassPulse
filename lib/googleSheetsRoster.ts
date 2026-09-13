import { getSheetsClient } from "./googleSheetsClient";

export interface ClassRosterRow {
  enrollmentNo: string;
  name: string;
  email: string;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEnrollment(value: unknown): string {
  const raw = clean(value).replace(/^'+/, "").replace(/\s+/g, "");
  if (!raw) return "";
  const scientific = raw.match(/^(\d+(?:\.\d+)?)e\+?(\d+)$/i);
  if (scientific) {
    const number = Number(raw);
    if (Number.isFinite(number)) return Math.round(number).toString();
  }
  return raw.replace(/\.0$/, "");
}

async function rosterSheetTitle(sheetId: string, gid?: string | null): Promise<string | null> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties(sheetId,title,index)",
  });
  const properties = meta.data.sheets?.map((sheet) => sheet.properties).filter(Boolean) ?? [];

  if (gid) {
    const numericGid = Number(gid);
    const match = properties.find((property) => Number(property?.sheetId) === numericGid);
    if (match?.title) return match.title;
  }

  const monthPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
  return properties.find((property) => monthPattern.test(property?.title || ""))?.title || properties[0]?.title || null;
}

export async function fetchClassRoster(sheetId: string, gid?: string | null): Promise<ClassRosterRow[]> {
  const sheets = getSheetsClient();
  const title = await rosterSheetTitle(sheetId, gid);
  if (!title) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${title.replace(/'/g, "''")}'!A:D`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values ?? [];
  const result = new Map<string, ClassRosterRow>();

  for (const row of rows) {
    const enrollmentNo = cleanEnrollment(row[1]);
    if (!/^\d+$/.test(enrollmentNo)) continue;
    const name = clean(row[2]);
    if (!name) continue;
    result.set(enrollmentNo, {
      enrollmentNo,
      name,
      email: clean(row[3]),
    });
  }

  return Array.from(result.values());
}

export async function appendClassRosterStudent(
  sheetId: string,
  gid: string | null | undefined,
  student: ClassRosterRow,
): Promise<void> {
  const sheets = getSheetsClient();
  const title = await rosterSheetTitle(sheetId, gid);
  if (!title) throw new Error("The linked Google Sheet has no worksheet.");

  const safeTitle = `'${title.replace(/'/g, "''")}'`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${safeTitle}!A:D`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [["", student.enrollmentNo, student.name, student.email]],
    },
  });
}

/** Ensures every class-roster student also exists in the subject's Teacher Diary sheet. */
export async function ensureTeacherDiaryRoster(
  sheetId: string,
  subjectCode: string,
  students: ClassRosterRow[],
): Promise<void> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const target = (metadata.data.sheets || []).find((sheet) => {
    const title = sheet.properties?.title || "";
    return title.toLowerCase().replace(/\s+/g, "") === `td-${subjectCode}`.toLowerCase().replace(/\s+/g, "");
  });
  if (!target?.properties?.title) {
    throw new Error(`Teacher Diary sheet TD-${subjectCode} was not found in the linked Google Sheet`);
  }

  const title = target.properties.title;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${title.replace(/'/g, "''")}'!A:D`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = result.data.values ?? [];
  const existing = new Set<string>();
  let maxSerial = 0;

  for (const row of rows) {
    const enrollmentNo = cleanEnrollment(row[1]);
    if (/^\d+$/.test(enrollmentNo)) existing.add(enrollmentNo);
    const serial = Number(clean(row[0]));
    if (Number.isFinite(serial) && serial > maxSerial) maxSerial = serial;
  }

  const missing = students.filter((student) => !existing.has(cleanEnrollment(student.enrollmentNo)));
  if (missing.length === 0) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${title.replace(/'/g, "''")}'!A:D`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: missing.map((student, index) => [
        maxSerial + index + 1,
        student.enrollmentNo,
        student.name,
        student.email,
      ]),
    },
  });
}
