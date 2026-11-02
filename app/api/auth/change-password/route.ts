import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireUser } from "@/lib/api";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { createSession, destroyUserSessions } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const user = await requireUser(undefined, { allowPasswordChangePending: true });
    const body = await readJson(req);
    const { currentPassword, newPassword } = body;

    const problem = passwordProblem(newPassword);
    if (problem) throw new ApiError(400, problem);
    if (newPassword === currentPassword) {
      throw new ApiError(400, "The new password must be different from the current one.");
    }

    const db = await getDatabase();
    const isStudent = user.role === "student";
    const collection = db.collection(isStudent ? "students" : "admins");
    const filter = isStudent ? { id: user.id } : { username: user.id };

    const account = await collection.findOne(filter);
    if (!account || typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, account.passwordHash))) {
      throw new ApiError(400, "Your current password is incorrect.", "WRONG_PASSWORD");
    }

    await collection.updateOne(filter, {
      $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });

    // Log out every other device, then start a fresh session on this one.
    await destroyUserSessions(user.id, user.role);
    await createSession(user.id, user.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
