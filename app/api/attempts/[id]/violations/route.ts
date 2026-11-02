import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireStudent } from "@/lib/api";
import {
  attemptForOwner,
  parseAttemptState,
  recordViolation,
  recordViolationReturn,
} from "@/lib/attempts";
import { VIOLATION_TYPES } from "@/lib/proctoring";

// The browser reports when a student leaves the exam and when they come back.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await readJson(req);
    const { eventId, type, returned } = body;

    if (typeof eventId !== "string" || !eventId || eventId.length > 64) {
      throw new ApiError(400, "Invalid event.");
    }

    const db = await getDatabase();
    const attempt = await attemptForOwner(db, id, user);

    if (returned === true) {
      await recordViolationReturn(db, attempt.id, eventId);
      return NextResponse.json({ success: true });
    }

    if (!VIOLATION_TYPES.includes(type)) {
      throw new ApiError(400, "Invalid event.");
    }

    const updated = await recordViolation(db, attempt, eventId, type, parseAttemptState(attempt, body));
    return NextResponse.json({
      success: true,
      status: updated.status,
      violationCount: updated.violationCount ?? 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
