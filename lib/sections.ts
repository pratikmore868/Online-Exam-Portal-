// Pure section logic shared by the exam editor, the server and the exam screen.

export interface ExamSection {
  name: string;
  questionIds: string[];
}

interface SectionQuestion {
  id: string;
  subject?: string;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The sections students see: staff-made sections first, and any question not placed
// in one goes into a section named after its subject. Empty sections are left out.
export function resolveSections(questions: SectionQuestion[], sections: ExamSection[] = []): ExamSection[] {
  const valid = new Set(questions.map((q) => q.id));
  const placed = new Set<string>();
  const result: ExamSection[] = [];

  for (const section of sections) {
    const questionIds: string[] = [];
    for (const id of section.questionIds ?? []) {
      if (valid.has(id) && !placed.has(id)) {
        placed.add(id);
        questionIds.push(id);
      }
    }
    if (questionIds.length > 0) result.push({ name: section.name, questionIds });
  }

  for (const question of questions) {
    if (placed.has(question.id)) continue;
    placed.add(question.id);
    const name = question.subject || "General";
    const existing = result.find((s) => sameName(s.name, name));
    if (existing) existing.questionIds.push(question.id);
    else result.push({ name, questionIds: [question.id] });
  }

  return result;
}

export function orderedQuestionIds(sections: ExamSection[]) {
  return sections.flatMap((section) => section.questionIds);
}

// The sections staff see, which also keeps empty ones they've just created.
export function sectionsForEditing(questions: SectionQuestion[], sections: ExamSection[] = []): ExamSection[] {
  const resolved = resolveSections(questions, sections);
  const empty = sections.filter(
    (section) => !resolved.some((s) => sameName(s.name, section.name))
  );
  return [...resolved, ...empty.map((s) => ({ name: s.name, questionIds: [] }))];
}

// Puts a question in the named section, or its subject's section, creating it if needed.
export function placeQuestion(sections: ExamSection[], question: SectionQuestion, target?: string): ExamSection[] {
  const name = target || question.subject || "General";
  const cleaned = removeQuestion(sections, question.id);
  if (cleaned.some((s) => sameName(s.name, name))) {
    return cleaned.map((s) => (sameName(s.name, name) ? { ...s, questionIds: [...s.questionIds, question.id] } : s));
  }
  return [...cleaned, { name, questionIds: [question.id] }];
}

export function removeQuestion(sections: ExamSection[], questionId: string): ExamSection[] {
  return sections.map((s) => ({ ...s, questionIds: s.questionIds.filter((id) => id !== questionId) }));
}

// Cleans sections sent to the server: trims names, merges duplicates, and keeps only real questions.
export function normalizeSections(sections: ExamSection[], questionIds: string[]): ExamSection[] {
  const valid = new Set(questionIds);
  const placed = new Set<string>();
  const result: ExamSection[] = [];
  for (const section of sections) {
    const name = section.name.trim();
    if (!name) continue;
    let target = result.find((s) => sameName(s.name, name));
    if (!target) {
      target = { name, questionIds: [] };
      result.push(target);
    }
    for (const id of section.questionIds) {
      if (valid.has(id) && !placed.has(id)) {
        placed.add(id);
        target.questionIds.push(id);
      }
    }
  }
  return result;
}
