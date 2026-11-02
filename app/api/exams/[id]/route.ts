import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireAdmin, requireStaff, requireUser } from "@/lib/api";
import {
  canStudentSee,
  computeTotalMarks,
  examForStudent,
  examQuery,
  findExam,
  getMarking,
  loadQuestions,
  parseExamFields,
  publishProblems,
} from "@/lib/exams";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam) {
      throw new ApiError(404, "Exam not found");
    }

    // Students get the summary only: questions arrive when they start, and never with answers.
    if (user.role === "student") {
      if (!canStudentSee(exam, user.batch)) {
        throw new ApiError(404, "Exam not found");
      }
      const attempt = await db.collection("attempts").findOne(
        { examId: exam.id, studentId: user.id },
        { projection: { id: 1, status: 1 } }
      );
      return NextResponse.json({
        success: true,
        exam: {
          ...examForStudent(exam),
          attempt: attempt ? { id: attempt.id, status: attempt.status } : null,
        },
      });
    }

    const [questionDocs, attemptCount] = await Promise.all([
      loadQuestions(db, exam.questions ?? []),
      db.collection("attempts").countDocuments({ examId: exam.id }),
    ]);

    return NextResponse.json({
      success: true,
      exam: {
        ...exam,
        _id: exam._id.toString(),
        marking: getMarking(exam),
        attemptCount,
        problems: await publishProblems(db, exam),
        questionDocs,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const body = await readJson(req);
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam) throw new ApiError(404, "Exam not found");

    const updateFields = parseExamFields(body);

    // Once anyone has started, changing the paper or marks would make results unfair between students.
    if (updateFields.questions !== undefined || updateFields.marking !== undefined) {
      const attemptCount = await db.collection("attempts").countDocuments({ examId: exam.id });
      if (attemptCount > 0) {
        throw new ApiError(
          409,
          `${attemptCount} student(s) have already started this exam, so its questions and marking are locked.`,
          "EXAM_LOCKED"
        );
      }
    }

    if (updateFields.questions !== undefined || updateFields.marking !== undefined) {
      updateFields.totalMarks = await computeTotalMarks(
        db,
        updateFields.questions ?? exam.questions ?? [],
        updateFields.marking ?? getMarking(exam)
      );
    }

    if (body.status !== undefined) {
      if (body.status === "published") {
        const problems = await publishProblems(db, { ...exam, ...updateFields });
        if (problems.length > 0) {
          return NextResponse.json(
            { success: false, error: "This exam can't be published yet.", code: "NOT_PUBLISHABLE", problems },
            { status: 409 }
          );
        }
        updateFields.totalMarks ??= await computeTotalMarks(db, exam.questions ?? [], getMarking(exam));
        updateFields.status = "published";
      } else if (body.status === "draft") {
        updateFields.status = "draft";
      } else {
        throw new ApiError(400, "Invalid status.");
      }
    }

    await db.collection("exams").updateOne(examQuery(id), { $set: updateFields });
    const updated = await findExam(db, id);

    return NextResponse.json({
      success: true,
      exam: updated ? { ...updated, _id: updated._id.toString(), marking: getMarking(updated) } : null
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const db = await getDatabase();

    const exam = await findExam(db, id);
    if (!exam) throw new ApiError(404, "Exam not found");

    const attemptCount = await db.collection("attempts").countDocuments({ examId: exam.id });
    if (attemptCount > 0) {
      throw new ApiError(
        409,
        `${attemptCount} student(s) have attempted this exam. Deleting it would orphan their results, so unpublish it instead.`,
        "HAS_ATTEMPTS"
      );
    }

    await db.collection("exams").deleteOne({ _id: exam._id });
    return NextResponse.json({ success: true, message: "Exam deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
