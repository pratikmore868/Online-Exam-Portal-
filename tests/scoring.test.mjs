import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreAttempt,
  totalMarksFor,
  questionProblem,
  normalizeMarking,
} from "../lib/scoring.ts";

const opts = ["a", "b", "c", "d"];
const physics = { id: "p1", subject: "Physics", marks: 1, options: opts, correctAnswer: 0 };
const chem = { id: "c1", subject: "Chemistry", marks: 1, options: opts, correctAnswer: 1 };
const maths = { id: "m1", subject: "Mathematics", marks: 2, options: opts, correctAnswer: 2 };

test("default marking uses each question's own marks (MHT-CET PCM)", () => {
  const r = scoreAttempt([physics, chem, maths], { p1: 0, c1: 1, m1: 2 });
  assert.equal(r.score, 4);
  assert.equal(r.maxScore, 4);
  assert.equal(r.percentage, 100);
});

test("+4/-1 marking applies negatives and can go below zero", () => {
  const marking = { correct: 4, wrong: 1 };
  const r = scoreAttempt([physics, chem, maths], { p1: 1, c1: 0 }, marking);
  assert.equal(r.score, -2);
  assert.equal(r.incorrect, 2);
  assert.equal(r.unanswered, 1);
  assert.equal(r.maxScore, 12);
  assert.equal(r.percentage, -16.7);
});

test("subject override beats the exam-wide rule", () => {
  const marking = { correct: 1, wrong: 0, subjects: { Mathematics: { correct: 2, wrong: 0.5 } } };
  const r = scoreAttempt([physics, maths], { p1: 0, m1: 0 }, marking);
  assert.equal(r.score, 0.5);
  assert.equal(r.maxScore, 3);
  assert.deepEqual(r.bySubject.Mathematics, { score: -0.5, maxScore: 2, correct: 0, incorrect: 1, unanswered: 0 });
  assert.equal(r.bySubject.Physics.correct, 1);
});

test("fractional negatives do not drift", () => {
  const qs = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, options: opts, correctAnswer: 0 }));
  const r = scoreAttempt(qs, { q0: 1, q1: 1, q2: 1 }, { correct: 1, wrong: 0.1 });
  assert.equal(r.score, -0.3);
});

test("out-of-range, non-integer and foreign answers count as unanswered, not wrong", () => {
  const marking = { correct: 4, wrong: 1 };
  for (const bad of [9, -1, 1.5, "0", null, undefined]) {
    const r = scoreAttempt([physics], { p1: bad }, marking);
    assert.equal(r.unanswered, 1, `value ${bad}`);
    assert.equal(r.score, 0, `value ${bad}`);
  }
  const r = scoreAttempt([physics], { other: 0 }, marking);
  assert.equal(r.unanswered, 1);
});

test("an empty paper scores zero without dividing by zero", () => {
  const r = scoreAttempt([], {});
  assert.equal(r.percentage, 0);
  assert.equal(r.total, 0);
});

test("question without marks defaults to one", () => {
  assert.equal(totalMarksFor([{ id: "x", options: opts, correctAnswer: 0 }]), 1);
});

test("questionProblem rejects questions that cannot be marked", () => {
  assert.equal(questionProblem(physics), null);
  assert.ok(questionProblem({ id: "x", options: ["only"], correctAnswer: 0 }));
  assert.ok(questionProblem({ id: "x", options: opts }));
  assert.ok(questionProblem({ id: "x", options: opts, correctAnswer: 4 }));
});

test("normalizeMarking accepts valid rules and rejects bad ones", () => {
  assert.deepEqual(normalizeMarking({ correct: 4, wrong: 1 }), { correct: 4, wrong: 1 });
  assert.deepEqual(normalizeMarking({ correct: null, wrong: 0 }), { correct: null, wrong: 0 });
  assert.equal(normalizeMarking({ correct: 0, wrong: 0 }), null);
  assert.equal(normalizeMarking({ correct: 4, wrong: -1 }), null);
  assert.equal(normalizeMarking({ correct: "x", wrong: 0 }), null);
  assert.equal(normalizeMarking("nope"), null);
  assert.deepEqual(
    normalizeMarking({ correct: 1, wrong: 0, subjects: { Mathematics: { correct: 2, wrong: 0 } } }).subjects,
    { Mathematics: { correct: 2, wrong: 0 } }
  );
});
