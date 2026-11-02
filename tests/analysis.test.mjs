import { test } from "node:test";
import assert from "node:assert/strict";
import { accuracyOf, analyzeAttempt, percentileOf, sectionNames } from "../lib/analysis.ts";

const opts = ["a", "b", "c", "d"];
const questions = [
  { id: "p1", subject: "Physics", chapter: "Optics", marks: 1, options: opts, correctAnswer: 0 },
  { id: "p2", subject: "Physics", chapter: "Optics", marks: 1, options: opts, correctAnswer: 1 },
  { id: "m1", subject: "Mathematics", chapter: "Limits", type: "Numerical", marks: 2, options: opts, correctAnswer: 2 },
];
const marking = { correct: 4, wrong: 1 };

test("percentile: top scorer is 100, ties count, empty is 0", () => {
  assert.equal(percentileOf(10, [10, 5, 1]), 100);
  assert.equal(percentileOf(5, [10, 5, 5, 1]), 75);
  assert.equal(percentileOf(5, []), 0);
});

test("accuracy ignores unanswered questions and avoids dividing by zero", () => {
  assert.equal(accuracyOf(3, 1), 75);
  assert.equal(accuracyOf(0, 0), 0);
});

test("sections use exam sections, then fall back to Subject-Type", () => {
  const names = sectionNames(questions, [{ name: "Part A", questionIds: ["p1"] }, { name: "Empty", questionIds: [] }]);
  assert.equal(names.get("p1"), "Part A");
  assert.equal(names.get("p2"), "Physics-MCQ");
  assert.equal(names.get("m1"), "Mathematics-Numerical");
});

test("analysis breaks down sections, subjects, percentiles and question rows", () => {
  const attempt = { answers: { p1: 0, p2: 0 }, marking, timeSpent: { p1: 30, p2: 60 } };
  const peer = { answers: { p1: 0, p2: 1, m1: 2 }, marking };
  const a = analyzeAttempt({ questions, attempt, peers: [attempt, peer] });

  const physics = a.subjects.find((s) => s.name === "Physics");
  assert.equal(physics.score, 3);
  assert.equal(physics.maxScore, 8);
  assert.equal(physics.accuracy, 50);
  assert.equal(physics.percentile, 50);

  assert.equal(a.percentile, 50);
  assert.equal(a.sections.length, 2);

  assert.equal(a.questions[0].outcome, "correct");
  assert.equal(a.questions[0].marksAwarded, 4);
  assert.equal(a.questions[1].outcome, "incorrect");
  assert.equal(a.questions[1].marksAwarded, -1);
  assert.equal(a.questions[2].outcome, "unanswered");
  assert.equal(a.questions[2].marksAwarded, 0);
  assert.equal(a.questions[2].choice, null);
});

test("time analysis totals tracked time and ranks slowest first", () => {
  const attempt = { answers: { p1: 0 }, marking, timeSpent: { p1: 30, p2: 60 } };
  const { time } = analyzeAttempt({ questions, attempt, peers: [attempt] });
  assert.equal(time.tracked, true);
  assert.equal(time.totalSeconds, 90);
  assert.equal(time.slowest[0].number, 2);
  assert.equal(time.byOutcome.find((o) => o.outcome === "correct").seconds, 30);
});

test("older attempts without time data are reported as untracked", () => {
  const attempt = { answers: { p1: 0 }, marking };
  const a = analyzeAttempt({ questions, attempt, peers: [attempt] });
  assert.equal(a.time.tracked, false);
  assert.equal(a.questions[0].timeSeconds, null);
});

test("insights are drawn from the data", () => {
  const blank = { answers: {}, marking };
  const low = analyzeAttempt({ questions, attempt: blank, peers: [blank] });
  assert.ok(low.insights.improvements.some((i) => i.includes("3 of 3")));
  assert.equal(low.insights.strengths.filter((s) => s.includes("High accuracy")).length, 0);

  const perfect = { answers: { p1: 0, p2: 1, m1: 2 }, marking };
  const high = analyzeAttempt({ questions, attempt: perfect, peers: [perfect, blank] });
  assert.ok(high.insights.strengths.some((s) => s.includes("High accuracy")));
  assert.equal(high.insights.improvements.length, 0);
});
