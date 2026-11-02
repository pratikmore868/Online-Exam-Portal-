import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStudent, requireUser } from "@/lib/api";
import {
  attemptInProgressView,
  attemptResultView,
  finalizeIfExpired,
  startAttempt,
} from "@/lib/attempts";
import { canStudentSee, findExam, loadQuestions, questionForStudent } from "@/lib/exams";
import { orderedQuestionIds, resolveSections } from "@/lib/sections";

async function respondWith(db: Awaited<ReturnType<typeof getDatabase>>, attempt: any) {
  return NextResponse.json({
    success: true,
    attempt: attempt.status === "submitted"
      ? await attemptResultView(db, attempt)
      : await attemptInProgressView(db, attempt),
  });
}

// Reads the current attempt but never starts one, so opening the exam URL
// directly can't start the clock before the student accepts the instructions.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam) throw new ApiError(404, "Exam not found");

    // Staff preview: nothing is saved or scored.
    if (user.role !== "student") {
      const loaded = await loadQuestions(db, exam.questions ?? []);
      const sections = resolveSections(loaded as any, exam.sections);
      const byId = new Map(loaded.map((q) => [q.id, q]));
      const questions = orderedQuestionIds(sections).map((id) => byId.get(id)!);
      return NextResponse.json({
        success: true,
        attempt: {
          preview: true,
          id: "preview",
          examId: exam.id,
          examTitle: exam.title,
          batch: exam.batch,
          status: "in_progress",
          endsAt: new Date(Date.now() + Number(exam.duration || 180) * 60_000),
          serverNow: new Date(),
          answers: {},
          statuses: {},
          currentIndex: 0,
          sections,
          questions: questions.map(questionForStudent),
        },
      });
    }

    const existing = await db.collection("attempts").findOne({ examId: exam.id, studentId: user.id });
    if (!existing) {
      if (!canStudentSee(exam, user.batch)) throw new ApiError(404, "Exam not found");
      return NextResponse.json({ success: true, attempt: null });
    }

    return await respondWith(db, await finalizeIfExpired(db, existing));
  } catch (error) {
    return handleApiError(error);
  }
}

// Starts the attempt, or returns the existing one so that refreshing resumes rather than restarts.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam || !canStudentSee(exam, user.batch)) {
      throw new ApiError(404, "Exam not found");
    }

    return await respondWith(db, await startAttempt(db, exam, user));
  } catch (error) {
    return handleApiError(error);
  }
}
