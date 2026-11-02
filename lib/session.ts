import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "./mongodb";

export const SESSION_COOKIE = "rr_session";
const SESSION_DAYS = 7;

export type Role = "student" | "teacher" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  batch?: string;
  email?: string;
  mustChangePassword: boolean;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, role: Role) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await getDatabase();

  // Only the hash is stored, so a database leak can't be used to log in.
  await db.collection("sessions").insertOne({
    tokenHash: hashToken(token),
    userId,
    role,
    createdAt: new Date(),
    expiresAt,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDatabase();
    await db.collection("sessions").deleteOne({ tokenHash: hashToken(token) });
  }
  store.delete(SESSION_COOKIE);
}

export async function destroyUserSessions(userId: string, role: Role) {
  const db = await getDatabase();
  await db.collection("sessions").deleteMany({ userId, role });
}

// The user is re-read on every request so a deactivated account or changed role applies immediately.
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDatabase();
  const session = await db.collection("sessions").findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  if (session.role === "student") {
    const student = await db.collection("students").findOne({ id: session.userId, status: "active" });
    if (!student) return null;
    return {
      id: student.id,
      name: student.name,
      role: "student",
      batch: student.batch,
      mustChangePassword: !!student.mustChangePassword,
    };
  }

  const staff = await db.collection("admins").findOne({ username: session.userId, status: "active" });
  if (!staff) return null;
  return {
    id: staff.username,
    name: staff.name,
    role: staff.role,
    email: staff.email,
    mustChangePassword: !!staff.mustChangePassword,
  };
}
