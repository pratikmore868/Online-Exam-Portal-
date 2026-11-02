// Pure scoring logic with no server dependencies, so it can be unit tested directly.

export interface MarkingRule {
  // null means "use each question's own marks", which is how mixed papers such as
  // MHT-CET PCM (Maths 2 marks, Physics and Chemistry 1 mark) are scored.
  correct: number | null;
  wrong: number; // marks deducted, stored as a positive number
}

export interface Marking extends MarkingRule {
  subjects?: Record<string, MarkingRule>;
}

export const DEFAULT_MARKING: Marking = { correct: null, wrong: 0 };

export interface ScorableQuestion {
  id: string;
  subject?: string;
  marks?: number;
  options?: unknown[];
  correctAnswer?: number;
  type?: string;
  answerRange?: { min: number; max: number };
}

// Numeric answers are compared with a small allowance, because 0.1 + 0.2 isn't exactly 0.3 in a computer.
const NUMERIC_TOLERANCE = 1e-9;

export function answerOutcome(question: ScorableQuestion, choice: unknown): "correct" | "incorrect" | "unanswered" {
  if (question.type === "numeric") {
    if (typeof choice !== "number" || !Number.isFinite(choice)) return "unanswered";
    const range = question.answerRange;
    return range && choice >= range.min - NUMERIC_TOLERANCE && choice <= range.max + NUMERIC_TOLERANCE
      ? "correct"
      : "incorrect";
  }
  if (!isValidChoice(choice, question)) return "unanswered";
  return choice === question.correctAnswer ? "correct" : "incorrect";
}

export interface Tally {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
}

export interface AttemptResult extends Tally {
  percentage: number;
  total: number;
  bySubject: Record<string, Tally>;
}

function emptyTally(): Tally {
  return { score: 0, maxScore: 0, correct: 0, incorrect: 0, unanswered: 0 };
}

// Avoids float drift when summing fractional marks such as -0.25.
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function marksFor(question: ScorableQuestion, marking: Marking = DEFAULT_MARKING) {
  const rule = (question.subject && marking.subjects?.[question.subject]) || marking;
  const ownMarks = typeof question.marks === "number" && question.marks > 0 ? question.marks : 1;
  return {
    correct: rule.correct ?? ownMarks,
    wrong: Math.abs(rule.wrong ?? 0),
  };
}

export function totalMarksFor(questions: ScorableQuestion[], marking: Marking = DEFAULT_MARKING) {
  return round2(questions.reduce((sum, q) => sum + marksFor(q, marking).correct, 0));
}

function isValidChoice(choice: unknown, question: ScorableQuestion) {
  return (
    Number.isInteger(choice) &&
    (choice as number) >= 0 &&
    (choice as number) < (question.options?.length ?? 0)
  );
}

export function scoreAttempt(
  questions: ScorableQuestion[],
  answers: Record<string, unknown>,
  marking: Marking = DEFAULT_MARKING
): AttemptResult {
  const overall = emptyTally();
  const bySubject: Record<string, Tally> = {};

  for (const question of questions) {
    const subject = question.subject || "General";
    const tally = (bySubject[subject] ??= emptyTally());
    const { correct, wrong } = marksFor(question, marking);
    const outcome = answerOutcome(question, answers[question.id]);

    for (const t of [overall, tally]) t.maxScore += correct;

    if (outcome === "unanswered") {
      for (const t of [overall, tally]) t.unanswered += 1;
    } else if (outcome === "correct") {
      for (const t of [overall, tally]) {
        t.correct += 1;
        t.score += correct;
      }
    } else {
      for (const t of [overall, tally]) {
        t.incorrect += 1;
        t.score -= wrong;
      }
    }
  }

  for (const t of [overall, ...Object.values(bySubject)]) {
    t.score = round2(t.score);
    t.maxScore = round2(t.maxScore);
  }

  return {
    ...overall,
    // Can be negative under negative marking, as in the real exams.
    percentage: overall.maxScore > 0 ? Math.round((overall.score / overall.maxScore) * 1000) / 10 : 0,
    total: questions.length,
    bySubject,
  };
}

// Short description shown to students and staff, e.g. "+4 / -1".
export function markingLabel(marking: Marking = DEFAULT_MARKING) {
  if (marking.subjects && Object.keys(marking.subjects).length > 0) return "Varies by subject";
  const correct = marking.correct === null ? "Per question" : `+${marking.correct}`;
  return `${correct} / -${marking.wrong ?? 0}`;
}

// A question that can't be marked fairly must not reach students.
export function questionProblem(question: ScorableQuestion): string | null {
  if (question.type === "numeric") {
    const range = question.answerRange;
    return range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max
      ? null
      : "has no valid numeric answer";
  }
  if (!Array.isArray(question.options) || question.options.length < 2) {
    return "needs at least 2 options";
  }
  if (!isValidChoice(question.correctAnswer, question)) {
    return "has no valid correct answer";
  }
  return null;
}

export function normalizeMarking(input: unknown): Marking | null {
  if (!input || typeof input !== "object") return null;

  const parseRule = (raw: any): MarkingRule | null => {
    if (!raw || typeof raw !== "object") return null;
    const correct = raw.correct === null || raw.correct === undefined ? null : Number(raw.correct);
    const wrong = Number(raw.wrong ?? 0);
    if (correct !== null && !(Number.isFinite(correct) && correct > 0 && correct <= 100)) return null;
    if (!(Number.isFinite(wrong) && wrong >= 0 && wrong <= 100)) return null;
    return { correct, wrong };
  };

  const base = parseRule(input);
  if (!base) return null;

  const marking: Marking = { ...base };
  const rawSubjects = (input as any).subjects;
  if (rawSubjects && typeof rawSubjects === "object") {
    const subjects: Record<string, MarkingRule> = {};
    for (const [name, raw] of Object.entries(rawSubjects)) {
      const rule = parseRule(raw);
      if (!rule) return null;
      subjects[name] = rule;
    }
    if (Object.keys(subjects).length > 0) marking.subjects = subjects;
  }
  return marking;
}
