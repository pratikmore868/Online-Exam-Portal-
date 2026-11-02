import "server-only";
import { ObjectId, type Db, type Document } from "mongodb";
import { ApiError } from "./api";
import {
  DEFAULT_MARKING,
  normalizeMarking,
  questionProblem,
  totalMarksFor,
  type Marking,
  type ScorableQuestion,
} from "./scoring";

export type Availability = "draft" | "upcoming" | "open" | "closed";

export function examQuery(id: string): Document {
  if (ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ id }, { _id: new ObjectId(id) }] };
  }
  return { id };
}

export async function findExam(db: Db, id: string) {
  return db.collection("exams").findOne(examQuery(id));
}

// "available" is the status used by exams created before the draft/published workflow.
export const LIVE_STATUSES = ["published", "available"];

export function getMarking(exam: Document): Marking {
  return exam.marking ?? DEFAULT_MARKING;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function examWindow(exam: Document) {
  return { from: toDate(exam.availableFrom), until: toDate(exam.availableUntil) };
}

export function getAvailability(exam: Document, now = new Date()): Availability {
  if (!LIVE_STATUSES.includes(exam.status)) return "draft";
  const { from, until } = examWindow(exam);
  if (from && now < from) return "upcoming";
  if (until && now > until) return "closed";
  return "open";
}

export function canStudentSee(exam: Document, batch?: string) {
  return LIVE_STATUSES.includes(exam.status) && (exam.batch === batch || exam.batch === "All Batches");
}

// A whitelist, so fields added to exams later stay private unless they are listed here.
export function examForStudent(exam: Document) {
  return {
    id: exam.id,
    title: exam.title,
    duration: exam.duration,
    totalMarks: exam.totalMarks,
    totalQuestions: exam.totalQuestions ?? exam.questions?.length ?? 0,
    batch: exam.batch,
    subject: exam.subject,
    difficulty: exam.difficulty,
    description: exam.description,
    availableFrom: exam.availableFrom ?? null,
    availableUntil: exam.availableUntil ?? null,
    marking: getMarking(exam),
    availability: getAvailability(exam),
  };
}

// Also a whitelist: the correct answer and any solution fields must never reach a student's browser.
export function questionForStudent(question: Document) {
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    subject: question.subject,
    type: question.type,
  };
}

export async function loadQuestions(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  const docs = await db.collection("questions").find({ id: { $in: ids } }).toArray();
  const byId = new Map(docs.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
}

export async function publishProblems(db: Db, exam: Document): Promise<string[]> {
  const problems: string[] = [];
  const ids: string[] = exam.questions ?? [];

  if (ids.length === 0) problems.push("The exam has no questions.");
  if (!(Number(exam.duration) > 0)) problems.push("The duration must be greater than zero.");

  const { from, until } = examWindow(exam);
  if (from && until && from >= until) problems.push("The end time must be after the start time.");
  if (until && until <= new Date()) problems.push("The end time is already in the past.");

  const questions = await loadQuestions(db, ids);
  if (questions.length < ids.length) {
    problems.push(`${ids.length - questions.length} question(s) no longer exist in the question bank.`);
  }
  questions.forEach((q, i) => {
    const problem = questionProblem(q as unknown as ScorableQuestion);
    if (problem) problems.push(`Question ${i + 1} ${problem}.`);
  });

  return problems;
}

export async function computeTotalMarks(db: Db, questionIds: string[], marking: Marking) {
  const questions = await loadQuestions(db, questionIds);
  return totalMarksFor(questions as unknown as ScorableQuestion[], marking);
}

// Validates the admin-editable exam fields shared by create and update.
export function parseExamFields(body: Record<string, any>): Document {
  const fields: Document = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new ApiError(400, "Exam title is required.");
    }
    fields.title = body.title.trim();
  }
  if (body.duration !== undefined) {
    const duration = Number(body.duration);
    if (!Number.isInteger(duration) || duration < 1 || duration > 720) {
      throw new ApiError(400, "Duration must be between 1 and 720 minutes.");
    }
    fields.duration = duration;
  }
  if (body.batch !== undefined) fields.batch = String(body.batch);
  if (body.subject !== undefined) fields.subject = String(body.subject);
  if (body.sections !== undefined) fields.sections = body.sections;

  for (const key of ["availableFrom", "availableUntil"]) {
    if (body[key] !== undefined) {
      const date = body[key] ? toDate(body[key]) : null;
      if (body[key] && !date) throw new ApiError(400, `Invalid date for ${key}.`);
      fields[key] = date;
    }
  }
  if (body.marking !== undefined) {
    const marking = normalizeMarking(body.marking);
    if (!marking) throw new ApiError(400, "Invalid marking scheme.");
    fields.marking = marking;
  }
  if (body.questions !== undefined) {
    if (!Array.isArray(body.questions) || !body.questions.every((q) => typeof q === "string")) {
      throw new ApiError(400, "Questions must be a list of question IDs.");
    }
    fields.questions = body.questions;
    fields.totalQuestions = body.questions.length;
  }
  return fields;
}
