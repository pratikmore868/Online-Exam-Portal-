import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { handleApiError, requireStudent } from "@/lib/api";
import { finalizeExpired } from "@/lib/attempts";

// Everything on the student dashboard is worked out from that student's own submitted attempts.
export async function GET() {
  try {
    const user = await requireStudent();
    const db = await getDatabase();

    await finalizeExpired(db, { studentId: user.id });
    const attempts = await db
      .collection("attempts")
      .find({ studentId: user.id, status: "submitted" })
      .sort({ submittedAt: -1 })
      .toArray();

    let correct = 0;
    let incorrect = 0;
    let timeSeconds = 0;
    let percentageSum = 0;
    const subjects: Record<string, { score: number; maxScore: number }> = {};

    for (const attempt of attempts) {
      const result = attempt.result ?? {};
      correct += result.correct ?? 0;
      incorrect += result.incorrect ?? 0;
      timeSeconds += result.timeTakenSeconds ?? 0;
      percentageSum += result.percentage ?? 0;
      for (const [name, tally] of Object.entries<any>(result.bySubject ?? {})) {
        subjects[name] ??= { score: 0, maxScore: 0 };
        subjects[name].score += tally.score;
        subjects[name].maxScore += tally.maxScore;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        examsCompleted: attempts.length,
        accuracy: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 1000) / 10 : null,
        averagePercentage: attempts.length > 0 ? Math.round((percentageSum / attempts.length) * 10) / 10 : null,
        timeSeconds,
        subjects: Object.entries(subjects).map(([name, s]) => ({
          name,
          percentage: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 1000) / 10 : 0,
        })),
        recent: attempts.slice(0, 5).map((a) => ({
          examId: a.examId,
          examTitle: a.examTitle,
          score: a.result?.score,
          maxScore: a.result?.maxScore,
          percentage: a.result?.percentage,
          submittedAt: a.submittedAt,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
