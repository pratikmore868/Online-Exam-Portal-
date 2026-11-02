import "server-only";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getSessionUser, type Role, type SessionUser } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

// Never sends internal error text to the browser, since driver errors can include connection details.
export function handleApiError(error: unknown) {
  // Next.js signals such as "this route is dynamic" also arrive here and must pass through.
  unstable_rethrow(error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }
  console.error("API error:", error);
  return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function requireUser(
  roles?: Role[],
  options: { allowPasswordChangePending?: boolean } = {}
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "Please log in.", "UNAUTHENTICATED");
  }
  if (user.mustChangePassword && !options.allowPasswordChangePending) {
    throw new ApiError(403, "Please change your temporary password first.", "PASSWORD_CHANGE_REQUIRED");
  }
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to do this.", "FORBIDDEN");
  }
  return user;
}

export const requireStaff = () => requireUser(["admin", "teacher"]);
export const requireAdmin = () => requireUser(["admin"]);
export const requireStudent = () => requireUser(["student"]);

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through to the error below
  }
  throw new ApiError(400, "Invalid request body.");
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
