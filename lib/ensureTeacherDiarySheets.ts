import { getSheetsClient } from "./googleSheetsClient";

const LAB_TO_THEORY: Record<string, string> = {
  "IOT-LAB": "IOT",
  "MLDA-LAB": "MLDA",
  "PR-LAB": "PR",
  "SL-LAB": "SL",
  "USL-LAB": "USL",
};

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function findStudentHeader(rows: string[][]): number {
  return rows.findIndex((row) =>
    String(row?.[0] ?? "").trim().toLowerCase() === "s.no" &&
    String(row?.[1] ?? "").trim().toLowerCase().includes("enrollment") &&
    String(row?.[2] ?? "").trim().toLowerCase().includes("student")
  );
}

/**
 * Makes sure a Teacher Diary tab exists for a lab subject.
 * The lab tab is duplicated from its matching theory tab so all formatting,
 * widths, borders and student roster structure are inherited. Session values
 * are cleared so the new lab starts empty and the Attendance Agent can append
 * its own LH/LA session pairs immediately.
 */
export async function ensureTeacherDiarySheet(params: {
  spreadsheetId: string;
  subjectCode: string;
}): Promise<string | null> {
  const labCode = normalizeCode(params.subjectCode);
  const sourceCode = LAB_TO_THEORY[labCode];
  if (!sourceCode) return null;

  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });
  const sheetList = metadata.data.sheets || [];

  const target = sheetList.find(
    (sheet) => normalizeCode(sheet.properties?.title) === `TD-${labCode}`
  );
  if (target?.properties?.title) return target.properties.title;

  const source = sheetList.find(
    (sheet) => normalizeCode(sheet.properties?.title) === `TD-${sourceCode}`
  );
  if (!source?.properties?.sheetId || !source.properties.title) {
    throw new Error(`Teacher Diary template TD-${sourceCode} was not found`);
  }

  const duplicateResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: source.properties.sheetId,
            newSheetName: `TD-${labCode}`,
          },
        },
      ],
    },
  });

  const duplicated = duplicateResponse.data.replies?.[0]?.duplicateSheet?.properties;
  const targetSheetId = duplicated?.sheetId;
  const targetTitle = duplicated?.title || `TD-${labCode}`;
  if (!targetSheetId) throw new Error(`Could not create Teacher Diary sheet TD-${labCode}`);

  const values = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: `'${targetTitle}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = values.data.values || [];
  const headerRow = findStudentHeader(rows);

  if (headerRow !== -1) {
    const clearStartRow = Math.max(0, headerRow - 1);
    const clearStartColumn = 4; // E: first session LH/LA pair
    const rowCount = Math.max(1, (targetSheetId ? (duplicated?.gridProperties?.rowCount || 500) : 500) - clearStartRow);
    const columnCount = 48 - clearStartColumn; // E:AZ

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: targetSheetId,
                startRowIndex: clearStartRow,
                endRowIndex: clearStartRow + rowCount,
                startColumnIndex: clearStartColumn,
                endColumnIndex: clearStartColumn + columnCount,
              },
              cell: {},
              fields: "userEnteredValue",
            },
          },
        ],
      },
    });
  }

  // Clear the copied theory sheet's latest-session metadata while retaining
  // its formatting and the student roster in columns A-D.
  await sheets.spreadsheets.values.clear({
    spreadsheetId: params.spreadsheetId,
    range: `'${targetTitle}'!B4:E4`,
  });

  return targetTitle;
}

/** Ensures all lab Teacher Diary tabs represented by the current subject list exist. */
export async function ensureLabTeacherDiarySheets(params: {
  spreadsheetId: string;
  subjectCodes: string[];
}): Promise<string[]> {
  const createdOrExisting: string[] = [];
  for (const subjectCode of params.subjectCodes) {
    if (!LAB_TO_THEORY[normalizeCode(subjectCode)]) continue;
    const title = await ensureTeacherDiarySheet({
      spreadsheetId: params.spreadsheetId,
      subjectCode,
    });
    if (title) createdOrExisting.push(title);
  }
  return createdOrExisting;
}
