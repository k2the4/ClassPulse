import { getSheetsClient } from "./googleSheetsClient";

export interface RawStudentRow {
  enrollmentNo: string;
  name: string;
  email: string;
  assignmentSubmitted: number;
  assignmentTotal: number;
  presentation: number;
  attendancePrevMonth: number;
  attendanceCurrMonth: number;
  midsem1: number;
  midsem2: number;
}

/**
 * Pulls the roster from a subject's Google Sheet and parses it into typed
 * rows. Instead of hardcoding a row range (which breaks the moment a
 * teacher's sheet is laid out slightly differently), this fetches a wide
 * block of the first tab and auto-detects where the real data starts by
 * looking for the "Enrollment No." header cell, then reads rows below it
 * until it hits a row that isn't a valid enrollment record.
 *
 * Matches the CLASSPULSE template's column order: S no, Enrollment No,
 * Name, Email, Assignment Submitted, Assignment Total, Presentation,
 * Prev Month LA, Prev Month LH, Curr Month LA, Curr Month LH,
 * Midsem 1, Midsem 2.
 */
export async function fetchSubjectRoster(
  sheetId: string,
  searchRange = "'Raw Data'!A1:N400" // explicit tab name — sheets now have Home as the first tab
): Promise<RawStudentRow[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: searchRange,
  });

  const allRows = res.data.values || [];

  // Find the header row: the one whose "Enrollment No." column also has
  // "Submitted" in the Assignment column next to it (the sheet has the
  // header text twice — a merged category row, then the real column row).
  const headerIndex = allRows.findIndex((r) =>
    (r[1] || "").toString().trim().toLowerCase() === "enrollment no." &&
    (r[4] || "").toString().trim().toLowerCase() === "submitted"
  );

  if (headerIndex === -1) {
    throw new Error(
      "Couldn't find the roster header ('Enrollment No.' / 'Submitted') in this sheet. " +
        "Check that the sheet's first tab has the expected CLASSPULSE layout."
    );
  }

  const dataRows: string[][] = [];
  for (let i = headerIndex + 1; i < allRows.length; i++) {
    const r = allRows[i];
    const enrollmentNo = (r[1] || "").toString().trim();
    // Stop at the first row that isn't a numeric enrollment number —
    // that's the end of the roster block.
    if (!enrollmentNo || !/^\d+$/.test(enrollmentNo)) break;
    dataRows.push(r as string[]);
  }

  return dataRows.map((r) => ({
    enrollmentNo: String(r[1] ?? ""),
    name: String(r[2] ?? "").trim(),
    email: String(r[3] ?? "").trim(),
    assignmentSubmitted: Number(r[4] ?? 0),
    assignmentTotal: Number(r[5] ?? 0),
    presentation: Number(r[6] ?? 0),
    attendancePrevMonth: Number(r[8] ?? 0),
    attendanceCurrMonth: Number(r[10] ?? 0),
    midsem1: Number(r[11] ?? 0),
    midsem2: Number(r[12] ?? 0),
  }));
}