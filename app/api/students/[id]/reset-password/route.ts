import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStaff } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { destroyUserSessions } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const db = await getDatabase();

    const tempPassword = generateTempPassword();
    const result = await db.collection("students").updateOne(
      { id },
      { $set: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true } }
    );
    if (result.matchedCount === 0) throw new ApiError(404, "Student not found.");

    await destroyUserSessions(id, "student");

    return NextResponse.json({ success: true, tempPassword });
  } catch (error) {
    return handleApiError(error);
  }
}
