import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson } from "@/lib/api";
import { fakePasswordCheck, verifyPassword } from "@/lib/password";
import { createSession, type Role } from "@/lib/session";

const MAX_FAILURES = 10;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || !password || password.length > 128) {
      throw new ApiError(400, "Enter your ID and password.");
    }

    const db = await getDatabase();
    const failures = db.collection("login_failures");
    const key = identifier.toLowerCase();

    const failure = await failures.findOne({ key, expiresAt: { $gt: new Date() } });
    if (failure && failure.count >= MAX_FAILURES) {
      throw new ApiError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`, "LOCKED");
    }

    const student = await db.collection("students").findOne({
      id: identifier.toUpperCase(),
      status: "active",
    });
    const staff = student
      ? null
      : await db.collection("admins").findOne({ username: key, status: "active" });
    const account = student ?? staff;

    // The same error for an unknown ID and a wrong password, so IDs can't be discovered.
    let valid = false;
    if (account?.passwordHash) {
      valid = await verifyPassword(password, account.passwordHash);
    } else {
      await fakePasswordCheck(password);
    }

    if (!account || !valid) {
      await failures.updateOne(
        { key },
        {
          $inc: { count: 1 },
          $set: { expiresAt: new Date(Date.now() + LOCK_MINUTES * 60_000) },
        },
        { upsert: true }
      );
      throw new ApiError(401, "Incorrect ID or password.", "INVALID_CREDENTIALS");
    }

    await failures.deleteOne({ key });

    const role: Role = student ? "student" : account.role;
    const userId: string = student ? student.id : account.username;
    await createSession(userId, role);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: account.name,
        role,
        batch: student?.batch,
        mustChangePassword: !!account.mustChangePassword,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
