import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { finalizeExpired } from "@/lib/attempts";
import { ApiError, handleApiError, readJson, requireStaff, requireUser } from "@/lib/api";
import { computeTotalMarks, examForStudent, LIVE_STATUSES, parseExamFields } from "@/lib/exams";
import { DEFAULT_MARKING } from "@/lib/scoring";
import { normalizeSections } from "@/lib/sections";

// Exam dates created before createdAt existed are text like "Oct 24, 2026", which sorts alphabetically.
function createdTime(exam: any) {
  const parsed = new Date(exam.createdAt ?? exam.created).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const db = await getDatabase();

    if (user.role === "student") {
      // The batch comes from the session, never from the request.
      await finalizeExpired(db, { studentId: user.id });
      const [exams, attempts] = await Promise.all([
        db.collection("exams").find({
          status: { $in: LIVE_STATUSES },
          batch: { $in: [user.batch, "All Batches"] },
        }).toArray(),
        db.collection("attempts").find({ studentId: user.id }, {
          projection: { id: 1, examId: 1, status: 1, endsAt: 1, "result.score": 1, "result.maxScore": 1 },
        }).toArray(),
      ]);
      const attemptByExam = new Map(attempts.map((a) => [a.examId, a]));

      return NextResponse.json({
        success: true,
        exams: exams
          .sort((a, b) => createdTime(b) - createdTime(a))
          .map((exam) => {
            const attempt = attemptByExam.get(exam.id);
            return {
              ...examForStudent(exam, user.id),
              attempt: attempt
                ? {
                    id: attempt.id,
                    status: attempt.status,
                    endsAt: attempt.endsAt,
                    score: attempt.result?.score,
                    maxScore: attempt.result?.maxScore,
                  }
                : null,
            };
          }),
      });
    }

    const { searchParams } = new URL(req.url);
    const batch = searchParams.get("batch");
    const filter: any = {};
    if (batch && batch !== "All Batches") {
      filter.$or = [{ batch: batch }, { batch: "All Batches" }];
    }

    await finalizeExpired(db);
    const [exams, stats] = await Promise.all([
      db.collection("exams").find(filter).toArray(),
      db.collection("attempts").aggregate([
        {
          $group: {
            _id: "$examId",
            attempts: { $sum: 1 },
            submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
            avgScore: { $avg: "$result.percentage" },
          },
        },
      ]).toArray(),
    ]);
    const statsByExam = new Map(stats.map((s) => [s._id, s]));

    return NextResponse.json({
      success: true,
      exams: exams
        .sort((a, b) => createdTime(b) - createdTime(a))
        .map((exam) => {
          const s = statsByExam.get(exam.id);
          return {
            ...exam,
            // Replaces the placeholder counters stored on older exam documents.
            attempts: s?.attempts ?? 0,
            avgScore: s?.avgScore ?? 0,
            completion: s ? (s.submitted / s.attempts) * 100 : 0,
          };
        }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff();

    const body = await readJson(req);
    const fields = parseExamFields(body);
    if (!fields.title) {
      throw new ApiError(400, "Exam title is required");
    }

    const db = await getDatabase();
    const id = `exam-${Date.now()}`;

    const today = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const createdStr = `${months[today.getMonth()]} ${today.getDate() > 9 ? today.getDate() : '0' + today.getDate()}, ${today.getFullYear()}`;

    const questions: string[] = fields.questions ?? [];
    const marking = fields.marking ?? DEFAULT_MARKING;
    const batch = fields.batch || "12th JEE RRTS";

    const newExam = {
      id,
      title: fields.title,
      duration: fields.duration ?? 180,
      totalMarks: await computeTotalMarks(db, questions, marking),
      totalQuestions: questions.length,
      batch,
      subject: fields.subject || "Physics + Chemistry + Mathematics",
      created: createdStr,
      createdAt: today,
      // Students can't see an exam until staff add questions and publish it.
      status: "draft",
      difficulty: body.difficulty || "Hard",
      description: body.description || `${fields.title} assessment for batch ${batch}`,
      questions,
      // Empty by default: questions then group into sections by subject.
      sections: normalizeSections(fields.sections ?? [], questions),
      marking,
      cameraProctoring: fields.cameraProctoring ?? false,
      cameraExemptions: fields.cameraExemptions ?? [],
      availableFrom: fields.availableFrom ?? null,
      availableUntil: fields.availableUntil ?? null,
    };

    await db.collection("exams").insertOne(newExam);
    return NextResponse.json({ success: true, exam: newExam });
  } catch (error) {
    return handleApiError(error);
  }
}
