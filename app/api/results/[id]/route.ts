import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStaff } from "@/lib/api";
import { analyzeAttempt } from "@/lib/analysis";
import { finalizeIfExpired } from "@/lib/attempts";
import { findExam, loadQuestions } from "@/lib/exams";

// Full analysis of one attempt for staff. Includes correct answers, so it must stay staff-only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const db = await getDatabase();

    const found = await db.collection("attempts").findOne({ id });
    if (!found) throw new ApiError(404, "Result not found.");

    const attempt = await finalizeIfExpired(db, found);
    if (attempt.status !== "submitted") {
      throw new ApiError(409, "This student is still writing the exam.", "IN_PROGRESS");
    }

    const cameraIncidents = await db
      .collection("camera_incidents")
      .find({ attemptId: attempt.id }, { projection: { _id: 0, type: 1, startedAt: 1, endedAt: 1, photoId: 1 } })
      .sort({ startedAt: 1 })
      .toArray();

    const [exam, questions, peers] = await Promise.all([
      findExam(db, attempt.examId),
      loadQuestions(db, attempt.questionIds),
      db
        .collection("attempts")
        .find({ examId: attempt.examId, status: "submitted" }, { projection: { answers: 1, marking: 1, "result.score": 1, "result.percentage": 1 } })
        .toArray(),
    ]);

    const scores = peers.map((p) => p.result?.score ?? 0);
    const allowedSeconds = Math.round((new Date(attempt.endsAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000);

    const analysis = analyzeAttempt({
      questions: questions as any,
      attempt: attempt as any,
      peers: peers as any,
      // What this student actually saw, even if the exam's sections are changed later.
      sections: attempt.sections ?? exam?.sections,
      usedSeconds: attempt.result?.timeTakenSeconds ?? 0,
      allowedSeconds,
    });

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        examTitle: attempt.examTitle,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        batch: attempt.batch,
        submittedAt: attempt.submittedAt,
        submitType: attempt.submitType,
        violations: (attempt.violations ?? []).map((v: any) => ({
          type: v.type,
          leftAt: v.leftAt,
          returnedAt: v.returnedAt ?? null,
        })),
        camera: {
          required: !!attempt.cameraRequired,
          activeSeconds: attempt.cameraSeconds ?? 0,
          detectorFailed: !!attempt.cameraDetectorFailed,
          incidents: cameraIncidents,
        },
        marking: attempt.marking,
        result: attempt.result,
        rank: scores.filter((s) => s > (attempt.result?.score ?? 0)).length + 1,
        participants: peers.length,
        classAverage: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        topScore: scores.length > 0 ? Math.max(...scores) : 0,
      },
      analysis,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
