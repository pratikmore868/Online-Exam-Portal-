import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, clampInt, escapeRegex, handleApiError, readJson, requireStaff } from "@/lib/api";
import { questionProblem } from "@/lib/scoring";

export async function GET(req: Request) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");
    const difficulty = searchParams.get("difficulty");
    const q = searchParams.get("q");
    const page = clampInt(searchParams.get("page"), 1, 1, 100000);
    const limit = clampInt(searchParams.get("limit"), 20, 1, 200);

    const db = await getDatabase();
    const filter: any = {};

    if (subject && subject !== "All" && subject !== "All Subjects") {
      filter.subject = subject;
    }
    if (chapter && chapter !== "All" && chapter !== "All Chapters") {
      // Imported questions can belong to several chapters.
      filter.$and = [{ $or: [{ chapter }, { chapters: chapter }] }];
    }
    if (difficulty && difficulty !== "All") {
      filter.difficulty = difficulty;
    }
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [
        { text: pattern },
        { chapter: pattern },
        { subject: pattern },
        { options: { $elemMatch: pattern } }
      ];
    }

    const total = await db.collection("questions").countDocuments(filter);
    const questions = await db
      .collection("questions")
      .find(filter)
      // Without a fixed order, pages could repeat or skip questions.
      .sort({ chapter: 1, id: 1 })
      // Numeric, so question 2 comes before question 10.
      .collation({ locale: "en", numericOrdering: true })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Taken from the questions themselves, so the filter never offers a chapter with nothing in it.
    const chapters = subject && subject !== "All" && subject !== "All Subjects"
      ? [
          ...new Set([
            ...(await db.collection("questions").distinct("chapter", { subject })),
            ...(await db.collection("questions").distinct("chapters", { subject })),
          ]),
        ].filter(Boolean).sort()
      : undefined;

    return NextResponse.json({
      success: true,
      questions,
      chapters,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff();

    const body = await readJson(req);
    const { text, options, subject, chapter, difficulty, correctAnswer } = body;
    if (typeof text !== "string" || !text.trim() || !Array.isArray(options) || !subject) {
      throw new ApiError(400, "Text, options, and subject are required");
    }

    const newQ = {
      id: `q-${randomUUID()}`,
      text: text.trim(),
      options,
      correctAnswer,
      subject,
      chapter: chapter || "General",
      difficulty: difficulty || "Medium",
      type: "MCQ",
      tags: ["mht-cet"],
      marks: subject === "Mathematics" ? 2 : 1
    };

    const problem = questionProblem(newQ);
    if (problem) {
      throw new ApiError(400, `This question ${problem}.`);
    }

    const db = await getDatabase();
    await db.collection("questions").insertOne(newQ);
    return NextResponse.json({ success: true, question: newQ });
  } catch (error) {
    return handleApiError(error);
  }
}
