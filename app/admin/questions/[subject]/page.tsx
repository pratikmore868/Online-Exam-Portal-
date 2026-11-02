"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronLeft, FileText, RotateCw, Search, X } from "lucide-react";

const PAGE_SIZE = 20;

const selectClass =
  "w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer";

function SubjectQuestions() {
  const params = useParams();
  const subjectId = params.subject as string;

  const [subject, setSubject] = useState<any>(null);
  const [subjectError, setSubjectError] = useState("");

  const [questions, setQuestions] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [chapter, setChapter] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`/api/subjects/${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSubject(data.subject);
        else setSubjectError(data.error || "Subject not found.");
      })
      .catch(() => setSubjectError("Could not reach the server. Please refresh the page."));
  }, [subjectId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const subjectName: string | undefined = subject?.name;

  useEffect(() => {
    if (!subjectName) return;
    let cancelled = false;

    const params = new URLSearchParams({ subject: subjectName, page: String(page), limit: String(PAGE_SIZE) });
    if (chapter !== "All") params.set("chapter", chapter);
    if (difficulty !== "All") params.set("difficulty", difficulty);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

    fetch(`/api/questions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        // Ignore a slower, older request so it can't replace newer results.
        if (cancelled) return;
        if (!data.success) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setQuestions(data.questions);
        setChapters(data.chapters ?? []);
        setTotal(data.total);
        setTotalPages(Math.max(1, data.totalPages));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subjectName, chapter, difficulty, debouncedSearch, page]);

  if (subjectError) {
    return (
      <div className="p-12 text-center">
        <h1 className="text-lg font-bold text-gray-800">{subjectError}</h1>
        <Link href="/admin/questions" className="inline-block mt-3 text-sm font-semibold text-[#287FC1]">
          Back to Question Bank
        </Link>
      </div>
    );
  }

  const hasFilters = chapter !== "All" || difficulty !== "All" || !!searchQuery;
  const firstNumber = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Link href="/admin/questions" aria-label="Back to Question Bank" className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded-md">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {subject?.icon} {subject?.name ?? "Loading..."}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString()} question{total === 1 ? "" : "s"}{hasFilters ? (total === 1 ? " matches these filters" : " match these filters") : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search questions"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg pl-9 pr-8 py-2 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            aria-label="Filter by chapter"
            value={chapter}
            onChange={(e) => {
              setChapter(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="All">All Chapters</option>
            {chapters.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by difficulty"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="All">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Questions */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
          <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#287FC1]" />
          <p className="text-sm">Loading questions...</p>
        </div>
      ) : loadFailed ? (
        <div className="p-12 text-center text-sm text-red-700 bg-white rounded-xl border border-gray-200">
          Could not load questions. Please refresh the page.
        </div>
      ) : questions.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">
            {hasFilters ? "No questions match these filters." : `No questions in ${subject?.name} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <article key={q.id} className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-gray-900">{firstNumber + i}.</span>
                <p className="text-sm text-gray-900 leading-relaxed font-medium whitespace-pre-wrap">{q.text}</p>
              </div>

              {q.options?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-3 ml-5">
                  {q.options.map((option: string, index: number) => {
                    const isCorrect = q.correctAnswer === index;
                    return (
                      <div
                        key={index}
                        className={`text-xs px-2.5 py-1.5 rounded border flex items-start gap-1.5 ${
                          isCorrect
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold"
                            : "bg-gray-50 text-gray-700 border-gray-100"
                        }`}
                      >
                        <span className="font-bold text-[10px] text-gray-500 mt-px">{String.fromCharCode(65 + index)}.</span>
                        <span className="flex-1">{option}</span>
                        {isCorrect && <span className="text-[10px] font-bold text-emerald-800 whitespace-nowrap">✓ Correct</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap mt-3 ml-5 text-[11px] font-medium">
                {q.chapter && (
                  <span className="px-2 py-0.5 rounded-md border text-emerald-800 bg-emerald-50 border-emerald-200">{q.chapter}</span>
                )}
                {q.difficulty && (
                  <span
                    className={`px-2 py-0.5 rounded-md border ${
                      q.difficulty === "Hard"
                        ? "text-red-700 bg-red-50 border-red-200"
                        : q.difficulty === "Medium"
                        ? "text-amber-800 bg-amber-50 border-amber-200"
                        : "text-emerald-800 bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    {q.difficulty}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md border text-gray-600 bg-gray-50 border-gray-200">
                  {q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? "" : "s"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSubjectQuestionsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-[#287FC1]">Loading questions...</div>}>
      <SubjectQuestions />
    </Suspense>
  );
}
