import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStudent } from "@/lib/api";
import { analyzeAttempt, accuracyOf } from "@/lib/analysis";
import { attemptResultView, finalizeIfExpired } from "@/lib/attempts";
import { examWindow, findExam, loadQuestions } from "@/lib/exams";

// A student's own analysis for one exam they have submitted.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam) throw new ApiError(404, "Exam not found");

    const found = await db.collection("attempts").findOne({ examId: exam.id, studentId: user.id });
    if (!found) throw new ApiError(404, "You have not attempted this exam yet.");
    const attempt = await finalizeIfExpired(db, found);
    if (attempt.status !== "submitted") {
      throw new ApiError(409, "This exam isn't submitted yet.", "IN_PROGRESS");
    }

    const [questions, peers, history] = await Promise.all([
      loadQuestions(db, attempt.questionIds),
      db
        .collection("attempts")
        .find({ examId: attempt.examId, status: "submitted" }, { projection: { answers: 1, marking: 1, "result.score": 1 } })
        .toArray(),
      db
        .collection("attempts")
        .find({ studentId: user.id, status: "submitted" }, { projection: { _id: 0, examId: 1, examTitle: 1, submittedAt: 1, result: 1 } })
        .sort({ submittedAt: -1 })
        .limit(20)
        .toArray(),
    ]);

    const allowedSeconds = Math.round((new Date(attempt.endsAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000);
    const analysis = analyzeAttempt({
      questions: questions as any,
      attempt: attempt as any,
      peers: peers as any,
      sections: attempt.sections ?? exam.sections,
      usedSeconds: attempt.result?.timeTakenSeconds ?? 0,
      allowedSeconds,
    });

    // Answers stay hidden while the exam is still open, so they can't be passed to students who are yet to sit it.
    // Exams without a closing time show them straight away.
    const { until } = examWindow(exam);
    const answersVisible = !until || until.getTime() <= Date.now();
    const questionRows = answersVisible
      ? analysis.questions
      : analysis.questions.map((q) => ({ ...q, correctAnswer: null, answerRange: null, explanation: null }));

    const scores = peers.map((p) => p.result?.score ?? 0);
    const base = await attemptResultView(db, attempt);

    return NextResponse.json({
      success: true,
      attempt: {
        ...base,
        studentName: user.name,
        studentId: user.id,
        allowedSeconds,
        classAverage: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        topScore: scores.length > 0 ? Math.max(...scores) : 0,
      },
      answersVisible,
      answersFrom: answersVisible ? null : until,
      analysis: { ...analysis, questions: questionRows },
      progress: history.map((h) => ({
        examId: h.examId,
        examTitle: h.examTitle,
        submittedAt: h.submittedAt,
        timeTakenSeconds: h.result?.timeTakenSeconds ?? 0,
        score: h.result?.score ?? 0,
        maxScore: h.result?.maxScore ?? 0,
        percentage: h.result?.percentage ?? 0,
        accuracy: accuracyOf(h.result?.correct ?? 0, h.result?.incorrect ?? 0),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
