import { PrismaClient } from "@prisma/client";
import { getSheetsClient } from "../lib/googleSheetsClient";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function loadLocalEnv() {
  const root = process.cwd();
  for (const file of [".env", ".env.local"]) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  }
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function findStudentHeader(rows: string[][]): number {
  return rows.findIndex((row) =>
    String(row?.[0] ?? "").trim().toLowerCase() === "s.no" &&
    String(row?.[1] ?? "").trim().toLowerCase().includes("enrollment") &&
    String(row?.[2] ?? "").trim().toLowerCase().includes("student"),
  );
}

async function main() {
  loadLocalEnv();

  const section = await prisma.section.findFirst({
    where: {
      name: "2",
      class: {
        semester: 7,
        department: { name: { equals: "ECE", mode: "insensitive" } },
      },
    },
    include: {
      class: { include: { department: true } },
      students: { orderBy: { enrollmentNo: "asc" } },
      subjects: { include: { assignments: { include: { teacher: true } } }, orderBy: { code: "asc" } },
      sheetLink: true,
    },
  });

  if (!section?.sheetLink?.sheetId) throw new Error("ECE 2 Sem 7 does not have a linked Google Sheet.");

  const sheets = getSheetsClient();
  const spreadsheetId = section.sheetLink.sheetId;
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });
  const sheetList = metadata.data.sheets || [];
  const tdSheets = sheetList.filter((sheet) => normalize(sheet.properties?.title).startsWith("TD-"));
  if (tdSheets.length === 0) throw new Error("No TD-* sheets were found.");

  const template = tdSheets.find((sheet) => normalize(sheet.properties?.title) === "TD-SL")
    || tdSheets.find((sheet) => !normalize(sheet.properties?.title).endsWith("-LAB"));
  if (!template?.properties?.sheetId || !template.properties.title) throw new Error("No Teacher Diary template was found. Expected TD-SL.");

  const templateValues = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${template.properties.title}'!A1:AZ500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const templateRows = templateValues.data.values || [];
  const studentHeaderRow = findStudentHeader(templateRows);
  if (studentHeaderRow === -1) throw new Error(`Template ${template.properties.title} does not contain the expected student table.`);

  const subjectByCode = new Map(section.subjects.map((subject) => [normalize(subject.code), subject]));
  const classLabel = `${section.class.department.name}-${section.name} Sem ${section.class.semester}`;
  const roster = section.students.map((student, index) => [String(index + 1), student.enrollmentNo, student.name]);

  // This script is deliberately separate from the Attendance Agent. It runs once
  // and performs the complete TD template replacement for the whole spreadsheet.
  const copyRequests = tdSheets
    .filter((sheet) => sheet.properties?.sheetId && sheet.properties.sheetId !== template.properties.sheetId)
    .map((sheet) => ({
      copyPaste: {
        source: { sheetId: template.properties!.sheetId!, startRowIndex: 0, endRowIndex: 500, startColumnIndex: 0, endColumnIndex: 52 },
        destination: { sheetId: sheet.properties!.sheetId!, startRowIndex: 0, endRowIndex: 500, startColumnIndex: 0, endColumnIndex: 52 },
        pasteType: "PASTE_NORMAL",
        pasteOrientation: "NORMAL",
      },
    }));

  if (copyRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: copyRequests } });
  }

  const clearRanges = tdSheets.flatMap((sheet) => {
    const title = sheet.properties?.title;
    if (!title) return [];
    return [`'${title}'!D3:AZ500`, `'${title}'!A${studentHeaderRow + 2}:C500`];
  });
  if (clearRanges.length > 0) {
    await sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: clearRanges } });
  }

  const valueWrites: Array<{ range: string; values: string[][] }> = [];
  for (const sheet of tdSheets) {
    const title = sheet.properties?.title;
    if (!title) continue;
    const code = normalize(title).replace(/^TD-/, "");
    const subject = subjectByCode.get(code);
    const subjectName = subject?.name || code.replace(/-/g, " ");
    const teacherName = subject?.assignments?.[0]?.teacher?.name || "";

    valueWrites.push({ range: `'${title}'!A1`, values: [[`TEACHER DIARY — ${subjectName}`]] });
    valueWrites.push({ range: `'${title}'!A3:B3`, values: [["Class", classLabel]] });
    valueWrites.push({ range: `'${title}'!D3:E3`, values: [["Subject", subjectName]] });
    valueWrites.push({ range: `'${title}'!G3:H3`, values: [["Teacher", teacherName]] });
    valueWrites.push({ range: `'${title}'!A4`, values: [["Latest Session"]] });
    valueWrites.push({ range: `'${title}'!D4`, values: [["Session ID"]] });
    valueWrites.push({ range: `'${title}'!A7:C7`, values: [["S.No", "Enrollment No.", "Student Name"]] });
    if (roster.length > 0) {
      valueWrites.push({
        range: `'${title}'!A${studentHeaderRow + 2}:C${studentHeaderRow + 1 + roster.length}`,
        values: roster,
      });
    }
  }

  if (valueWrites.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: valueWrites } });
  }

  console.log(`Overwrote ${tdSheets.length} Teacher Diary sheets using ${template.properties.title} as the canonical template.`);
  console.log(tdSheets.map((sheet) => sheet.properties?.title).filter(Boolean).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
