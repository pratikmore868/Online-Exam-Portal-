import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { parseCsv, parseStudentCsv } from "../lib/studentImport.ts";
import { answerOutcome, questionProblem, scoreAttempt } from "../lib/scoring.ts";

// lib/docxQuestions.ts imports only packages, so it can run directly.
const { ImportFileError, parseNumericAnswer, parseQuestionDocx } = await import("../lib/docxQuestions.ts");

const NS = `xmlns:w="w" xmlns:m="m" xmlns:r="r" xmlns:a="a"`;
const cell = (text) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
const row = (...cells) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;
const table = (...rows) => `<w:tbl>${rows.join("")}</w:tbl>`;
async function docx(...tables) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<w:document ${NS}><w:body>${tables.join("")}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
const mcq = (extra = []) => table(row("Question", "Q?"), row("Type", "MCQ"), row("Option", "A", "correct"), row("Option", "B", "incorrect"), row("Subject", "Physics"), ...extra);

test("reads every question in the real sample file", async () => {
  const { questions, images } = await parseQuestionDocx(readFileSync("public/samples/BulkImportSample.docx"));
  assert.equal(questions.length, 4);
  assert.deepEqual(questions.map((q) => q.errors), [[], [], [], []]);
  assert.deepEqual(questions.map((q) => q.type), ["MCQ", "true_false", "numeric", "numeric"]);

  const [first, second, third, fourth] = questions;
  assert.equal(first.options.length, 4);
  assert.equal(first.correctAnswer, 0);
  assert.equal(first.difficulty, "Easy");
  assert.equal(first.subject, "Mathematics");
  assert.deepEqual(first.chapters, ["Calculs", "Algebra"]);
  assert.deepEqual(first.tags, ["Tag 1", "Tag2", "Tag 4"]);
  assert.deepEqual(first.pyq, { exam: "Exam Name", year: 2022 });
  assert.match(first.text, /\$[^$]+\$/, "equations in the question become math");
  assert.match(first.options[0], /^\$.+\$$/, "an equation-only option becomes math");
  assert.match(first.options[0], /wedge|vee|sim|rightarrow/);
  assert.match(first.solution, /\[\[img:media\/image1\.jpeg\]\]/, "the picture in the solution is kept");
  assert.equal(images.get("media/image1.jpeg").contentType, "image/jpeg");

  assert.deepEqual(second.options, ["True", "False"]);
  assert.equal(second.correctAnswer, 0);
  assert.equal(second.subject, "General Knowledge");
  assert.equal(second.chapters.length, 0);
  assert.equal(second.pyq, null);

  assert.deepEqual(third.answerRange, { min: 1.2, max: 1.2 });
  assert.equal(third.subject, null, "a blank subject stays blank");
  assert.deepEqual(fourth.answerRange, { min: 1.2, max: 3.4 });
  assert.equal(fourth.difficulty, "Medium", "a missing Difficulty row defaults");
});

test("explains each problem in a question", async () => {
  const cases = [
    [table(row("Question", ""), row("Type", "MCQ"), row("Option", "A", "correct"), row("Option", "B", "incorrect")), /Question row is empty/],
    [table(row("Question", "Q"), row("Type", "MCQ"), row("Option", "A", "correct")), /at least 2/],
    [table(row("Question", "Q"), row("Type", "MCQ"), row("Option", "A", "incorrect"), row("Option", "B", "incorrect")), /Mark one option/],
    [table(row("Question", "Q"), row("Type", "MCQ"), row("Option", "A", "correct"), row("Option", "B", "correct")), /more than one correct/],
    [table(row("Question", "Q"), row("Type", "MCQ"), row("Option", "A", "yes"), row("Option", "B", "incorrect")), /correct or incorrect/],
    [table(row("Question", "Q"), row("Type", "essay")), /can't be marked automatically/],
    [table(row("Question", "Q"), row("Type", "short_answer")), /can't be marked automatically/],
    [table(row("Question", "Q"), row("Type", "nonsense")), /Type must be/],
    [table(row("Question", "Q"), row("Type", "true_false"), row("Answer", "maybe")), /must be "true" or "false"/],
    [table(row("Question", "Q"), row("Type", "numeric"), row("Answer", "abc")), /must be a number/],
    [table(row("Question", "Q"), row("Type", "numeric"), row("Answer", "5-1")), /must be a number/],
    [table(row("Question", "Q"), row("Type", "numeric"), row("Answer", "1"), row("Difficulty", "Tough")), /Difficulty must be/],
  ];
  for (const [xml, pattern] of cases) {
    const { questions } = await parseQuestionDocx(await docx(xml));
    assert.ok(questions[0].errors.some((e) => pattern.test(e)), `${pattern}: ${questions[0].errors}`);
  }
});

test("labels and types ignore case, and a valid question has no errors", async () => {
  const { questions } = await parseQuestionDocx(await docx(table(row("QUESTION", "Q"), row("TYPE", "mcq"), row("OPTION", "A", "CORRECT"), row("option", "B", "Incorrect"))));
  assert.deepEqual(questions[0].errors, []);
  assert.equal(questions[0].correctAnswer, 0);
});

test("a table that isn't a question is ignored", async () => {
  const { questions } = await parseQuestionDocx(await docx(table(row("Note", "ignore me")), mcq()));
  assert.equal(questions.length, 1);
});

test("a literal dollar sign isn't read as math", async () => {
  const { questions } = await parseQuestionDocx(await docx(table(row("Question", "Costs $5 and $6"), row("Type", "numeric"), row("Answer", "1"))));
  assert.equal(questions[0].text, "Costs \\$5 and \\$6");
});

test("rejects files that aren't Word documents or are unsafe", async () => {
  await assert.rejects(parseQuestionDocx(Buffer.from("not a zip")), ImportFileError);
  const noDocument = await new JSZip().file("hello.txt", "hi").generateAsync({ type: "nodebuffer" });
  await assert.rejects(parseQuestionDocx(noDocument), ImportFileError);
  const zip = new JSZip();
  zip.file("word/document.xml", `<!DOCTYPE x [<!ENTITY a "b">]><w:document ${NS}><w:body/></w:document>`);
  await assert.rejects(parseQuestionDocx(await zip.generateAsync({ type: "nodebuffer" })), ImportFileError);
});

test("a picture outside the file is never fetched", async () => {
  const zip = new JSZip();
  const image = `<w:tc><w:p><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p></w:tc>`;
  zip.file("word/document.xml", `<w:document ${NS}><w:body><w:tbl><w:tr>${cell("Question")}${image}</w:tr>${row("Type", "numeric")}${row("Answer", "1")}</w:tbl></w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", `<Relationships><Relationship Id="rId1" Target="http://evil.example/x.png" TargetMode="External"/></Relationships>`);
  const { questions } = await parseQuestionDocx(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(questions[0].images.length, 0);
  assert.doesNotMatch(questions[0].text, /img/);
});

test("numeric answers: single values and ranges", () => {
  assert.deepEqual(parseNumericAnswer("1.2"), { min: 1.2, max: 1.2 });
  assert.deepEqual(parseNumericAnswer("1.2-3.4"), { min: 1.2, max: 3.4 });
  assert.deepEqual(parseNumericAnswer("-5"), { min: -5, max: -5 });
  assert.deepEqual(parseNumericAnswer("-5--2"), { min: -5, max: -2 });
  assert.deepEqual(parseNumericAnswer("1 to 2"), { min: 1, max: 2 });
  assert.equal(parseNumericAnswer("3-1"), null);
  assert.equal(parseNumericAnswer(""), null);
  assert.equal(parseNumericAnswer("1.2.3"), null);
});

test("numeric questions score by range", () => {
  const q = { id: "n", type: "numeric", answerRange: { min: 1.2, max: 3.4 }, marks: 4 };
  assert.equal(answerOutcome(q, 1.2), "correct");
  assert.equal(answerOutcome(q, 3.4), "correct");
  assert.equal(answerOutcome(q, 2), "correct");
  assert.equal(answerOutcome(q, 3.5), "incorrect");
  assert.equal(answerOutcome(q, undefined), "unanswered");
  assert.equal(answerOutcome(q, "2"), "unanswered");
  assert.equal(answerOutcome({ ...q, answerRange: { min: 0.3, max: 0.3 } }, 0.1 + 0.2), "correct");
  assert.equal(scoreAttempt([q], { n: 2 }, { correct: 4, wrong: 1 }).score, 4);
  assert.equal(scoreAttempt([q], { n: 9 }, { correct: 4, wrong: 1 }).score, -1);
  assert.equal(questionProblem(q), null);
  assert.ok(questionProblem({ id: "n", type: "numeric" }));
});

test("true/false stays an ordinary two-option question", () => {
  const q = { id: "t", type: "true_false", options: ["True", "False"], correctAnswer: 1 };
  assert.equal(answerOutcome(q, 1), "correct");
  assert.equal(answerOutcome(q, 0), "incorrect");
  assert.equal(answerOutcome(q, 5), "unanswered");
  assert.equal(questionProblem(q), null);
});

test("the real student sample is accepted", () => {
  const result = parseStudentCsv(readFileSync("public/samples/sample-students.csv", "utf8"));
  assert.ok("rows" in result);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((r) => r.errors), [[], []]);
  assert.equal(result.rows[0].name, "John Doe");
  assert.equal(result.rows[1].phone, "0987654321");
});

test("csv handles quotes, Windows line endings and a byte-order mark", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n'), [["a", "b"], ["x, y", 'he said "hi"']]);
  const result = parseStudentCsv('﻿name,email,phone,dob\r\n"Shah, Amit",,9876543210,\r\n');
  assert.equal(result.rows[0].name, "Shah, Amit");
  assert.deepEqual(result.rows[0].errors, []);
});

test("the header must match the format exactly", () => {
  assert.match(parseStudentCsv("name,phone\nA,1").error, /must be exactly/);
  assert.match(parseStudentCsv("email,name,phone,dob\n").error, /must be exactly/);
  assert.match(parseStudentCsv("").error, /empty/);
  assert.match(parseStudentCsv("name,email,phone,dob\n").error, /no students/);
  assert.ok("rows" in parseStudentCsv("NAME,Email,PHONE,dob\nAmit,,9876543210,\n"));
});

test("each bad row says what's wrong", () => {
  const { rows } = parseStudentCsv(
    ["name,email,phone,dob", ",,9876543210,", "A,bad-email,9876543210,", "B,,12345,", "C,,9876543211,2026-13-40", "D,,9876543212,15/01/2000", "=cmd(),,9876543213,", "E,,9876543214", "F,,9876543215,", "f,,9876543215,"].join("\n")
  );
  const errorsOn = (i) => rows[i].errors.join(" ");
  assert.match(errorsOn(0), /Name is required/);
  assert.match(errorsOn(1), /Email/);
  assert.match(errorsOn(2), /10 digits/);
  assert.match(errorsOn(3), /real date/);
  assert.match(errorsOn(4), /real date/);
  assert.match(errorsOn(5), /can't start/);
  assert.match(errorsOn(6), /columns/);
  assert.equal(errorsOn(7), "");
  assert.match(errorsOn(8), /twice/);
});
