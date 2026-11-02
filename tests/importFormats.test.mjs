import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { parseCsv, parseStudentCsv } from "../lib/studentImport.ts";
import { answerOutcome, questionProblem, scoreAttempt } from "../lib/scoring.ts";

// lib/docxQuestions.ts imports only packages, so it can run directly.
const { ImportFileError, parseNumericAnswer, parseQuestionDocx, questionFingerprint } = await import("../lib/docxQuestions.ts");

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
  assert.match(first.solution, /\[\[img:media\/image1\.jpeg\|\d+\]\]/, "the picture in the solution is kept, with its size");
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

test("every way of writing MCQ means the same thing", async () => {
  for (const type of ["MCQ", "mcq", " Mcq ", "multiple_choice", "Multiple Choice", "multiple-choice", "MULTIPLE_CHOICE", "multichoice", "Single Correct", "objective", "anything else", ""]) {
    const { questions } = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", type), row("Option", "A", "incorrect"), row("Option", "B", "correct"))));
    assert.equal(questions[0].type, "MCQ", `Type "${type}"`);
    assert.deepEqual(questions[0].errors, [], `Type "${type}"`);
    assert.equal(questions[0].correctAnswer, 1, `Type "${type}"`);
  }
});

test("a missing Type row with options is still an MCQ", async () => {
  const { questions } = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Option", "A", "correct"), row("Option", "B", "incorrect"))));
  assert.equal(questions[0].type, "MCQ");
  assert.deepEqual(questions[0].errors, []);
});

test("other types have aliases too", async () => {
  for (const type of ["true_false", "True/False", "True False", "T/F", "boolean"]) {
    const { questions } = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", type), row("Answer", "false"))));
    assert.equal(questions[0].type, "true_false", `Type "${type}"`);
    assert.equal(questions[0].correctAnswer, 1, `Type "${type}"`);
  }
  for (const type of ["numeric", "Numerical", "number", "Integer", "NAT"]) {
    const { questions } = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", type), row("Answer", "5"))));
    assert.equal(questions[0].type, "numeric", `Type "${type}"`);
    assert.deepEqual(questions[0].answerRange, { min: 5, max: 5 }, `Type "${type}"`);
  }
});

test("guessing stops where a wrong guess would matter", async () => {
  // An unknown type with no options can't be marked.
  const unknown = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", "nonsense"))));
  assert.ok(unknown.questions[0].errors.some((e) => /Type must be/.test(e)));
  // Two correct options are refused even when written as an MCQ another way.
  const twoCorrect = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", "multiple_choice"), row("Option", "A", "correct"), row("Option", "B", "correct"))));
  assert.ok(twoCorrect.questions[0].errors.some((e) => /more than one correct/.test(e)));
  // An explicit essay stays refused, even with a stray option row.
  const essay = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", "Essay"), row("Option", "A", "correct"), row("Option", "B", "incorrect"))));
  assert.ok(essay.questions[0].errors.some((e) => /can't be marked automatically/.test(e)));
  // A stated true/false type keeps using its Answer row, even with stray option rows.
  const trueFalse = await parseQuestionDocx(await docx(table(row("Question", "Q"), row("Type", "true_false"), row("Answer", "true"), row("Option", "A", "incorrect"))));
  assert.equal(trueFalse.questions[0].correctAnswer, 0);
});

// A question whose text and options are only pictures, like a paper exported as images.
const PNG = (seed) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(seed)]);
async function pictureDocx(questions) {
  const zip = new JSZip();
  const rels = [];
  let id = 0;
  const picture = (seed) => {
    id += 1;
    rels.push(`<Relationship Id="rId${id}" Target="media/${id}.png"/>`);
    zip.file(`word/media/${id}.png`, PNG(seed));
    return `<w:tc><w:p><w:r><w:drawing><a:blip r:embed="rId${id}"/></w:drawing></w:r></w:p></w:tc>`;
  };
  const tables = questions.map(
    (q) => `<w:tbl><w:tr>${cell("Question")}${picture(q.text)}</w:tr>${row("Type", "multiple_choice")}<w:tr>${cell("Option")}${picture(q.a)}${cell("correct")}</w:tr><w:tr>${cell("Option")}${picture(q.b)}${cell("incorrect")}</w:tr>${q.marks ? row("Marks", q.marks) : ""}</w:tbl>`
  );
  zip.file("word/document.xml", `<w:document ${NS}><w:body>${tables.join("")}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", `<Relationships>${rels.join("")}</Relationships>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
const prints = async (questions) => {
  const { questions: parsed, images } = await parseQuestionDocx(await pictureDocx(questions));
  return parsed.map((q) => questionFingerprint(q, images));
};

test("different picture-only questions aren't duplicates", async () => {
  const [one, two] = await prints([{ text: "q1", a: "a1", b: "b1" }, { text: "q2", a: "a2", b: "b2" }]);
  assert.notEqual(one, two);
});

test("the same picture question is a duplicate, however the file names it", async () => {
  const [one, two] = await prints([{ text: "q", a: "a", b: "b" }, { text: "q", a: "a", b: "b" }]);
  assert.equal(one, two);
});

test("one different option picture makes a different question", async () => {
  const [one, two] = await prints([{ text: "q", a: "a", b: "b" }, { text: "q", a: "a", b: "other" }]);
  assert.notEqual(one, two);
});

test("text questions are still matched ignoring case and spacing", async () => {
  const { questions, images } = await parseQuestionDocx(await docx(
    table(row("Question", "Hello  World"), row("Type", "numeric"), row("Answer", "1")),
    table(row("Question", "hello world"), row("Type", "numeric"), row("Answer", "1"))
  ));
  assert.equal(questionFingerprint(questions[0], images), questionFingerprint(questions[1], images));
});

test("a picture's display size doesn't affect duplicate detection", async () => {
  const q = { type: "MCQ", options: [], text: "[[img:a.png|100]]" };
  const images = new Map([["a.png", { contentType: "image/png", data: Buffer.from("x") }]]);
  assert.equal(questionFingerprint(q, images), questionFingerprint({ ...q, text: "[[img:a.png|300]]" }, images));
  assert.equal(questionFingerprint(q, images), questionFingerprint({ ...q, text: "[[img:a.png]]" }, images));
});

test("the Marks row is read, and a bad one is explained", async () => {
  const good = await parseQuestionDocx(await pictureDocx([{ text: "q", a: "a", b: "b", marks: "2.5" }]));
  assert.equal(good.questions[0].marks, 2.5);
  assert.deepEqual(good.questions[0].errors, []);
  const none = await parseQuestionDocx(await pictureDocx([{ text: "q", a: "a", b: "b" }]));
  assert.equal(none.questions[0].marks, undefined);
  for (const bad of ["two", "0", "-1", "101"]) {
    const { questions } = await parseQuestionDocx(await pictureDocx([{ text: "q", a: "a", b: "b", marks: bad }]));
    assert.ok(questions[0].errors.some((e) => /Marks must be/.test(e)), `Marks "${bad}"`);
  }
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
