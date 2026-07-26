import * as XLSX from 'xlsx';
import type { ParsedRow, RowError, UploadKind } from './types';

const columns: Record<UploadKind, string[]> = {
  attendance: ['Enrollment Number', 'Student Name', 'LH', 'LA'],
  midsem: ['Enrollment Number', 'Student Name', 'Subject', 'Marks', 'Maximum Marks'],
  internal: ['Enrollment Number', 'Student Name', 'Assignment', 'Presentation', 'Attendance', 'Midsem 1', 'Midsem 2']
};
const stringValue = (value: unknown) => String(value ?? '').trim();
const numberValue = (value: unknown) => Number(value);
export function parseWorkbook(file: File): Promise<ParsedRow[]> {
  return file.arrayBuffer().then(data => {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '' });
  });
}
export function validateRows(kind: UploadKind, rows: ParsedRow[]): RowError[] {
  const errors: RowError[] = [];
  if (!rows.length) return [{ row: 1, field: 'file', message: 'The worksheet has no student rows.' }];
  const present = new Set(Object.keys(rows[0]));
  columns[kind].filter(c => !present.has(c)).forEach(c => errors.push({ row: 1, field: c, message: 'Required column is missing.' }));
  if (errors.length) return errors;
  const seen = new Set<string>();
  rows.forEach((record, index) => {
    const row = index + 2; const enrollment = stringValue(record['Enrollment Number']);
    if (!/^[A-Za-z0-9/-]{4,30}$/.test(enrollment)) errors.push({ row, field: 'Enrollment Number', message: 'Use a valid enrollment number.' });
    if (seen.has(enrollment)) errors.push({ row, field: 'Enrollment Number', message: 'Duplicate student in this upload.' });
    seen.add(enrollment);
    if (!stringValue(record['Student Name'])) errors.push({ row, field: 'Student Name', message: 'Student name is required.' });
    if (kind === 'attendance') {
      const held = numberValue(record.LH), attended = numberValue(record.LA);
      if (!Number.isFinite(held) || held < 0) errors.push({ row, field: 'LH', message: 'Lectures held must be zero or greater.' });
      if (!Number.isFinite(attended) || attended < 0 || attended > held) errors.push({ row, field: 'LA', message: 'Lectures attended must be between 0 and LH.' });
    }
    if (kind === 'midsem') {
      const marks = numberValue(record.Marks), maximum = numberValue(record['Maximum Marks']);
      if (!stringValue(record.Subject)) errors.push({ row, field: 'Subject', message: 'Subject is required.' });
      if (!Number.isFinite(marks) || !Number.isFinite(maximum) || maximum <= 0 || marks < 0 || marks > maximum) errors.push({ row, field: 'Marks', message: 'Marks must be between 0 and Maximum Marks.' });
    }
    if (kind === 'internal') ['Assignment','Presentation','Attendance','Midsem 1','Midsem 2'].forEach(field => {
      const value = numberValue(record[field]); if (!Number.isFinite(value) || value < 0) errors.push({ row, field, message: 'Enter a non-negative numeric mark.' });
    });
  });
  return errors;
}
export function template(kind: UploadKind) { return [columns[kind].reduce((row, key) => ({ ...row, [key]: '' }), {})]; }
