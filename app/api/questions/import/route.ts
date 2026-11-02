import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStaff } from "@/lib/api";
import { ImportFileError, MAX_IMPORT_BYTES, parseQuestionDocx, type ParsedQuestion } from "@/lib/docxQuestions";
import { computeTotalMarks, findExam, getMarking } from "@/lib/exams";
import { normalizeSections, placeQuestion, sectionsForEditing } from "@/lib/sections";

// The same question uploaded twice has the same fingerprint, so it isn't stored twice.
function fingerprint(q: ParsedQuestion) {
  const normalize = (value: string) => value.replace(/\[\[img:[^\]]*\]\]/g, "[img]").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256")
    .update(JSON.stringify([q.type, normalize(q.text), q.options.map(normalize)]))
    .digest("hex");
}

// Sends the file twice: first to preview what's in it, then with confirm to save it.
export async function POST(req: Request) {
  try {
    await requireStaff();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) throw new ApiError(400, "Please choose a .docx file.");
    if (!file.name.toLowerCase().endsWith(".docx")) throw new ApiError(400, "Only .docx Word files can be imported.");
    if (file.size > MAX_IMPORT_BYTES) {
      throw new ApiError(400, "This file is over 4 MB. Please split it into smaller files, or use smaller pictures.");
    }

    const confirm = form.get("confirm") === "true";
    const fallbackSubject = String(form.get("defaultSubject") ?? "").trim();
    const examId = String(form.get("examId") ?? "").trim();

    let parsed;
    try {
      parsed = await parseQuestionDocx(Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof ImportFileError) throw new ApiError(400, err.message);
      throw err;
    }
    const { questions, images } = parsed;
    if (questions.length === 0) {
      throw new ApiError(400, "No questions found. Each question must be in its own table, like the sample file.");
    }

    const db = await getDatabase();

    // Subject names must match existing ones exactly, or "physics" would become a second subject.
    const subjects = await db.collection("subjects").find({}, { projection: { id: 1, name: 1 } }).toArray();
    const canonical = (name: string) => subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())?.name ?? name;

    const hashes = questions.map(fingerprint);
    const existing = new Set(
      (await db.collection("questions").distinct("contentHash", { contentHash: { $in: hashes } })) as string[]
    );

    const seen = new Set<string>();
    const rows = questions.map((q, i) => {
      const subject = q.subject ? canonical(q.subject) : fallbackSubject ? canonical(fallbackSubject) : null;
      const errors = [...q.errors];
      if (!subject) errors.push("The Subject row is empty. Fill it in, or choose a subject for blank rows.");
      const duplicate = existing.has(hashes[i]) || seen.has(hashes[i]);
      seen.add(hashes[i]);
      return { ...q, subject, errors, duplicate, hash: hashes[i] };
    });
    const toImport = rows.filter((r) => r.errors.length === 0 && !r.duplicate);

    const summary = {
      total: rows.length,
      valid: toImport.length,
      invalid: rows.filter((r) => r.errors.length > 0).length,
      duplicates: rows.filter((r) => r.errors.length === 0 && r.duplicate).length,
    };

    if (!confirm) {
      return NextResponse.json({
        success: true,
        ...summary,
        rows: rows.map(({ hash: _hash, images: _images, ...row }) => row),
      });
    }

    // Checked before saving, so a locked paper doesn't leave questions half-imported.
    const exam = examId ? await findExam(db, examId) : null;
    if (examId && !exam) throw new ApiError(404, "That exam wasn't found.");
    if (exam && (await db.collection("attempts").countDocuments({ examId: exam.id })) > 0) {
      throw new ApiError(409, "Students have already started that exam, so its questions are locked. Nothing was imported.", "EXAM_LOCKED");
    }

    if (toImport.length === 0) {
      return NextResponse.json({ success: true, ...summary, imported: 0, examTitle: exam?.title ?? null });
    }

    // Only pictures used by questions being saved.
    const imageIds = new Map<string, string>();
    for (const row of toImport) {
      for (const path of row.images) {
        if (!imageIds.has(path)) imageIds.set(path, randomUUID());
      }
    }
    if (imageIds.size > 0) {
      await db.collection("question_images").insertMany(
        [...imageIds].map(([path, id]) => ({
          id,
          contentType: images.get(path)!.contentType,
          data: images.get(path)!.data,
          createdAt: new Date(),
        }))
      );
    }
    const withImages = (value: string) => value.replace(/\[\[img:([^\]]+)\]\]/g, (_m, path) => `[[img:${imageIds.get(path)}]]`);

    const now = new Date();
    const docs = toImport.map((row) => ({
      id: `q-${randomUUID()}`,
      text: withImages(row.text),
      options: row.options.map(withImages),
      ...(row.correctAnswer !== undefined ? { correctAnswer: row.correctAnswer } : {}),
      ...(row.answerRange ? { answerRange: row.answerRange } : {}),
      type: row.type,
      subject: row.subject as string,
      chapter: row.chapters[0] ?? "General",
      chapters: row.chapters,
      difficulty: row.difficulty,
      tags: row.tags,
      pyq: row.pyq,
      solution: withImages(row.solution),
      marks: row.subject === "Mathematics" ? 2 : 1,
      contentHash: row.hash,
      source: "bulk-import",
      createdAt: now,
    }));
    await db.collection("questions").insertMany(docs);

    // New subjects and chapters appear in the Questions tab and the exam editor.
    const today = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    for (const subjectName of new Set(docs.map((d) => d.subject))) {
      const subjectId = subjects.find((s) => s.name === subjectName)?.id ?? subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await db.collection("subjects").updateOne(
        { id: subjectId },
        {
          $setOnInsert: { id: subjectId, name: subjectName, icon: "📚", color: "#287FC1", created: today, chaptersCount: 0, questionsCount: 0 },
          $set: { updated: today },
        },
        { upsert: true }
      );

      const known = new Set(
        (await db.collection("chapters").find({ subjectId }, { projection: { name: 1 } }).toArray()).map((c) => c.name.toLowerCase())
      );
      const wanted = [...new Set(docs.filter((d) => d.subject === subjectName).flatMap((d) => d.chapters))];
      const newNames = wanted.filter((name) => !known.has(name.toLowerCase()));
      if (newNames.length > 0) {
        await db.collection("chapters").insertMany(
          newNames.map((name, i) => ({
            id: `${subjectId}-${randomUUID()}`,
            subjectId,
            name,
            order: known.size + i + 1,
            questionsCount: 0,
            created: today,
            updated: today,
          }))
        );
      }
    }

    if (exam) {
      const questionIds = [...(exam.questions ?? []), ...docs.map((d) => d.id)];
      const current = await db.collection("questions").find({ id: { $in: exam.questions ?? [] } }, { projection: { id: 1, subject: 1 } }).toArray();
      let sections = sectionsForEditing(current as any, exam.sections);
      for (const doc of docs) sections = placeQuestion(sections, doc);
      await db.collection("exams").updateOne(
        { _id: exam._id },
        {
          $set: {
            questions: questionIds,
            totalQuestions: questionIds.length,
            sections: normalizeSections(sections, questionIds),
            totalMarks: await computeTotalMarks(db, questionIds, getMarking(exam)),
          },
        }
      );
    }

    return NextResponse.json({ success: true, ...summary, imported: docs.length, examId: exam?.id ?? null, examTitle: exam?.title ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
