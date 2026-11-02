import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, clampInt, escapeRegex, handleApiError, readJson, requireAdmin, requireStaff } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/password";

// Password hashes must never leave the server.
const SAFE_PROJECTION = { passwordHash: 0 };

export async function GET(req: Request) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const batch = searchParams.get("batch");
    const q = searchParams.get("q");
    const sort = searchParams.get("sort") || "name-asc";
    const page = clampInt(searchParams.get("page"), 1, 1, 100000);
    const limit = clampInt(searchParams.get("limit"), 15, 1, 5000);

    const db = await getDatabase();
    const filter: any = {};

    if (batch && batch !== "All Batches") {
      filter.batch = batch;
    }

    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ name: pattern }, { id: pattern }, { phone: pattern }, { batch: pattern }];
    }

    let sortObj: any = { name: 1 };
    if (sort === "name-desc") sortObj = { name: -1 };
    if (sort === "id-asc") sortObj = { id: 1 };
    if (sort === "created-desc") sortObj = { createdAt: -1, name: 1 };

    const total = await db.collection("students").countDocuments(filter);
    const students = await db
      .collection("students")
      .find(filter, { projection: SAFE_PROJECTION })
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Also get all unique batches
    const batches = await db.collection("students").distinct("batch");

    return NextResponse.json({
      success: true,
      students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      batches: ["All Batches", ...batches.filter(Boolean).sort()]
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff();

    const body = await readJson(req);
    const { name, phone, batch, email } = body;
    if (typeof name !== "string" || !name.trim() || typeof phone !== "string" || !phone.trim()) {
      throw new ApiError(400, "Name and phone are required");
    }

    const db = await getDatabase();
    const now = new Date();
    const year = now.getFullYear();

    let id = "";
    for (let tries = 0; tries < 20 && !id; tries++) {
      const candidate = `RR${year}${randomInt(1000, 10000)}`;
      if (!(await db.collection("students").findOne({ id: candidate }))) id = candidate;
    }
    if (!id) throw new ApiError(500, "Could not generate a student ID. Please try again.");

    const tempPassword = generateTempPassword();
    const newStudent = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      email: (typeof email === "string" && email.trim()) || "-",
      batch: typeof batch === "string" && batch ? batch : "Testing",
      dob: typeof body.dob === "string" && body.dob ? body.dob : "-",
      created: `${now.getMonth() + 1}/${now.getDate()}/${year}`,
      createdAt: now,
      status: "active",
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    };

    await db.collection("students").insertOne(newStudent);

    const { passwordHash: _omit, ...student } = newStudent;
    // The only time this password is ever available in plain text.
    return NextResponse.json({ success: true, student, tempPassword });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const body = await readJson(req);
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
      throw new ApiError(400, "Array of ids is required");
    }

    const db = await getDatabase();
    const result = await db.collection("students").deleteMany({ id: { $in: ids } });
    // Exam results are kept so past rankings stay correct; only the ability to log in goes away.
    await db.collection("sessions").deleteMany({ userId: { $in: ids }, role: "student" });
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
