// Reads the question bank Word format: one table per question (see public/samples/BulkImportSample.docx).
// Uploaded files are untrusted, so sizes are limited before anything is unpacked.
import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const MAX_QUESTIONS_PER_FILE = 1000;
const MAX_XML_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;

export interface ParsedQuestion {
  table: number;
  text: string;
  type: "MCQ" | "true_false" | "numeric";
  difficulty: string;
  options: string[];
  correctAnswer?: number;
  answerRange?: { min: number; max: number };
  solution: string;
  subject: string | null;
  chapters: string[];
  tags: string[];
  pyq: { exam: string; year?: number } | null;
  marks?: number;
  images: string[];
  errors: string[];
}

export interface ParsedImage {
  contentType: string;
  data: Buffer;
}

const DIFFICULTIES: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

const SYMBOLS: Record<string, string> = {
  "→": "\\rightarrow ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ",
  "∧": "\\wedge ", "⋀": "\\wedge ", "∨": "\\vee ", "⋁": "\\vee ", "¬": "\\neg ", "∼": "\\sim ", "~": "\\sim ", "≠": "\\neq ", "≤": "\\leq ", "≥": "\\geq ",
  "≈": "\\approx ", "×": "\\times ", "÷": "\\div ", "·": "\\cdot ", "±": "\\pm ", "∓": "\\mp ", "∞": "\\infty ",
  "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ", "⊆": "\\subseteq ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ",
  "∀": "\\forall ", "∃": "\\exists ", "∴": "\\therefore ", "∵": "\\because ", "∠": "\\angle ", "°": "^{\\circ}", "′": "'",
  "∂": "\\partial ", "∇": "\\nabla ", "−": "-",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\epsilon ", "θ": "\\theta ", "λ": "\\lambda ",
  "μ": "\\mu ", "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ", "φ": "\\phi ", "ω": "\\omega ",
  "Δ": "\\Delta ", "Σ": "\\Sigma ", "Ω": "\\Omega ", "Π": "\\Pi ",
  "#": "\\#", "%": "\\%", "&": "\\&", "_": "\\_", "$": "\\$", "{": "\\{", "}": "\\}", "\\": "\\backslash ", "^": "\\hat{}",
};

const ACCENTS: Record<string, string> = {
  "̂": "\\hat", "^": "\\hat", "̄": "\\bar", "̅": "\\overline", "⃗": "\\vec", "→": "\\vec",
  "̃": "\\tilde", "~": "\\tilde", "̇": "\\dot", "̈": "\\ddot",
};

const NARY: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap" };

const childElements = (node: any): any[] => {
  const out: any[] = [];
  for (let c = node?.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c);
  return out;
};
const child = (node: any, name: string) => childElements(node).find((c) => c.nodeName === name);
const prop = (node: any, prName: string, name: string) => child(child(node, prName), name)?.getAttribute("m:val") ?? null;
const textOf = (node: any) => node?.textContent ?? "";

function mathOf(node: any): string {
  if (!node) return "";
  return childElements(node).map(omml).join("");
}

function delimiter(ch: string | null, fallback: string) {
  const c = ch ?? fallback;
  if (c === "") return ".";
  if (c === "{") return "\\{";
  if (c === "}") return "\\}";
  if (c === "|") return "|";
  if (c === "‖") return "\\|";
  if (c === "⌈") return "\\lceil ";
  if (c === "⌉") return "\\rceil ";
  if (c === "⌊") return "\\lfloor ";
  if (c === "⌋") return "\\rfloor ";
  if (c === "〈" || c === "⟨") return "\\langle ";
  if (c === "〉" || c === "⟩") return "\\rangle ";
  return c;
}

// Converts Word's equation format (OMML) to LaTeX, which the exam screens render with KaTeX.
function omml(node: any): string {
  const part = (name: string) => mathOf(child(node, name));
  switch (node.nodeName) {
    case "m:t":
      return [...textOf(node)].map((c) => SYMBOLS[c] ?? c).join("");
    case "m:sSup":
      return `{${part("m:e")}}^{${part("m:sup")}}`;
    case "m:sSub":
      return `{${part("m:e")}}_{${part("m:sub")}}`;
    case "m:sSubSup":
      return `{${part("m:e")}}_{${part("m:sub")}}^{${part("m:sup")}}`;
    case "m:sPre":
      return `{}_{${part("m:sub")}}^{${part("m:sup")}}{${part("m:e")}}`;
    case "m:f":
      return `\\frac{${part("m:num")}}{${part("m:den")}}`;
    case "m:rad": {
      const degree = part("m:deg");
      return degree ? `\\sqrt[${degree}]{${part("m:e")}}` : `\\sqrt{${part("m:e")}}`;
    }
    case "m:d": {
      const pieces = childElements(node).filter((c) => c.nodeName === "m:e").map(mathOf);
      const separator = prop(node, "m:dPr", "m:sepChr") ?? ",";
      return `\\left${delimiter(prop(node, "m:dPr", "m:begChr"), "(")}${pieces.join(separator)}\\right${delimiter(prop(node, "m:dPr", "m:endChr"), ")")}`;
    }
    case "m:nary": {
      const symbol = prop(node, "m:naryPr", "m:chr") ?? "∫";
      const sub = part("m:sub");
      const sup = part("m:sup");
      return `${NARY[symbol] ?? symbol}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""}{${part("m:e")}}`;
    }
    case "m:func":
      return `\\operatorname{${textOf(child(node, "m:fName")).trim()}}{${part("m:e")}}`;
    case "m:limLow":
      return `\\underset{${part("m:lim")}}{${part("m:e")}}`;
    case "m:limUpp":
      return `\\overset{${part("m:lim")}}{${part("m:e")}}`;
    case "m:acc":
      return `${ACCENTS[prop(node, "m:accPr", "m:chr") ?? "̂"] ?? "\\hat"}{${part("m:e")}}`;
    case "m:bar":
      return prop(node, "m:barPr", "m:pos") === "bot" ? `\\underline{${part("m:e")}}` : `\\overline{${part("m:e")}}`;
    case "m:groupChr":
      return prop(node, "m:groupChrPr", "m:pos") === "top" ? `\\overbrace{${part("m:e")}}` : `\\underbrace{${part("m:e")}}`;
    case "m:eqArr":
      return `\\begin{matrix}${childElements(node).filter((c) => c.nodeName === "m:e").map(mathOf).join("\\\\")}\\end{matrix}`;
    case "m:m":
      return `\\begin{matrix}${childElements(node)
        .filter((c) => c.nodeName === "m:mr")
        .map((row) => childElements(row).filter((c) => c.nodeName === "m:e").map(mathOf).join("&"))
        .join("\\\\")}\\end{matrix}`;
    default:
      // Property elements hold formatting, not content.
      return node.nodeName.endsWith("Pr") || node.nodeName === "w:rPr" ? "" : mathOf(node);
  }
}

// Text, with equations as $...$ and pictures as [[img:path]]. A literal $ is escaped so it isn't read as math.
function inline(node: any, rels: Map<string, string>, images: Set<string>): string {
  let out = "";
  for (const c of childElements(node)) {
    switch (c.nodeName) {
      case "w:t":
        out += textOf(c).replace(/\$/g, "\\$");
        break;
      case "w:tab":
        out += " ";
        break;
      case "w:br":
        out += "\n";
        break;
      case "m:oMath": {
        const latex = mathOf(c).trim();
        if (latex) out += `$${latex}$`;
        break;
      }
      case "w:del":
      case "w:pPr":
      case "w:rPr":
        break;
      case "w:drawing":
      case "w:pict": {
        // The size the picture is shown at in Word, which keeps it in proportion to the text.
        const emu = Number(findExtent(c));
        const width = emu > 0 ? `|${Math.round(emu / 9525)}` : "";
        for (const embed of findEmbeds(c)) {
          const target = rels.get(embed);
          if (target) {
            images.add(target);
            out += `[[img:${target}${width}]]`;
          }
        }
        break;
      }
      default:
        out += inline(c, rels, images);
    }
  }
  return out;
}

function findExtent(node: any): string | null {
  for (const c of childElements(node)) {
    if (c.nodeName === "wp:extent") return c.getAttribute("cx");
    const found = findExtent(c);
    if (found) return found;
  }
  return null;
}

function findEmbeds(node: any): string[] {
  const found: string[] = [];
  for (const c of childElements(node)) {
    if (c.nodeName === "a:blip" && c.getAttribute("r:embed")) found.push(c.getAttribute("r:embed"));
    if (c.nodeName === "v:imagedata" && c.getAttribute("r:id")) found.push(c.getAttribute("r:id"));
    found.push(...findEmbeds(c));
  }
  return found;
}

function cellText(cell: any, rels: Map<string, string>, images: Set<string>) {
  return childElements(cell)
    .filter((c) => c.nodeName === "w:p" || c.nodeName === "w:sdt")
    .map((p) => inline(p, rels, images).trim())
    .filter(Boolean)
    .join("\n");
}

const splitList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

export function parseNumericAnswer(value: string): { min: number; max: number } | null {
  const number = "-?(?:\\d+\\.?\\d*|\\.\\d+)";
  const match = value.trim().match(new RegExp(`^(${number})(?:\\s*(?:-|to)\\s*(${number}))?$`, "i"));
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  return min <= max ? { min, max } : null;
}

const TYPE_ALIASES: Record<string, string> = {
  mcq: "mcq", mcqs: "mcq", multiple_choice: "mcq", multiplechoice: "mcq", multi_choice: "mcq", multichoice: "mcq",
  multiple_choice_question: "mcq", single_choice: "mcq", single_correct: "mcq", single_select: "mcq", objective: "mcq",
  true_false: "true_false", truefalse: "true_false", true_or_false: "true_false", t_f: "true_false", tf: "true_false", boolean: "true_false",
  numeric: "numeric", numerical: "numeric", number: "numeric", integer: "numeric", nat: "numeric",
  short_answer: "short_answer", shortanswer: "short_answer", essay: "essay", long_answer: "essay", subjective: "essay",
};

// Staff write the same type many ways, like "MCQ", "Multiple Choice" or "multiple-choice".
export function normalizeQuestionType(raw: string, hasOptions: boolean): string {
  const key = raw.trim().toLowerCase().replace(/[\s\-/]+/g, "_");
  // Option rows marked correct or incorrect can only be a choice question, whatever the Type row says.
  return TYPE_ALIASES[key] ?? (hasOptions ? "mcq" : key);
}

function parseTable(table: any, index: number, rels: Map<string, string>): ParsedQuestion | null {
  const images = new Set<string>();
  const fields: Record<string, string> = {};
  const seenOptions: { text: string; mark: string }[] = [];

  for (const row of childElements(table).filter((c) => c.nodeName === "w:tr")) {
    const cells = childElements(row).filter((c) => c.nodeName === "w:tc");
    if (cells.length === 0) continue;
    const label = textOf(cells[0]).trim().toLowerCase();
    if (label === "option") {
      seenOptions.push({
        text: cellText(cells[1], rels, images),
        mark: textOf(cells[2]).trim().toLowerCase(),
      });
    } else if (label) {
      fields[label] = cells[1] ? cellText(cells[1], rels, images) : "";
    }
  }

  if (fields.question === undefined && fields.type === undefined) return null;

  const errors: string[] = [];
  const rawType = normalizeQuestionType(fields.type ?? "", seenOptions.length > 0);
  const text = (fields.question ?? "").trim();
  if (!text) errors.push("The Question row is empty.");

  const rawDifficulty = (fields.difficulty ?? "").trim().toLowerCase();
  const difficulty = rawDifficulty ? DIFFICULTIES[rawDifficulty] : "Medium";
  if (!difficulty) errors.push(`Difficulty must be Easy, Medium or Hard, not "${fields.difficulty}".`);

  const question: ParsedQuestion = {
    table: index,
    text,
    type: "MCQ",
    difficulty: difficulty ?? "Medium",
    options: [],
    solution: (fields.solution ?? "").trim(),
    subject: (fields.subject ?? "").trim() || null,
    chapters: splitList(fields.chapters ?? fields.chapter ?? ""),
    tags: splitList(fields.tags ?? ""),
    pyq: null,
    images: [],
    errors,
  };

  const rawMarks = (fields.marks ?? fields.mark ?? "").trim();
  if (rawMarks) {
    const marks = Number(rawMarks);
    if (Number.isFinite(marks) && marks > 0 && marks <= 100) question.marks = marks;
    else errors.push(`Marks must be a number above 0, not "${rawMarks}".`);
  }

  const pyq = splitList(fields.pyq ?? "");
  if (pyq.length > 0) {
    const last = pyq[pyq.length - 1];
    const hasYear = pyq.length > 1 && /^\d{4}$/.test(last);
    question.pyq = {
      exam: (hasYear ? pyq.slice(0, -1) : pyq).join(", "),
      ...(hasYear ? { year: Number(last) } : {}),
    };
  }

  if (rawType === "mcq") {
    question.type = "MCQ";
    question.options = seenOptions.map((o) => o.text);
    if (seenOptions.length < 2) errors.push("An MCQ needs at least 2 Option rows.");
    if (seenOptions.some((o) => !o.text)) errors.push("An Option row is empty.");
    const unknown = seenOptions.find((o) => o.mark !== "correct" && o.mark !== "incorrect");
    if (unknown) errors.push(`Each option must be marked correct or incorrect, not "${unknown.mark || "blank"}".`);
    const correct = seenOptions.flatMap((o, i) => (o.mark === "correct" ? [i] : []));
    if (correct.length === 0) errors.push("Mark one option as correct.");
    else if (correct.length > 1) errors.push("Questions with more than one correct option aren't supported yet.");
    else question.correctAnswer = correct[0];
  } else if (rawType === "true_false") {
    question.type = "true_false";
    question.options = ["True", "False"];
    const answer = (fields.answer ?? "").trim().toLowerCase();
    if (answer === "true") question.correctAnswer = 0;
    else if (answer === "false") question.correctAnswer = 1;
    else errors.push('The Answer row must be "true" or "false".');
  } else if (rawType === "numeric") {
    question.type = "numeric";
    const range = parseNumericAnswer(fields.answer ?? "");
    if (range) question.answerRange = range;
    else errors.push('The Answer row must be a number like 1.2, or a range like 1.2-3.4.');
  } else if (rawType === "short_answer" || rawType === "essay") {
    errors.push(`${rawType} questions can't be marked automatically, so they aren't supported yet.`);
  } else {
    errors.push(`Type must be MCQ, true_false or numeric, not "${fields.type ?? "blank"}".`);
  }

  question.images = [...images];
  return question;
}

function imageTypeOf(data: Buffer): string | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  return null;
}

function parseXml(xml: string) {
  // Word files have no need for one, and it's how XML entity attacks work.
  if (/<!DOCTYPE/i.test(xml)) throw new Error("Unexpected content in this file.");
  return new DOMParser().parseFromString(xml, "text/xml");
}

// Identifies a question's content, so the same question uploaded twice isn't stored twice.
// Pictures count by what they show, or every picture-only question would look identical.
export function questionFingerprint(question: ParsedQuestion, images: Map<string, ParsedImage>) {
  const normalize = (value: string) =>
    value
      .replace(/\[\[img:([^\]|]*)(?:\|\d+)?\]\]/g, (_match, path) => {
        const image = images.get(path);
        return image ? `[img:${createHash("sha256").update(image.data).digest("hex")}]` : "[img]";
      })
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  return createHash("sha256")
    .update(JSON.stringify([question.type, normalize(question.text), question.options.map(normalize)]))
    .digest("hex");
}

export class ImportFileError extends Error {}

export async function parseQuestionDocx(file: Buffer): Promise<{ questions: ParsedQuestion[]; images: Map<string, ParsedImage> }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ImportFileError("This isn't a valid .docx file. Please save it as a Word document and try again.");
  }

  const entries = Object.values(zip.files);
  const sizeOf = (entry: any): number => entry?._data?.uncompressedSize ?? 0;
  if (entries.length > MAX_ZIP_ENTRIES) throw new ImportFileError("This file has too many parts to be a question paper.");

  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) throw new ImportFileError("This isn't a valid .docx file. Please save it as a Word document and try again.");
  if (sizeOf(documentEntry) > MAX_XML_BYTES) throw new ImportFileError("This file is too large. Please split it into smaller files.");

  const rels = new Map<string, string>();
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (relsEntry && sizeOf(relsEntry) <= MAX_XML_BYTES) {
    const doc = parseXml(await relsEntry.async("string"));
    const list: any = doc.getElementsByTagName("Relationship");
    for (let i = 0; i < list.length; i++) {
      const target: string = list[i].getAttribute("Target") ?? "";
      // Only pictures inside this file. A link to an outside address is never fetched.
      if (list[i].getAttribute("TargetMode") !== "External" && /^(\.\/)?media\//.test(target)) {
        rels.set(list[i].getAttribute("Id"), target.replace(/^\.\//, ""));
      }
    }
  }

  let doc: any;
  try {
    doc = parseXml(await documentEntry.async("string"));
  } catch {
    throw new ImportFileError("This Word file couldn't be read. Please re-save it and try again.");
  }

  const body = doc.getElementsByTagName("w:body")[0];
  const tables = childElements(body).filter((c) => c.nodeName === "w:tbl");
  if (tables.length > MAX_QUESTIONS_PER_FILE) {
    throw new ImportFileError(`This file has ${tables.length} tables. Please upload at most ${MAX_QUESTIONS_PER_FILE} questions at a time.`);
  }

  const questions: ParsedQuestion[] = [];
  tables.forEach((table, i) => {
    const question = parseTable(table, i + 1, rels);
    if (question) questions.push(question);
  });

  const images = new Map<string, ParsedImage>();
  for (const question of questions) {
    for (const path of question.images) {
      if (images.has(path)) continue;
      const entry = zip.file(`word/${path}`);
      const data = entry && sizeOf(entry) <= MAX_IMAGE_BYTES ? await entry.async("nodebuffer") : null;
      const contentType = data ? imageTypeOf(data) : null;
      if (data && contentType) images.set(path, { contentType, data });
    }
    for (const path of question.images) {
      if (!images.has(path)) question.errors.push("A picture is too large (over 2 MB) or isn't a JPG, PNG or GIF.");
    }
  }

  return { questions, images };
}
