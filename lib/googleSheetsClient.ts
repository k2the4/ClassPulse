import { createPrivateKey } from "node:crypto";
import { google } from "googleapis";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Normalize common ways a PEM key gets pasted into a hosting provider:
 * - copied .env assignments (GOOGLE_SA_PRIVATE_KEY=...)
 * - surrounding single/double quotes
 * - escaped newlines (\\n) or real newlines
 * - PEM body whose line breaks were flattened by the editor
 */
function normalizePrivateKey(rawValue: string): string {
  let value = rawValue.trim();

  value = value.replace(/^GOOGLE_SA_PRIVATE_KEY\s*=\s*/i, "").trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      value = JSON.parse(value) as string;
    } catch {
      value = value.slice(1, -1);
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }

  value = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();

  const pem = value.match(
    /(-----BEGIN (?:RSA )?PRIVATE KEY-----)([\s\S]*?)(-----END (?:RSA )?PRIVATE KEY-----)/
  );

  if (!pem) return value;

  const body = pem[2].replace(/[^A-Za-z0-9+/=]/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];

  return `${pem[1]}\n${lines.join("\n")}\n${pem[3]}`;
}

// Auth via service account. The linked spreadsheets must grant this service
// account Editor access for the Attendance Agent to write Teacher Diary data.
export function getSheetsClient() {
  const email = process.env.GOOGLE_SA_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY ?? "";

  if (!email) {
    throw new Error("Missing GOOGLE_SA_EMAIL. Configure the service-account email in Vercel.");
  }

  if (!rawKey.trim()) {
    throw new Error("Missing GOOGLE_SA_PRIVATE_KEY. Configure the PEM private key in Vercel.");
  }

  const key = normalizePrivateKey(rawKey);

  try {
    // Validate before sending a request so malformed env values get an actionable error.
    createPrivateKey({ key, format: "pem" });
  } catch {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY cannot be decoded as a PEM private key. Store only the private_key value from the Google service-account JSON; the key is normalized for quotes and escaped newlines automatically."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: GOOGLE_SCOPES,
  });

  return google.sheets({ version: "v4", auth });
}
