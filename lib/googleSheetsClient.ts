import { google } from "googleapis";

// Auth via service account. The linked spreadsheets must grant this service
// account Editor access for the Attendance Agent to write Teacher Diary data.
export function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
