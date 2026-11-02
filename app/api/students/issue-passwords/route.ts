import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireAdmin } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/password";

// Hashing is deliberately slow, so large batches are issued a chunk at a time.
const MAX_PER_REQUEST = 200;

// Gives first-time passwords to students who have none. Students who already
// have a password are left alone, so this is safe to run repeatedly.
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { batch } = await readJson(req);
    if (typeof batch !== "string" || !batch) {
      throw new ApiError(400, "Choose a batch.");
    }

    const db = await getDatabase();
    const filter: any = { status: "active", passwordHash: { $exists: false } };
    if (batch !== "All Batches") filter.batch = batch;

    const students = await db
      .collection("students")
      .find(filter, { projection: { id: 1, name: 1, batch: 1, phone: 1 } })
      .sort({ id: 1 })
      .limit(MAX_PER_REQUEST)
      .toArray();

    const issued = await Promise.all(
      students.map(async (student) => {
        const tempPassword = generateTempPassword();
        return {
          id: student.id,
          name: student.name,
          batch: student.batch,
          phone: student.phone,
          tempPassword,
          passwordHash: await hashPassword(tempPassword),
        };
      })
    );

    if (issued.length > 0) {
      await db.collection("students").bulkWrite(
        issued.map((s) => ({
          updateOne: {
            // Re-checked here so a concurrent run can't replace a password already handed out.
            filter: { id: s.id, passwordHash: { $exists: false } },
            update: { $set: { passwordHash: s.passwordHash, mustChangePassword: true } },
          },
        }))
      );
    }

    const remaining = await db.collection("students").countDocuments(filter);

    return NextResponse.json({
      success: true,
      issued: issued.map(({ passwordHash: _omit, ...rest }) => rest),
      remaining,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
