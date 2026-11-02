import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { handleApiError, readJson, requireStudent } from "@/lib/api";
import {
  attemptForOwner,
  attemptResultView,
  finalizeAttempt,
  parseAttemptState,
  saveAttemptState,
} from "@/lib/attempts";

// The score is always worked out here from stored answers; the browser never supplies it.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await readJson(req);
    const db = await getDatabase();

    let attempt = await attemptForOwner(db, id, user);

    if (attempt.status === "in_progress") {
      // Takes the browser's last answers if they arrive in time. Late ones are ignored by the save.
      const state = parseAttemptState(attempt, body);
      if (await saveAttemptState(db, attempt, state)) {
        attempt = { ...attempt, ...state };
      }
      const submitType = new Date(attempt.endsAt).getTime() <= Date.now() ? "time_up" : "manual";
      attempt = (await finalizeAttempt(db, attempt, submitType)) ?? attempt;
    }

    return NextResponse.json({ success: true, attempt: await attemptResultView(db, attempt) });
  } catch (error) {
    return handleApiError(error);
  }
}
