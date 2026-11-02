"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Target,
  HelpCircle,
  Download,
  Trash2,
  Plus,
  Search,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  ArrowLeft,
  Filter,
  FileText,
  X
} from "lucide-react";
import ExamSettingsPanel from "./ExamSettingsPanel";
import {
  orderedQuestionIds,
  placeQuestion,
  removeQuestion,
  sectionsForEditing,
  type ExamSection,
} from "@/lib/sections";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: number;
  subject: string;
  chapter: string;
  difficulty: "Easy" | "Medium" | "Hard";
  type?: string;
  tags?: string[];
  marks?: number;
}

interface Exam {
  _id?: string;
  id: string;
  title: string;
  duration: number;
  totalMarks: number;
  totalQuestions: number;
  batch: string;
  subject: string;
  created: string;
  status: string;
  difficulty?: string;
  questions: string[];
  questionDocs?: Question[];
  sections?: { name: string; questionIds: string[] }[];
  attemptCount?: number;
}

function AdminExamEditorContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  // Exam state
  const [exam, setExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("all");

  // Question bank state
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankLoading, setBankLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [chapterFilter, setChapterFilter] = useState("All");
  const [pyqFilter, setPyqFilter] = useState("All");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Available subjects and chapters
  const [subjectsList, setSubjectsList] = useState<{ id: string; name: string }[]>([]);
  const [chaptersList, setChaptersList] = useState<{ id: string; name: string }[]>([]);

  // Modals
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showCreateQModal, setShowCreateQModal] = useState(false);
  const [newQText, setNewQText] = useState("");
  const [newQSubject, setNewQSubject] = useState("Physics");
  const [newQChapter, setNewQChapter] = useState("");
  const [newQDifficulty, setNewQDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [newQOptions, setNewQOptions] = useState(["", "", "", ""]);
  const [newQCorrect, setNewQCorrect] = useState(0);

  // 1. Fetch Exam Details
  const fetchExam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/exams/${examId}`);
      const data = await res.json();
      if (data.success && data.exam) {
        setExam(data.exam);
        setExamQuestions(data.exam.questionDocs || []);
        // Set default subject filter for Question Bank to match the exam
        // Only for a real subject: labels like "MHT-CET Combined" would filter the bank down to nothing.
        if (["Physics", "Chemistry", "Mathematics", "Biology", "Foundation"].includes(data.exam.subject)) {
          setSubjectFilter(data.exam.subject);
        }
      }
    } catch (err) {
      console.error("Failed to load exam:", err);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  // 2. Fetch Subjects and Chapters for filters
  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.subjects) {
          setSubjectsList(data.subjects);
        }
      })
      .catch((err) => console.error("Error loading subjects:", err));
  }, []);

  useEffect(() => {
    const url = subjectFilter && subjectFilter !== "All"
      ? `/api/chapters?subject=${encodeURIComponent(subjectFilter)}`
      : "/api/chapters";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.chapters) {
          setChaptersList(data.chapters);
        }
      })
      .catch((err) => console.error("Error loading chapters:", err));
  }, [subjectFilter]);

  // 3. Fetch Question Bank Questions with filters and pagination
  const fetchQuestionBank = useCallback(async () => {
    try {
      setBankLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", pageSize.toString());

      if (subjectFilter && subjectFilter !== "All") params.set("subject", subjectFilter);
      if (chapterFilter && chapterFilter !== "All") params.set("chapter", chapterFilter);
      if (difficultyFilter && difficultyFilter !== "All") params.set("difficulty", difficultyFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (activeTag) params.set("q", activeTag);

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setBankQuestions(data.questions || []);
        setBankTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error loading question bank:", err);
    } finally {
      setBankLoading(false);
    }
  }, [page, pageSize, subjectFilter, chapterFilter, difficultyFilter, searchQuery, activeTag]);

  useEffect(() => {
    fetchQuestionBank();
  }, [fetchQuestionBank]);

  // Set of question IDs currently in the exam
  const examQuestionIdSet = useMemo(() => {
    return new Set(exam?.questions || []);
  }, [exam?.questions]);

  // Saves the question list and undoes the on-screen change if the server refuses,
  // e.g. because students have already started and the paper is locked.
  const saveExamQuestions = async (updatedQuestions: string[], updatedDocs: Question[], updatedSections: ExamSection[]) => {
    const previous = { exam, examQuestions };

    // Optimistic UI update
    setExam((prev) => prev ? { ...prev, questions: updatedQuestions, totalQuestions: updatedQuestions.length, sections: updatedSections } : null);
    setExamQuestions(updatedDocs);

    try {
      setSaving(true);
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: updatedQuestions, sections: updatedSections })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Could not save the change.");
      }
      setExam((prev) => prev ? { ...prev, totalMarks: data.exam.totalMarks } : null);
    } catch (err) {
      console.error("Failed to update exam questions:", err);
      setExam(previous.exam);
      setExamQuestions(previous.examQuestions);
      setActiveSection("all");
      alert(err instanceof Error ? err.message : "Could not save the change.");
    } finally {
      setSaving(false);
    }
  };

  // The current section setup, including questions that are grouped by subject automatically.
  const editorSections = useMemo(
    () => sectionsForEditing(examQuestions, exam?.sections),
    [examQuestions, exam?.sections]
  );

  // The paper's real order, so numbers here match what students see.
  const orderedExamQuestions = useMemo(() => {
    const byId = new Map(examQuestions.map((q) => [q.id, q]));
    return orderedQuestionIds(editorSections).map((id) => byId.get(id)).filter((q): q is Question => !!q);
  }, [examQuestions, editorSections]);

  const visibleQuestions = useMemo(() => {
    const section = editorSections.find((s) => s.name === activeSection);
    if (!section) return orderedExamQuestions;
    return orderedExamQuestions.filter((q) => section.questionIds.includes(q.id));
  }, [orderedExamQuestions, editorSections, activeSection]);

  const activeSectionExists = editorSections.some((s) => s.name === activeSection);

  // Add question to exam: into the open section, otherwise into its subject's section
  const handleAddQuestionToExam = async (q: Question) => {
    if (!exam) return;
    if (examQuestionIdSet.has(q.id)) return;
    await saveExamQuestions(
      [...(exam.questions || []), q.id],
      [...examQuestions, q],
      placeQuestion(editorSections, q, activeSectionExists ? activeSection : undefined)
    );
  };

  const handleMoveQuestion = async (q: Question, sectionName: string) => {
    if (!exam) return;
    await saveExamQuestions(exam.questions || [], examQuestions, placeQuestion(editorSections, q, sectionName));
  };

  // Its questions aren't removed from the exam: they go back to their subject sections.
  const handleDeleteSection = async (sectionName: string) => {
    if (!exam) return;
    if (!confirm(`Delete the section "${sectionName}"? Its questions stay in the exam and go back to their subject sections.`)) return;
    setActiveSection("all");
    await saveExamQuestions(
      exam.questions || [],
      examQuestions,
      editorSections.filter((s) => s.name !== sectionName)
    );
  };

  // Remove question from exam
  const handleRemoveQuestionFromExam = async (qId: string) => {
    if (!exam) return;
    await saveExamQuestions(
      (exam.questions || []).filter((id) => id !== qId),
      examQuestions.filter((q) => q.id !== qId),
      removeQuestion(editorSections, qId)
    );
  };

  // Create custom question
  const handleCreateCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim()) return;

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newQText.trim(),
          options: newQOptions.filter((o) => o.trim().length > 0),
          correctAnswer: newQCorrect,
          subject: newQSubject,
          chapter: newQChapter || "General",
          difficulty: newQDifficulty
        })
      });
      const data = await res.json();
      if (data.success && data.question) {
        // Auto add to exam as well
        handleAddQuestionToExam(data.question);
        fetchQuestionBank();
        setShowCreateQModal(false);
        setNewQText("");
        setNewQOptions(["", "", "", ""]);
      } else {
        alert(data.error || "Could not create the question.");
      }
    } catch (err) {
      console.error("Error creating question:", err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(bankTotal / pageSize));

  // Export as PDF trigger
  const handleExportPDF = () => {
    window.print();
  };

  if (loading && !exam) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[500px] text-gray-500">
        <RotateCw className="w-8 h-8 animate-spin text-[#287FC1] mb-3" />
        <p className="text-sm font-medium">Loading Examination Details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold text-gray-800">Exam not found</h2>
        <Link
          href="/admin/examinations"
          className="mt-4 inline-flex items-center gap-2 text-sm text-[#287FC1] font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Examinations
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1700px] mx-auto w-full space-y-6">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/examinations"
              className="text-gray-400 hover:text-gray-600 p-1 -ml-1 rounded-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {exam.title}
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-6">
            Manage sections & questions • Assigned Batch:{" "}
            <span className="font-semibold text-[#287FC1] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {exam.batch}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/exam/${exam.id}`}
            target="_blank"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-colors"
          >
            Preview as Student
          </Link>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
        </div>
      </div>

      <ExamSettingsPanel
        key={exam.id}
        exam={exam}
        subjects={examQuestions.map((q) => q.subject)}
        onExamUpdated={(updated) => setExam((prev) => prev ? { ...prev, ...updated } : updated)}
      />

      {/* ── STATS CARDS (Duration, Total Marks, Questions) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Duration */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Duration</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {exam.duration} minutes
            </div>
          </div>
        </div>

        {/* Card 2: Total Marks */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Total Marks</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {exam.totalMarks}
            </div>
          </div>
        </div>

        {/* Card 3: Questions */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Questions</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {examQuestions.length}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION BAR ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setActiveSection("all")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
            activeSection === "all"
              ? "bg-[#287FC1] text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          All Questions ({examQuestions.length})
        </button>

        {editorSections.map((sec) => (
          <span key={sec.name} className="inline-flex items-center">
            <button
              onClick={() => setActiveSection(sec.name)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                activeSection === sec.name
                  ? "bg-[#287FC1] text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {sec.name} ({sec.questionIds.length})
            </button>
            {/* A section holding only its own subject's questions would just come back, so it can't be deleted. */}
            {activeSection === sec.name &&
              !(sec.questionIds.length > 0 && examQuestions.every((q) => !sec.questionIds.includes(q.id) || q.subject === sec.name)) && (
              <button
                onClick={() => handleDeleteSection(sec.name)}
                title={`Delete section ${sec.name}`}
                aria-label={`Delete section ${sec.name}`}
                className="ml-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ))}

        <button
          onClick={() => setShowAddSectionModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#287FC1] bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>

      {/* ── TWO-COLUMN WORKSPACE: LEFT = EXAM QUESTIONS, RIGHT = QUESTION BANK ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: EXAM QUESTIONS (5 cols) ── */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200/90 shadow-xs p-5 flex flex-col min-h-[700px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {activeSectionExists ? activeSection : "Exam Questions"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeSectionExists
                  ? `${visibleQuestions.length} of ${examQuestions.length} questions. New questions go into this section.`
                  : `${examQuestions.length} questions in this exam. New questions go into their subject's section.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Multi-select
              </button>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4 overflow-y-auto max-h-[900px] pr-1">
            {visibleQuestions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No questions added yet.</p>
                <p className="text-xs mt-1">
                  Click &ldquo;+ Add&rdquo; from the Question Bank on the right to include questions.
                </p>
              </div>
            ) : (
              visibleQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-white group shadow-2xs relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {orderedExamQuestions.indexOf(q) + 1}.
                        </span>
                        <p className="text-sm text-gray-800 leading-relaxed font-medium">
                          {q.text}
                        </p>
                      </div>

                      {/* Options preview if present */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 ml-5">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                                q.correctAnswer === oIdx
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                                  : "bg-gray-50 text-gray-600 border-gray-100"
                              }`}
                            >
                              <span className="font-bold uppercase text-[10px] text-gray-400">
                                {String.fromCharCode(65 + oIdx)}.
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mt-3 ml-5">
                        <span className="text-[11px] font-medium text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                          MCQ
                        </span>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                            q.difficulty === "Hard"
                              ? "text-red-600 bg-red-50 border-red-200"
                              : q.difficulty === "Medium"
                              ? "text-amber-600 bg-amber-50 border-amber-200"
                              : "text-emerald-600 bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          {q.subject}
                        </span>
                        {q.chapter && (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {q.chapter}
                          </span>
                        )}
                        <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1">
                          Section:
                          <select
                            aria-label={`Section for question ${orderedExamQuestions.indexOf(q) + 1}`}
                            value={editorSections.find((s) => s.questionIds.includes(q.id))?.name ?? ""}
                            onChange={(e) => handleMoveQuestion(q, e.target.value)}
                            className="text-[11px] border border-gray-300 rounded-md px-1 py-0.5 bg-white"
                          >
                            {editorSections.map((s) => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Delete Icon */}
                    <button
                      onClick={() => handleRemoveQuestionFromExam(q.id)}
                      title="Remove from exam"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: QUESTION BANK (6 cols) ── */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200/90 shadow-xs p-5 flex flex-col min-h-[700px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Question Bank
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {bankTotal.toLocaleString()} questions available
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {}}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Multi select
              </button>
              <button
                onClick={() => fetchQuestionBank()}
                title="Refresh Question Bank"
                className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RotateCw
                  className={`w-4 h-4 ${bankLoading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={() => setShowCreateQModal(true)}
                title="Add new question to bank"
                className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search questions by content, options, subject, chapter, tags, or answers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] focus:bg-white transition-all text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Filter Dropdowns row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            {/* All Types */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-[#287FC1]"
            >
              <option value="All">All Types</option>
              <option value="MCQ">MCQ</option>
              <option value="Integer">Integer</option>
            </select>

            {/* Difficulty */}
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-[#287FC1]"
            >
              <option value="All">All...</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            {/* Subject */}
            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setChapterFilter("All");
                setPage(1);
              }}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-[#287FC1]"
            >
              <option value="All">Subject</option>
              {subjectsList.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Chapter */}
            <select
              value={chapterFilter}
              onChange={(e) => {
                setChapterFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-[#287FC1] truncate"
            >
              <option value="All">All Chapters</option>
              {chaptersList.map((ch) => (
                <option key={ch.id} value={ch.name}>
                  {ch.name}
                </option>
              ))}
            </select>

            {/* All PYQ */}
            <select
              value={pyqFilter}
              onChange={(e) => setPyqFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-[#287FC1]"
            >
              <option value="All">All PYQ...</option>
              <option value="2025">PYQ 2025</option>
              <option value="2024">PYQ 2024</option>
              <option value="2023">PYQ 2023</option>
            </select>
          </div>

          {/* Tags Chips */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 mr-1">
              Tags:
            </span>
            {["iupac", "match the pair", "mht-cet", "jee-adv"].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setActiveTag(activeTag === tag ? null : tag);
                  setPage(1);
                }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                  activeTag === tag
                    ? "bg-[#287FC1] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Pagination and showing count */}
          <div className="flex items-center justify-between text-xs text-gray-500 py-3 border-b border-gray-100 mt-2">
            <div>
              Showing {bankQuestions.length === 0 ? 0 : (page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, bankTotal)} of {bankTotal}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs px-2 font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-3.5 mt-3 overflow-y-auto max-h-[800px] pr-1 flex-1">
            {bankLoading ? (
              <div className="p-12 text-center text-gray-400">
                <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#287FC1]" />
                <p className="text-xs">Loading questions...</p>
              </div>
            ) : bankQuestions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium">No questions found matching criteria.</p>
              </div>
            ) : (
              bankQuestions.map((q) => {
                const isAdded = examQuestionIdSet.has(q.id);

                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl border border-gray-200/90 hover:border-gray-300 transition-colors bg-white shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-gray-900 leading-relaxed font-medium flex-1">
                        {q.text}
                      </p>

                      {/* Add button */}
                      {isAdded ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed shrink-0 border border-gray-200"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Added
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddQuestionToExam(q)}
                          className="inline-flex items-center gap-1 px-3.5 py-1 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                    </div>

                    {/* Options preview */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        {q.options.slice(0, 4).map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`text-[11px] px-2 py-0.5 rounded border truncate ${
                              q.correctAnswer === oIdx
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                                : "bg-gray-50 text-gray-500 border-gray-100"
                            }`}
                          >
                            <span className="font-bold mr-1">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <span className="text-[10px] font-medium text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                        MCQ
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                          q.difficulty === "Hard"
                            ? "text-red-600 bg-red-50 border-red-200"
                            : q.difficulty === "Medium"
                            ? "text-amber-600 bg-amber-50 border-amber-200"
                            : "text-emerald-600 bg-emerald-50 border-emerald-200"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                        {q.subject}
                      </span>
                      {q.chapter && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {q.chapter}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD SECTION ── */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Add Exam Section
              </h3>
              <button
                onClick={() => setShowAddSectionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Divide your test into sections such as &ldquo;Physics&rdquo;, &ldquo;Chemistry&rdquo;, or &ldquo;Mathematics&rdquo;.
            </p>
            <input
              type="text"
              placeholder="Section Name (e.g. Section B: Organic Chemistry)"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddSectionModal(false)}
                className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newSectionName.trim() || !exam) return;
                  const name = newSectionName.trim();
                  setShowAddSectionModal(false);
                  setNewSectionName("");
                  if (editorSections.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
                    setActiveSection(editorSections.find((s) => s.name.toLowerCase() === name.toLowerCase())!.name);
                    return;
                  }
                  setActiveSection(name);
                  await saveExamQuestions(exam.questions || [], examQuestions, [...editorSections, { name, questionIds: [] }]);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg shadow-xs"
              >
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE QUESTION ── */}
      {showCreateQModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">
                Create New Question
              </h3>
              <button
                onClick={() => setShowCreateQModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomQuestion} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Question Text / Formula
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter question text. KaTeX math symbols like \sqrt{x} are supported."
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={newQSubject}
                    onChange={(e) => setNewQSubject(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={newQDifficulty}
                    onChange={(e) => setNewQDifficulty(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Chapter Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kinetic Theory of Gases"
                  value={newQChapter}
                  onChange={(e) => setNewQChapter(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Options (select the radio for correct answer)
                </label>
                <div className="space-y-2">
                  {newQOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={newQCorrect === i}
                        onChange={() => setNewQCorrect(i)}
                        className="text-[#287FC1] focus:ring-[#287FC1]"
                      />
                      <span className="text-xs font-bold text-gray-500 w-4">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newQOptions];
                          updated[i] = e.target.value;
                          setNewQOptions(updated);
                        }}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateQModal(false)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg shadow-xs"
                >
                  Add &amp; Save to Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminExamEditorPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center min-h-[500px] text-gray-500">
          <RotateCw className="w-8 h-8 animate-spin text-[#287FC1] mb-3" />
          <p className="text-sm font-medium">Loading Examination Details...</p>
        </div>
      }
    >
      <AdminExamEditorContent />
    </React.Suspense>
  );
}
