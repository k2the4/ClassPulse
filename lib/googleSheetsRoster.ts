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
