import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStaff } from "@/lib/api";
import { MAX_STUDENT_FILE_BYTES, parseStudentCsv, studentKey } from "@/lib/studentImport";

// Sends the file twice: first to preview what's in it, then with confirm to save it.
export async function POST(req: Request) {
  try {
    await requireStaff();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) throw new ApiError(400, "Please choose a .csv file.");
    if (!file.name.toLowerCase().endsWith(".csv")) throw new ApiError(400, "Only .csv files can be imported.");
    if (file.size > MAX_STUDENT_FILE_BYTES) throw new ApiError(400, "This file is over 2 MB. Please split it into smaller files.");

    const confirm = form.get("confirm") === "true";
    const batch = String(form.get("batch") ?? "").trim();
    if (!batch || batch === "All Batches" || batch.length > 80) throw new ApiError(400, "Please choose a batch for these students.");

    const parsed = parseStudentCsv(await file.text());
    if ("error" in parsed) throw new ApiError(400, parsed.error);

    const db = await getDatabase();
    const students = db.collection("students");

    // The same person already on the portal, in any batch.
    const phones = [...new Set(parsed.rows.map((r) => r.phone).filter(Boolean))];
    const matches = await students.find({ phone: { $in: phones } }, { projection: { name: 1, phone: 1, batch: 1 } }).toArray();
    const existing = new Map(matches.map((s) => [studentKey(s.name, s.phone), s.batch]));

    const rows = parsed.rows.map((row) => ({
      ...row,
      duplicate: existing.has(studentKey(row.name, row.phone)),
      existingBatch: existing.get(studentKey(row.name, row.phone)) ?? null,
    }));
    const toImport = rows.filter((r) => r.errors.length === 0 && !r.duplicate);

    const summary = {
      total: rows.length,
      valid: toImport.length,
      invalid: rows.filter((r) => r.errors.length > 0).length,
      duplicates: rows.filter((r) => r.errors.length === 0 && r.duplicate).length,
    };

    if (!confirm) return NextResponse.json({ success: true, ...summary, rows });
    if (toImport.length === 0) return NextResponse.json({ success: true, ...summary, imported: 0 });

    // Five digits leaves room for thousands of students a year. Checked against existing IDs so none repeat.
    const now = new Date();
    const year = now.getFullYear();
    const used = new Set((await students.distinct("id", { id: { $regex: `^RR${year}` } })) as string[]);
    const newId = () => {
      for (let tries = 0; tries < 200; tries++) {
        const id = `RR${year}${randomInt(10000, 100000)}`;
        if (!used.has(id)) {
          used.add(id);
          return id;
        }
      }
      throw new ApiError(500, "Could not generate student IDs. Please try again.");
    };

    const docs = toImport.map((row) => ({
      id: newId(),
      name: row.name,
      email: row.email || "-",
      phone: row.phone,
      batch,
      dob: row.dob || "-",
      created: `${now.getMonth() + 1}/${now.getDate()}/${year}`,
      createdAt: now,
      status: "active",
    }));
    await students.insertMany(docs);

    return NextResponse.json({ success: true, ...summary, imported: docs.length, batch });
  } catch (error) {
    return handleApiError(error);
  }
}
