import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { clampInt, escapeRegex, handleApiError, requireStaff } from "@/lib/api";
import { accuracyOf, percentileOf } from "@/lib/analysis";
import { finalizeExpired } from "@/lib/attempts";

const PASS_PERCENTAGE = 60;

const SORTS: Record<string, Record<string, 1 | -1>> = {
  // Ties go to whoever finished faster.
  rank: { "result.percentage": -1, "result.timeTakenSeconds": 1, studentId: 1 },
  name: { studentName: 1, studentId: 1 },
  time: { "result.timeTakenSeconds": 1, studentId: 1 },
  submitted: { submittedAt: -1, studentId: 1 },
};

export async function GET(req: Request) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const batch = searchParams.get("batch");
    const studentId = searchParams.get("studentId");
    const q = searchParams.get("q");
    const sortKey = SORTS[searchParams.get("sort") ?? ""] ? searchParams.get("sort")! : "rank";
    const reversed = searchParams.get("dir") === "desc";
    const page = clampInt(searchParams.get("page"), 1, 1, 100000);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 5000);

    const db = await getDatabase();
    await finalizeExpired(db);

    const hasExam = !!examId && examId !== "All Exams";
    const filter: any = { status: "submitted" };
    if (hasExam) filter.examId = examId;
    if (batch && batch !== "All Batches") filter.batch = batch;
    if (studentId) filter.studentId = studentId;
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ studentName: pattern }, { studentId: pattern }, { examTitle: pattern }];
    }

    const sort = Object.fromEntries(
      Object.entries(SORTS[sortKey]).map(([key, direction]) => [key, reversed ? -direction : direction])
    ) as Record<string, 1 | -1>;

    const collection = db.collection("attempts");
    const [results, totals, inProgress, exams, batches] = await Promise.all([
      collection
        .find(filter, {
          projection: {
            id: 1, examId: 1, examTitle: 1, studentId: 1, studentName: 1, batch: 1,
            submittedAt: 1, submitType: 1, result: 1, violationCount: 1, cameraIncidentCount: 1,
          },
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            students: { $addToSet: "$studentId" },
            average: { $avg: "$result.percentage" },
            top: { $max: "$result.percentage" },
            averageScore: { $avg: "$result.score" },
            topScore: { $max: "$result.score" },
            averageTime: { $avg: "$result.timeTakenSeconds" },
            passed: { $sum: { $cond: [{ $gte: ["$result.percentage", PASS_PERCENTAGE] }, 1, 0] } },
          },
        },
      ]).toArray(),
      collection.countDocuments({
        status: "in_progress",
        ...(hasExam ? { examId } : {}),
      }),
      db.collection("exams").find({}, { projection: { id: 1, title: 1, totalMarks: 1, duration: 1, batch: 1, createdAt: 1, created: 1 } }).toArray(),
      db.collection("students").distinct("batch"),
    ]);

    // Rank and percentile always compare against everyone who sat the same exam, whatever the filters show.
    const examIds = [...new Set(results.map((r) => r.examId))];
    const scoreGroups = await collection.aggregate([
      { $match: { status: "submitted", examId: { $in: examIds } } },
      { $group: { _id: "$examId", scores: { $push: "$result.score" } } },
    ]).toArray();
    const scoresByExam = new Map<string, number[]>(scoreGroups.map((g) => [g._id, g.scores]));

    const summary = totals[0];
    const selectedExam = hasExam ? exams.find((e) => e.id === examId) : null;

    // How many of the students assigned to this exam have submitted it.
    let participation: { submitted: number; assigned: number } | null = null;
    if (selectedExam) {
      const assignedFilter: any = { status: "active" };
      if (selectedExam.batch !== "All Batches") assignedFilter.batch = selectedExam.batch;
      if (batch && batch !== "All Batches") assignedFilter.batch = batch;
      participation = {
        submitted: summary?.students.length ?? 0,
        assigned: await db.collection("students").countDocuments(assignedFilter),
      };
    }

    const createdTime = (exam: any) => {
      const parsed = new Date(exam.createdAt ?? exam.created).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return NextResponse.json({
      success: true,
      results: results.map((r) => {
        const scores = scoresByExam.get(r.examId) ?? [];
        const score = r.result?.score ?? 0;
        return {
          ...r,
          rank: scores.filter((s) => s > score).length + 1,
          percentile: percentileOf(score, scores),
          accuracy: accuracyOf(r.result?.correct ?? 0, r.result?.incorrect ?? 0),
        };
      }),
      total: summary?.total ?? 0,
      students: summary?.students.length ?? 0,
      average: summary?.average ?? null,
      top: summary?.top ?? null,
      averageScore: summary?.averageScore ?? null,
      topScore: summary?.topScore ?? null,
      averageTime: summary?.averageTime ?? null,
      passRate: summary ? (summary.passed / summary.total) * 100 : null,
      passPercentage: PASS_PERCENTAGE,
      participation,
      inProgress,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((summary?.total ?? 0) / limit)),
      exams: exams
        .sort((a, b) => createdTime(b) - createdTime(a))
        .map((e) => ({ id: e.id, title: e.title, totalMarks: e.totalMarks, duration: e.duration })),
      batches: ["All Batches", ...batches.filter(Boolean).sort()],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
