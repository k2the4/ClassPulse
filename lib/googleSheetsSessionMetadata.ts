import { getSheetsClient } from "./googleSheetsClient";

/**
 * Writes the latest Teacher Diary session into the large merged metadata cells.
 * The sheet layout uses B4:C5 and D4:E5 as the two display areas, so only
 * their top-left cells are written. This avoids writing into merged child cells.
 */
export async function writeLatestTeacherDiarySessionMetadata(params: {
  spreadsheetId: string;
  subjectCode: string;
  date: string;
  slot: string;
  sessionKey: string;
}): Promise<void> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const normalizedTarget = `td-${params.subjectCode}`.toLowerCase().replace(/\s+/g, "");
  const target = (metadata.data.sheets || []).find(
    (sheet) =>
      (sheet.properties?.title || "").toLowerCase().replace(/\s+/g, "") === normalizedTarget,
  );
  const title = target?.properties?.title;
  if (!title) throw new Error(`Teacher Diary sheet TD-${params.subjectCode} was not found`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!B4`,
    valueInputOption: "RAW",
    requestBody: { values: [[`${params.date} | ${params.slot}`]] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: `'${title}'!D4`,
    valueInputOption: "RAW",
    requestBody: { values: [[params.sessionKey]] },
  });
}
