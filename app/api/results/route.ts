import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { clampInt, escapeRegex, handleApiError, requireStaff } from "@/lib/api";
import { finalizeExpired } from "@/lib/attempts";

export async function GET(req: Request) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const batch = searchParams.get("batch");
    const studentId = searchParams.get("studentId");
    const q = searchParams.get("q");
    const page = clampInt(searchParams.get("page"), 1, 1, 100000);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 5000);

    const db = await getDatabase();
    await finalizeExpired(db);

    const filter: any = { status: "submitted" };
    if (examId && examId !== "All Exams") filter.examId = examId;
    if (batch && batch !== "All Batches") filter.batch = batch;
    if (studentId) filter.studentId = studentId;
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ studentName: pattern }, { studentId: pattern }, { examTitle: pattern }];
    }

    const collection = db.collection("attempts");
    const [results, totals, inProgress, exams, batches] = await Promise.all([
      collection
        .find(filter, {
          projection: {
            id: 1, examId: 1, examTitle: 1, studentId: 1, studentName: 1, batch: 1,
            submittedAt: 1, submitType: 1, result: 1,
          },
        })
        // Ties go to whoever finished faster.
        .sort({ "result.percentage": -1, "result.timeTakenSeconds": 1, studentId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            average: { $avg: "$result.percentage" },
            top: { $max: "$result.percentage" },
          },
        },
      ]).toArray(),
      collection.countDocuments({
        status: "in_progress",
        ...(examId && examId !== "All Exams" ? { examId } : {}),
      }),
      db.collection("exams").find({}, { projection: { id: 1, title: 1 } }).toArray(),
      db.collection("students").distinct("batch"),
    ]);

    const summary = totals[0];
    return NextResponse.json({
      success: true,
      results: results.map((r, i) => ({ ...r, rank: (page - 1) * limit + i + 1 })),
      total: summary?.total ?? 0,
      average: summary?.average ?? null,
      top: summary?.top ?? null,
      inProgress,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((summary?.total ?? 0) / limit)),
      exams: exams.map((e) => ({ id: e.id, title: e.title })),
      batches: ["All Batches", ...batches.filter(Boolean).sort()],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
