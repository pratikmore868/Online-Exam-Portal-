import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { handleApiError, requireStaff } from "@/lib/api";
import { finalizeExpired } from "@/lib/attempts";

export async function GET() {
  try {
    await requireStaff();
    const db = await getDatabase();
    await finalizeExpired(db);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Real student counts
    const totalStudents = await db.collection("students").countDocuments({});
    const activeStudents = await db.collection("students").countDocuments({ status: "active" });
    const newThisWeek = await db.collection("students").countDocuments({ createdAt: { $gte: weekAgo } });

    // Real questions count from MongoDB Atlas
    const totalQuestions = await db.collection("questions").countDocuments({});

    // Real breakdown by difficulty
    const easyCount = await db.collection("questions").countDocuments({ difficulty: "Easy" });
    const mediumCount = await db.collection("questions").countDocuments({ difficulty: "Medium" });
    const hardCount = await db.collection("questions").countDocuments({ difficulty: "Hard" });

    // Real breakdown by subject
    const subjectCounts = await db.collection("questions").aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 } } }
    ]).toArray();

    const bySubject: Record<string, number> = {
      Chemistry: 0,
      Physics: 0,
      Biology: 0,
      Mathematics: 0,
      Foundation: 0
    };

    subjectCounts.forEach((c) => {
      if (c._id) {
        bySubject[c._id] = c.count;
      }
    });

    // Real attempt figures
    const attempts = db.collection("attempts");
    const recentActivity = await attempts.countDocuments({ startedAt: { $gte: weekAgo } });
    const totalAttempts = await attempts.countDocuments({});
    const submittedAttempts = await attempts.countDocuments({ status: "submitted" });
    const [overall] = await attempts.aggregate([
      { $match: { status: "submitted" } },
      { $group: { _id: null, average: { $avg: "$result.percentage" } } }
    ]).toArray();
    const average = overall?.average ?? 0;

    const perExam = await attempts.aggregate([
      {
        $group: {
          _id: "$examId",
          attempts: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          avgScore: { $avg: "$result.percentage" },
        }
      }
    ]).toArray();
    const statsByExam = new Map(perExam.map((s) => [s._id, s]));

    const createdTime = (exam: any) => {
      const parsed = new Date(exam.createdAt ?? exam.created).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    // Real active exams from Atlas
    const exams = await db.collection("exams").find({}, { projection: { questions: 0, sections: 0 } }).toArray();
    const recentExams = exams
      .sort((a, b) => createdTime(b) - createdTime(a))
      .map((exam) => {
        const s = statsByExam.get(exam.id);
        return {
          ...exam,
          attempts: s?.attempts ?? 0,
          avgScore: s?.avgScore ?? 0,
          completion: s ? (s.submitted / s.attempts) * 100 : 0,
        };
      });

    // Best and worst average per student, shown as Top Performers and Needs Attention
    const perStudent = await attempts.aggregate([
      { $match: { status: "submitted" } },
      {
        $group: {
          _id: "$studentId",
          name: { $last: "$studentName" },
          batch: { $last: "$batch" },
          average: { $avg: "$result.percentage" },
          exams: { $sum: 1 },
        }
      },
      { $sort: { average: -1, _id: 1 } }
    ]).toArray();
    const toRow = (s: any) => ({ id: s._id, name: s.name, batch: s.batch, average: s.average, exams: s.exams });
    const topPerformers = perStudent.slice(0, 5).map(toRow);
    const needsAttention = perStudent.length > 5
      ? perStudent.slice(-Math.min(5, perStudent.length - 5)).reverse().map(toRow)
      : [];

    // Subjects list
    const subjects = await db.collection("subjects").find({}).toArray();

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents,
        activeStudents,
        newThisWeek,
        avgPerformance: average,
        recentActivity,
        completionRate: totalAttempts > 0 ? (submittedAttempts / totalAttempts) * 100 : 0,
        classAverage: average,
        topPerformers,
        needsAttention,
        recentExams,
        subjects,
        questionBank: {
          total: totalQuestions,
          easy: easyCount,
          medium: mediumCount,
          hard: hardCount,
          bySubject
        }
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
