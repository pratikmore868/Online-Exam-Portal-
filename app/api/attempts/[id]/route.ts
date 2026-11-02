import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireAdmin, requireStudent } from "@/lib/api";
import {
  attemptForOwner,
  finalizeIfExpired,
  parseAttemptState,
  saveAttemptState,
} from "@/lib/attempts";

// Autosave. The response carries the server's clock so the on-screen timer stays accurate.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await readJson(req);
    const db = await getDatabase();

    const attempt = await attemptForOwner(db, id, user);
    const saved = attempt.status === "in_progress"
      && await saveAttemptState(db, attempt, parseAttemptState(attempt, body));

    if (!saved) {
      const current = await finalizeIfExpired(db, attempt);
      return NextResponse.json({ success: true, saved: false, status: current.status, serverNow: new Date() });
    }

    return NextResponse.json({
      success: true,
      saved: true,
      status: "in_progress",
      endsAt: attempt.endsAt,
      serverNow: new Date(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Lets a student sit an exam again, e.g. after a power cut. Removes their result permanently.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const db = await getDatabase();

    const result = await db.collection("attempts").deleteOne({ id });
    if (result.deletedCount === 0) throw new ApiError(404, "Attempt not found.");

    await db.collection("camera_incidents").deleteMany({ attemptId: id });
    await db.collection("camera_photos").deleteMany({ attemptId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
