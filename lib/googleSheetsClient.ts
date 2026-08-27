import { google } from "googleapis";

// Auth via service account. Share each sheet (Viewer) with GOOGLE_SA_EMAIL
// for this to work — either a subject's sheet or a section's combined sheet.
export function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}
