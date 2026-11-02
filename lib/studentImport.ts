// Reads the student CSV format: name,email,phone,dob (see public/samples/sample-students.csv).

export const STUDENT_COLUMNS = ["name", "email", "phone", "dob"];
export const MAX_STUDENT_ROWS = 5000;
export const MAX_STUDENT_FILE_BYTES = 2 * 1024 * 1024;

export interface StudentRow {
  line: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
  errors: string[];
}

// Handles quoted values, including commas and doubled quotes inside them, and Windows line endings.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        value += c;
      }
    } else if (c === '"' && value === "") {
      quoted = true;
    } else if (c === ",") {
      row.push(value);
      value = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += c;
    }
  }
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const studentKey = (name: string, phone: string) => `${name.trim().toLowerCase()}|${phone.trim()}`;

// Returns a file-level error, or the rows each with their own problems listed.
export function parseStudentCsv(input: string): { error: string } | { rows: StudentRow[] } {
  const table = parseCsv(input);
  if (table.length === 0) return { error: "This file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  if (header.join(",") !== STUDENT_COLUMNS.join(",")) {
    return { error: `The first line must be exactly: ${STUDENT_COLUMNS.join(",")}. This file has: ${table[0].join(",").slice(0, 200)}` };
  }

  const data = table.slice(1).map((cells, i) => ({ cells, line: i + 2 })).filter(({ cells }) => cells.some((c) => c.trim()));
  if (data.length === 0) return { error: "This file has no students in it." };
  if (data.length > MAX_STUDENT_ROWS) return { error: `Please upload at most ${MAX_STUDENT_ROWS} students at a time.` };

  const seen = new Set<string>();
  const rows = data.map(({ cells, line }) => {
    const [name = "", email = "", phone = "", dob = ""] = cells.map((c) => c.trim());
    const errors: string[] = [];

    if (cells.length !== STUDENT_COLUMNS.length) errors.push(`Expected ${STUDENT_COLUMNS.length} columns, found ${cells.length}.`);
    if (!name) errors.push("Name is required.");
    // A value starting with these runs as a formula when the export is opened in Excel.
    else if (/^[=+\-@]/.test(name)) errors.push("Name can't start with =, +, - or @.");
    if (!/^\d{10}$/.test(phone)) errors.push("Phone must be exactly 10 digits.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email isn't valid.");
    if (dob && !isRealDate(dob)) errors.push("Date of birth must be a real date in the form YYYY-MM-DD.");

    const key = studentKey(name, phone);
    if (name && phone && seen.has(key)) errors.push("This student appears twice in the file.");
    seen.add(key);

    return { line, name: name.replace(/\s+/g, " "), email, phone, dob, errors };
  });

  return { rows };
}
