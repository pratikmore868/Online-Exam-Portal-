import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSections,
  orderedQuestionIds,
  placeQuestion,
  removeQuestion,
  resolveSections,
  sectionsForEditing,
} from "../lib/sections.ts";

const p1 = { id: "p1", subject: "Physics" };
const c1 = { id: "c1", subject: "Chemistry" };
const p2 = { id: "p2", subject: "Physics" };
const m1 = { id: "m1", subject: "Mathematics" };

test("with no sections, questions group by subject in first-seen order", () => {
  assert.deepEqual(resolveSections([p1, c1, p2, m1]), [
    { name: "Physics", questionIds: ["p1", "p2"] },
    { name: "Chemistry", questionIds: ["c1"] },
    { name: "Mathematics", questionIds: ["m1"] },
  ]);
});

test("an old empty default section doesn't hide subject grouping", () => {
  const names = resolveSections([p1, c1], [{ name: "Section A", questionIds: [] }]).map((s) => s.name);
  assert.deepEqual(names, ["Physics", "Chemistry"]);
});

test("staff sections win, and unplaced questions join by subject", () => {
  const sections = [{ name: "Part A", questionIds: ["c1", "p1"] }, { name: "physics", questionIds: ["p2"] }];
  assert.deepEqual(resolveSections([p1, c1, p2, m1], sections), [
    { name: "Part A", questionIds: ["c1", "p1"] },
    { name: "physics", questionIds: ["p2"] },
    { name: "Mathematics", questionIds: ["m1"] },
  ]);
});

test("unplaced questions join an existing section with their subject's name", () => {
  const out = resolveSections([p1, p2], [{ name: "PHYSICS", questionIds: ["p1"] }]);
  assert.deepEqual(out, [{ name: "PHYSICS", questionIds: ["p1", "p2"] }]);
});

test("removed questions and duplicates are ignored, so every question appears once", () => {
  const out = resolveSections([p1, c1], [
    { name: "A", questionIds: ["p1", "gone", "p1"] },
    { name: "B", questionIds: ["p1", "c1"] },
  ]);
  assert.deepEqual(out, [{ name: "A", questionIds: ["p1"] }, { name: "B", questionIds: ["c1"] }]);
  assert.deepEqual(orderedQuestionIds(out), ["p1", "c1"]);
});

test("editor keeps a new empty section, students don't see it", () => {
  const sections = [{ name: "Physics", questionIds: ["p1"] }, { name: "Bonus", questionIds: [] }];
  assert.deepEqual(sectionsForEditing([p1], sections).map((s) => s.name), ["Physics", "Bonus"]);
  assert.deepEqual(resolveSections([p1], sections).map((s) => s.name), ["Physics"]);
});

test("placing goes to the subject by default and creates the section", () => {
  const out = placeQuestion([{ name: "Physics", questionIds: ["p1"] }], c1);
  assert.deepEqual(out, [{ name: "Physics", questionIds: ["p1"] }, { name: "Chemistry", questionIds: ["c1"] }]);
});

test("placing into a chosen section moves it there, with no duplicate", () => {
  const start = [{ name: "Physics", questionIds: ["p1"] }, { name: "Bonus", questionIds: [] }];
  const out = placeQuestion(start, p1, "Bonus");
  assert.deepEqual(out, [{ name: "Physics", questionIds: [] }, { name: "Bonus", questionIds: ["p1"] }]);
});

test("removing takes the question out of every section", () => {
  const out = removeQuestion([{ name: "A", questionIds: ["p1", "c1"] }], "p1");
  assert.deepEqual(out, [{ name: "A", questionIds: ["c1"] }]);
});

test("normalize trims, merges duplicate names and drops unknown questions", () => {
  const out = normalizeSections(
    [
      { name: " Physics ", questionIds: ["p1", "gone"] },
      { name: "physics", questionIds: ["p2", "p1"] },
      { name: "   ", questionIds: ["c1"] },
    ],
    ["p1", "p2", "c1"]
  );
  assert.deepEqual(out, [{ name: "Physics", questionIds: ["p1", "p2"] }]);
});
