import "server-only";
import { randomUUID } from "node:crypto";
import { MongoServerError, type Db, type Document, type Filter } from "mongodb";
import { ApiError } from "./api";
import { cameraRequiredFor, examWindow, getAvailability, getMarking, loadQuestions, questionForStudent } from "./exams";
import { MAX_WARNINGS } from "./proctoring";
import { scoreAttempt, type ScorableQuestion } from "./scoring";
import { orderedQuestionIds, resolveSections } from "./sections";
import type { SessionUser } from "./session";

// Answers already on their way when the clock hits zero are still accepted for this long.
export const SUBMIT_GRACE_MS = 30_000;

const QUESTION_STATUSES = ["not-visited", "not-answered", "answered", "marked-review", "answered-marked"];

export function isPastDeadline(attempt: Document, now = Date.now()) {
  return new Date(attempt.endsAt).getTime() + SUBMIT_GRACE_MS < now;
}

export async function startAttempt(db: Db, exam: Document, student: SessionUser) {
  const existing = await db.collection("attempts").findOne({ examId: exam.id, studentId: student.id });
  if (existing) return finalizeIfExpired(db, existing);

  const availability = getAvailability(exam);
  if (availability === "upcoming") throw new ApiError(409, "This exam has not started yet.", "NOT_STARTED");
  if (availability === "closed") throw new ApiError(409, "This exam has closed.", "CLOSED");
  if (availability === "draft") throw new ApiError(404, "Exam not found.");

  const questionIds: string[] = exam.questions ?? [];
  const questions = await loadQuestions(db, questionIds);
  if (questions.length === 0 || questions.length < questionIds.length) {
    throw new ApiError(409, "This exam is not ready yet. Please contact your teacher.", "NOT_READY");
  }

  // The paper runs section by section, so Physics questions stay together.
  const sections = resolveSections(questions as any, exam.sections);

  const now = new Date();
  const { until } = examWindow(exam);
  const fullEnd = now.getTime() + Number(exam.duration) * 60_000;

  const attempt = {
    id: randomUUID(),
    examId: exam.id,
    examTitle: exam.title,
    studentId: student.id,
    studentName: student.name,
    batch: student.batch,
    status: "in_progress",
    startedAt: now,
    endsAt: new Date(until ? Math.min(fullEnd, until.getTime()) : fullEnd),
    // Copied now so that editing the exam later cannot change what this student is marked on.
    questionIds: orderedQuestionIds(sections),
    sections,
    cameraRequired: cameraRequiredFor(exam, student.id),
    marking: getMarking(exam),
    answers: {},
    statuses: {},
    currentIndex: 0,
    lastSavedAt: now,
  };

  try {
    await db.collection("attempts").insertOne(attempt);
    return attempt as Document;
  } catch (err) {
    // Two tabs started at once: the unique index let one win, so use that attempt.
    if (err instanceof MongoServerError && err.code === 11000) {
      const winner = await db.collection("attempts").findOne({ examId: exam.id, studentId: student.id });
      if (winner) return winner;
    }
    throw err;
  }
}

// Keeps only answers for this paper, so unexpected keys never reach the database.
export function parseAttemptState(attempt: Document, body: Record<string, any>) {
  const valid = new Set<string>(attempt.questionIds);
  const state: Document = {};

  if (body.answers && typeof body.answers === "object") {
    const answers: Record<string, number> = {};
    for (const [id, value] of Object.entries(body.answers)) {
      if (valid.has(id) && Number.isInteger(value) && (value as number) >= 0 && (value as number) < 26) {
        answers[id] = value as number;
      }
    }
    state.answers = answers;
  }
  if (body.statuses && typeof body.statuses === "object") {
    const statuses: Record<string, string> = {};
    for (const [id, value] of Object.entries(body.statuses)) {
      if (valid.has(id) && QUESTION_STATUSES.includes(value as string)) {
        statuses[id] = value as string;
      }
    }
    state.statuses = statuses;
  }
  if (body.timeSpent && typeof body.timeSpent === "object") {
    const timeSpent: Record<string, number> = {};
    for (const [id, value] of Object.entries(body.timeSpent)) {
      if (valid.has(id) && Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 86400) {
        timeSpent[id] = value as number;
      }
    }
    state.timeSpent = timeSpent;
  }
  if (Number.isInteger(body.currentIndex) && body.currentIndex >= 0 && body.currentIndex < valid.size) {
    state.currentIndex = body.currentIndex;
  }
  return state;
}

export async function saveAttemptState(db: Db, attempt: Document, state: Document) {
  // The filter makes this a no-op if the attempt was submitted or expired since it was read.
  const result = await db.collection("attempts").updateOne(
    {
      id: attempt.id,
      status: "in_progress",
      endsAt: { $gte: new Date(Date.now() - SUBMIT_GRACE_MS) },
    },
    { $set: { ...state, lastSavedAt: new Date() } }
  );
  return result.matchedCount === 1;
}

// Records one time away from the exam, and submits the exam on the final warning. The event ID
// comes from the browser, so a retried request can't use up two of the student's warnings.
export async function recordViolation(
  db: Db,
  attempt: Document,
  eventId: string,
  type: string,
  state: Document
) {
  const current = await finalizeIfExpired(db, attempt);
  if (current.status !== "in_progress") return current;

  const updated = await db.collection("attempts").findOneAndUpdate(
    { id: attempt.id, status: "in_progress", "violations.eventId": { $ne: eventId } },
    {
      $inc: { violationCount: 1 },
      $push: { violations: { eventId, type, leftAt: new Date() } } as any,
      $set: { ...state, lastSavedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  const latest = updated ?? (await db.collection("attempts").findOne({ id: attempt.id }));
  if (!latest) return current;

  if (latest.status === "in_progress" && (latest.violationCount ?? 0) >= MAX_WARNINGS) {
    return (await finalizeAttempt(db, latest, "violations")) ?? latest;
  }
  return latest;
}

export async function recordViolationReturn(db: Db, attemptId: string, eventId: string) {
  await db.collection("attempts").updateOne(
    { id: attemptId, violations: { $elemMatch: { eventId, returnedAt: { $exists: false } } } },
    { $set: { "violations.$.returnedAt": new Date() } }
  );
}

export async function finalizeAttempt(db: Db, attempt: Document, submitType: "manual" | "time_up" | "violations") {
  const questions = await loadQuestions(db, attempt.questionIds);
  const result = scoreAttempt(
    questions as unknown as ScorableQuestion[],
    attempt.answers ?? {},
    attempt.marking
  );

  // An attempt left past its deadline is recorded as ending at the deadline, not whenever it was noticed.
  const now = new Date();
  const endsAt = new Date(attempt.endsAt);
  const submittedAt = now < endsAt ? now : endsAt;
  const timeTakenSeconds = Math.max(
    0,
    Math.round((submittedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000)
  );

  const updated = await db.collection("attempts").findOneAndUpdate(
    { id: attempt.id, status: "in_progress" },
    { $set: { status: "submitted", submittedAt, submitType, result: { ...result, timeTakenSeconds } } },
    { returnDocument: "after" }
  );
  // If null, another request finalized it first, so its result stands.
  return updated ?? (await db.collection("attempts").findOne({ id: attempt.id }));
}

export async function finalizeIfExpired(db: Db, attempt: Document) {
  if (attempt.status === "in_progress" && isPastDeadline(attempt)) {
    return (await finalizeAttempt(db, attempt, "time_up")) ?? attempt;
  }
  return attempt;
}

// Students who close the browser never submit, so anything that reads results scores overdue attempts first.
export async function finalizeExpired(db: Db, filter: Filter<Document> = {}) {
  const overdue = await db
    .collection("attempts")
    .find({
      ...filter,
      status: "in_progress",
      endsAt: { $lt: new Date(Date.now() - SUBMIT_GRACE_MS) },
    })
    .limit(1000)
    .toArray();
  await Promise.all(overdue.map((attempt) => finalizeAttempt(db, attempt, "time_up")));
}

export async function attemptInProgressView(db: Db, attempt: Document) {
  const questions = await loadQuestions(db, attempt.questionIds);
  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    batch: attempt.batch,
    status: attempt.status,
    endsAt: attempt.endsAt,
    serverNow: new Date(),
    answers: attempt.answers ?? {},
    statuses: attempt.statuses ?? {},
    timeSpent: attempt.timeSpent ?? {},
    violationCount: attempt.violationCount ?? 0,
    cameraRequired: !!attempt.cameraRequired,
    currentIndex: attempt.currentIndex ?? 0,
    // Attempts started before sections existed group by subject without changing their question order.
    sections: attempt.sections ?? resolveSections(questions as any),
    questions: questions.map(questionForStudent),
  };
}

export async function attemptResultView(db: Db, attempt: Document) {
  const [higher, participants] = await Promise.all([
    db.collection("attempts").countDocuments({
      examId: attempt.examId,
      status: "submitted",
      "result.score": { $gt: attempt.result?.score ?? 0 },
    }),
    db.collection("attempts").countDocuments({ examId: attempt.examId, status: "submitted" }),
  ]);
  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    batch: attempt.batch,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    submitType: attempt.submitType,
    violationCount: attempt.violationCount ?? 0,
    marking: attempt.marking,
    result: attempt.result,
    rank: higher + 1,
    participants,
  };
}

export async function attemptForOwner(db: Db, id: string, user: SessionUser) {
  const attempt = await db.collection("attempts").findOne({ id });
  // A 404 rather than 403, so students can't probe which attempt IDs exist.
  if (!attempt || attempt.studentId !== user.id) {
    throw new ApiError(404, "Attempt not found.");
  }
  return attempt;
}
