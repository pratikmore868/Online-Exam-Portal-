// Pure result analysis with no server dependencies, so it can be unit tested directly.
import { answerOutcome, marksFor, scoreAttempt, type Marking, type ScorableQuestion } from "./scoring.ts";

export interface AnalysisQuestion extends ScorableQuestion {
  text?: string;
  chapter?: string;
  difficulty?: string;
  type?: string;
  explanation?: string;
  solution?: string;
}

export interface AttemptInput {
  answers?: Record<string, unknown>;
  marking?: Marking;
  timeSpent?: Record<string, number>;
}

export interface GroupRow {
  name: string;
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracy: number;
  percentile: number;
}

export type Outcome = "correct" | "incorrect" | "unanswered";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

// Share of candidates scoring the same or lower, so the top scorer is always 100.
export function percentileOf(score: number, allScores: number[]) {
  if (allScores.length === 0) return 0;
  return round1((allScores.filter((s) => s <= score).length / allScores.length) * 100);
}

// Correct out of the questions actually answered.
export function accuracyOf(correct: number, incorrect: number) {
  return correct + incorrect > 0 ? round1((correct / (correct + incorrect)) * 100) : 0;
}

// Uses the exam's own sections, and "Subject-Type" for any question not assigned to one.
export function sectionNames(
  questions: AnalysisQuestion[],
  sections: { name: string; questionIds?: string[] }[] = []
) {
  const assigned = new Map<string, string>();
  for (const section of sections) {
    for (const id of section.questionIds ?? []) {
      if (!assigned.has(id)) assigned.set(id, section.name);
    }
  }
  return new Map(
    questions.map((q) => [q.id, assigned.get(q.id) ?? `${q.subject || "General"}-${q.type || "MCQ"}`])
  );
}

function buildGroups(
  questions: AnalysisQuestion[],
  groupOf: (q: AnalysisQuestion) => string,
  attempt: AttemptInput,
  peers: AttemptInput[]
): GroupRow[] {
  const groups = new Map<string, AnalysisQuestion[]>();
  for (const q of questions) {
    const name = groupOf(q);
    groups.set(name, [...(groups.get(name) ?? []), q]);
  }

  return [...groups.entries()].map(([name, groupQuestions]) => {
    const own = scoreAttempt(groupQuestions, attempt.answers ?? {}, attempt.marking);
    const peerScores = peers.map((p) => scoreAttempt(groupQuestions, p.answers ?? {}, p.marking).score);
    return {
      name,
      score: own.score,
      maxScore: own.maxScore,
      correct: own.correct,
      incorrect: own.incorrect,
      unanswered: own.unanswered,
      total: own.total,
      accuracy: accuracyOf(own.correct, own.incorrect),
      percentile: percentileOf(own.score, peerScores),
    };
  });
}

function buildInsights(
  overall: { correct: number; incorrect: number; unanswered: number; total: number; percentile: number },
  subjects: GroupRow[],
  chapters: GroupRow[],
  usedSeconds: number,
  allowedSeconds: number
) {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const recommendations: string[] = [];

  const accuracy = accuracyOf(overall.correct, overall.incorrect);
  const attemptedShare = overall.total > 0 ? (overall.correct + overall.incorrect) / overall.total : 0;
  const ranked = [...subjects].filter((s) => s.correct + s.incorrect > 0).sort((a, b) => b.accuracy - a.accuracy);

  if (accuracy >= 80) strengths.push(`High accuracy: ${accuracy}% of answered questions were correct`);
  if (attemptedShare >= 0.9 && overall.total > 0) strengths.push("Attempted almost every question");
  if (overall.percentile >= 90) strengths.push(`Top performer: ${overall.percentile} percentile in this exam`);
  if (ranked.length > 1 && ranked[0].accuracy >= 60) {
    strengths.push(`Strongest subject: ${ranked[0].name} (${ranked[0].accuracy}% accuracy)`);
  }

  if (overall.unanswered > 0 && attemptedShare < 0.9) {
    improvements.push(`Attempt more questions: ${overall.unanswered} of ${overall.total} were left blank`);
  }
  if (overall.correct + overall.incorrect > 0 && accuracy < 60) {
    improvements.push(`Improve accuracy: only ${accuracy}% of answered questions were correct`);
  }
  if (ranked.length > 1 && ranked.at(-1)!.accuracy < 70) {
    improvements.push(`Weakest subject: ${ranked.at(-1)!.name} (${ranked.at(-1)!.accuracy}% accuracy)`);
  }
  if (allowedSeconds > 0 && usedSeconds < allowedSeconds * 0.5 && overall.unanswered > 0) {
    improvements.push("Finished early with questions left blank: use the remaining time");
  }

  const weakChapters = chapters
    .filter((c) => c.incorrect + c.unanswered > 0 && c.correct / Math.max(1, c.total) < 0.5)
    .sort((a, b) => b.incorrect + b.unanswered - (a.incorrect + a.unanswered))
    .slice(0, 3);
  if (weakChapters.length > 0) {
    recommendations.push(`Revise these chapters: ${weakChapters.map((c) => c.name).join(", ")}.`);
  }
  if (overall.incorrect > overall.correct) {
    recommendations.push("More wrong answers than right: practise careful reading before answering.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Keep up the current approach and move on to harder practice sets.");
  }

  return { strengths, improvements, recommendations };
}

export function analyzeAttempt(input: {
  questions: AnalysisQuestion[];
  attempt: AttemptInput;
  peers: AttemptInput[];
  sections?: { name: string; questionIds?: string[] }[];
  usedSeconds?: number;
  allowedSeconds?: number;
}) {
  const { questions, attempt, peers, sections, usedSeconds = 0, allowedSeconds = 0 } = input;
  const sectionOf = sectionNames(questions, sections);
  const timeSpent = attempt.timeSpent ?? {};
  const timeTracked = Object.keys(timeSpent).length > 0;

  const sectionRows = buildGroups(questions, (q) => sectionOf.get(q.id)!, attempt, peers);
  const subjectRows = buildGroups(questions, (q) => q.subject || "General", attempt, peers);
  const chapterRows = buildGroups(questions, (q) => q.chapter || "General", attempt, peers);

  const questionRows = questions.map((q, i) => {
    const choice = attempt.answers?.[q.id];
    const outcome = answerOutcome(q, choice);
    const marks = marksFor(q, attempt.marking);
    return {
      id: q.id,
      number: i + 1,
      text: q.text ?? "",
      options: (q.options ?? []) as string[],
      subject: q.subject || "General",
      chapter: q.chapter || "General",
      difficulty: q.difficulty,
      section: sectionOf.get(q.id)!,
      choice: outcome === "unanswered" ? null : (choice as number),
      correctAnswer: q.correctAnswer ?? null,
      type: q.type ?? "MCQ",
      answerRange: q.answerRange ?? null,
      outcome,
      marksAwarded: outcome === "correct" ? marks.correct : outcome === "incorrect" ? -marks.wrong : 0,
      marksPossible: marks.correct,
      timeSeconds: timeTracked ? (timeSpent[q.id] ?? 0) : null,
      explanation: q.explanation ?? q.solution ?? null,
    };
  });

  const sumTime = (rows: typeof questionRows) => rows.reduce((sum, r) => sum + (r.timeSeconds ?? 0), 0);
  const time = timeTracked
    ? {
        tracked: true,
        totalSeconds: sumTime(questionRows),
        byOutcome: (["correct", "incorrect", "unanswered"] as Outcome[]).map((outcome) => {
          const rows = questionRows.filter((r) => r.outcome === outcome);
          return {
            outcome,
            questions: rows.length,
            seconds: sumTime(rows),
            average: rows.length > 0 ? Math.round(sumTime(rows) / rows.length) : 0,
          };
        }),
        bySubject: subjectRows.map((s) => {
          const rows = questionRows.filter((r) => r.subject === s.name);
          return {
            name: s.name,
            questions: rows.length,
            seconds: sumTime(rows),
            average: rows.length > 0 ? Math.round(sumTime(rows) / rows.length) : 0,
          };
        }),
        slowest: [...questionRows]
          .sort((a, b) => (b.timeSeconds ?? 0) - (a.timeSeconds ?? 0))
          .slice(0, 10)
          .map((r) => ({
            number: r.number,
            subject: r.subject,
            chapter: r.chapter,
            outcome: r.outcome,
            seconds: r.timeSeconds ?? 0,
          })),
      }
    : { tracked: false };

  const overallOwn = scoreAttempt(questions, attempt.answers ?? {}, attempt.marking);
  const overallPeers = peers.map((p) => scoreAttempt(questions, p.answers ?? {}, p.marking).score);
  const percentile = percentileOf(overallOwn.score, overallPeers);

  return {
    percentile,
    accuracy: accuracyOf(overallOwn.correct, overallOwn.incorrect),
    sections: sectionRows,
    subjects: subjectRows,
    questions: questionRows,
    time,
    insights: buildInsights({ ...overallOwn, percentile }, subjectRows, chapterRows, usedSeconds, allowedSeconds),
  };
}
