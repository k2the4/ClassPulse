import { getSheetsClient } from "./googleSheetsClient";

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function teacherNameFor(subject: { assignments?: Array<{ teacher?: { name?: string | null } | null }> }): string {
  return subject.assignments?.find((assignment) => assignment.teacher?.name)?.teacher?.name || "";
}

/**
 * Rebuilds every Teacher Diary tab from one canonical TD template. The full
 * sheet is copied, including formatting and the complete top metadata area.
 * Existing attendance/session values are intentionally discarded, then the
 * correct subject, class, teacher and current student roster are written in.
 */
export async function overwriteTeacherDiarySheets(params: {
  spreadsheetId: string;
  classLabel: string;
  students: Array<{ enrollmentNo: string; name: string }>;
  subjects: Array<{
    code: string;
    name: string;
    assignments?: Array<{ teacher?: { name?: string | null } | null }>;
  }>;
}): Promise<string[]> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });
  let sheetList = metadata.data.sheets || [];

  const source = sheetList.find((sheet) => normalizeCode(sheet.properties?.title) === "TD-SL")
    || sheetList.find((sheet) => /^TD-/i.test(sheet.properties?.title || ""));
  if (!source?.properties?.sheetId || !source.properties.title) {
    throw new Error("No existing Teacher Diary template was found");
  }

  const rowCount = source.properties.gridProperties?.rowCount || 500;
  const columnCount = source.properties.gridProperties?.columnCount || 52;
  const sourceSheetId = source.properties.sheetId;
  const formatted: string[] = [];

  // First make every target exist. We do this before touching the source so
  // TD-SL remains available as the canonical template for the whole pass.
  for (const subject of params.subjects) {
    const code = normalizeCode(subject.code);
    if (!code) continue;
    const title = `TD-${code}`;
    let target = sheetList.find((sheet) => normalizeCode(sheet.properties?.title) === normalizeCode(title));
    if (!target?.properties?.sheetId) {
      const duplicate = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheetId,
        requestBody: {
          requests: [{
            duplicateSheet: {
              sourceSheetId,
              newSheetName: title,
            },
          }],
        },
      });
      const properties = duplicate.data.replies?.[0]?.duplicateSheet?.properties;
      if (!properties?.sheetId) throw new Error(`Could not create ${title}`);
      target = { properties } as typeof target;
      sheetList = [...sheetList, target];
    }
  }

  for (const subject of params.subjects) {
    const code = normalizeCode(subject.code);
    if (!code) continue;
    const title = `TD-${code}`;
    const target = sheetList.find((sheet) => normalizeCode(sheet.properties?.title) === normalizeCode(title));
    const targetSheetId = target?.properties?.sheetId;
    if (!targetSheetId) continue;

    // Overwrite the complete target sheet, not just the session area. This is
    // what guarantees the top subject/class/teacher section and student table
    // are identical to the canonical Teacher Diary layout.
    if (targetSheetId !== sourceSheetId) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheetId,
        requestBody: {
          requests: [{
            copyPaste: {
              source: {
                sheetId: sourceSheetId,
                startRowIndex: 0,
                endRowIndex: rowCount,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              destination: {
                sheetId: targetSheetId,
                startRowIndex: 0,
                endRowIndex: rowCount,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              pasteType: "PASTE_NORMAL",
              pasteOrientation: "NORMAL",
            },
          }],
        },
      });
    }

    // Remove every copied attendance/session value. Formatting remains intact.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: params.spreadsheetId,
      range: `'${title}'!D3:AZ500`,
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId: params.spreadsheetId,
      range: `'${title}'!A9:C500`,
    });

    const teacher = teacherNameFor(subject);
    const data: Array<{ range: string; values: string[][] }> = [
      { range: `'${title}'!A1`, values: [[`TEACHER DIARY — ${subject.name}`]] },
      { range: `'${title}'!A3:B3`, values: [["Class", params.classLabel]] },
      { range: `'${title}'!D3:E3`, values: [["Subject", subject.name]] },
      { range: `'${title}'!G3:H3`, values: [["Teacher", teacher]] },
      { range: `'${title}'!A4`, values: [["Latest Session"]] },
      { range: `'${title}'!D4`, values: [["Session ID"]] },
      { range: `'${title}'!A7:C7`, values: [["S.No", "Enrollment No.", "Student Name"]] },
    ];

    if (params.students.length > 0) {
      data.push({
        range: `'${title}'!A9:C${8 + params.students.length}`,
        values: params.students.map((student, index) => [
          String(index + 1),
          student.enrollmentNo,
          student.name,
        ]),
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });

    formatted.push(title);
  }

  return formatted;
}

/** Backwards-compatible lab helper used by the Attendance Agent. */
export async function ensureLabTeacherDiarySheets(params: {
  spreadsheetId: string;
  subjectCodes: string[];
}): Promise<string[]> {
  return params.subjectCodes
    .filter((code) => /-LAB$/i.test(code))
    .map((code) => `TD-${normalizeCode(code)}`);
}
