"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, Download } from "lucide-react";
import FileDropZone from "@/app/admin/components/FileDropZone";
import MathText from "@/app/components/MathText";

const selectClass =
  "w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer";

const TYPE_LABELS: Record<string, string> = { MCQ: "MCQ", true_false: "True / False", numeric: "Numeric" };

function answerText(row: any) {
  if (row.type === "numeric" && row.answerRange) {
    return row.answerRange.min === row.answerRange.max
      ? `Answer: ${row.answerRange.min}`
      : `Answer: ${row.answerRange.min} to ${row.answerRange.max}`;
  }
  return null;
}

export default function BulkImportQuestionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [defaultSubject, setDefaultSubject] = useState("");
  const [examId, setExamId] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSubjects(data.subjects);
      })
      .catch(() => undefined);
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => {
        // A paper is locked once a student has started it.
        if (data.success) setExams(data.exams.filter((e: any) => !e.attempts));
      })
      .catch(() => undefined);
  }, []);

  const send = async (selected: File, subject: string, confirm: boolean) => {
    const requestId = ++latestRequest.current;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", selected);
      form.set("defaultSubject", subject);
      if (confirm) {
        form.set("confirm", "true");
        form.set("examId", examId);
      }
      const res = await fetch("/api/questions/import", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      // A slower, older preview must not replace the result of a newer choice.
      if (requestId !== latestRequest.current) return;
      if (!data?.success) {
        setError(data?.error || (res.status === 413 ? "This file is too large. Please split it into smaller files." : "Could not read this file."));
        if (!confirm) setPreview(null);
        return;
      }
      if (confirm) {
        setResult(data);
        setPreview(null);
        setFile(null);
      } else {
        setPreview(data);
      }
    } catch {
      if (requestId === latestRequest.current) setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      if (requestId === latestRequest.current) setBusy(false);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2">
          <Link href="/admin/questions" aria-label="Back to Question Bank" className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded-md">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bulk Import Questions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Import many questions at once from a Word file in the table format</p>
          </div>
        </div>
        <a
          href="/samples/BulkImportSample.docx"
          download
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg"
        >
          <Download className="w-4 h-4" />
          Download Sample
        </a>
      </div>

      {result && (
        <div role="status" className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {result.imported} question{result.imported === 1 ? "" : "s"} saved to the question bank
            {result.examTitle ? ` and added to "${result.examTitle}"` : ""}.
          </div>
          {(result.invalid > 0 || result.duplicates > 0) && (
            <p className="mt-1 ml-6">
              Skipped: {result.invalid} with problems, {result.duplicates} already in the bank.
            </p>
          )}
          <div className="mt-2 ml-6 flex gap-4 font-semibold">
            {result.examId ? (
              <Link href={`/admin/exams/${result.examId}`} className="underline">Open this paper</Link>
            ) : (
              <Link href="/admin/examinations" className="underline">Create a paper</Link>
            )}
            <Link href="/admin/questions" className="underline">View question bank</Link>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label htmlFor="default-subject" className="block text-sm font-medium text-gray-700 mb-1.5">
          Subject for these questions (used when a question&apos;s Subject row is blank)
        </label>
        <div className="relative md:max-w-md">
          <select
            id="default-subject"
            value={defaultSubject}
            onChange={(e) => {
              setDefaultSubject(e.target.value);
              if (file) send(file, e.target.value, false);
            }}
            className={selectClass}
          >
            <option value="">Choose a subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <FileDropZone
        accept=".docx"
        label="DOCX"
        fileName={file?.name}
        onFile={(selected) => {
          setFile(selected);
          setResult(null);
          send(selected, defaultSubject, false);
        }}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {busy && <p role="status" className="text-sm font-medium text-[#287FC1]">Reading the file...</p>}

      {!preview && !result && (
        <div className="p-5 rounded-xl bg-gray-100 text-sm text-gray-800">
          <h2 className="font-semibold mb-2">File format</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Upload a .docx file of up to 4 MB, with each question in a separate table. Word equations and pictures are supported.</li>
            <li><strong>Rows:</strong> Question, Type, Difficulty, Option or Answer, Solution, Subject, Chapters, Tags, PYQ.</li>
            <li><strong>MCQ options:</strong> use 3 columns: Option | content | correct or incorrect, with exactly one correct option.</li>
            <li><strong>Supported types:</strong> MCQ (also written as multiple_choice or similar), true_false (Answer: true or false) and numeric (Answer: 1.2, or a range like 1.2-3.4). A question with Option rows counts as MCQ.</li>
            <li>The short_answer and essay types can&apos;t be marked automatically, so they aren&apos;t imported.</li>
            <li>Chapters and Tags can be comma separated. PYQ is written as: Exam Name,2022.</li>
            <li>Download the <a href="/samples/BulkImportSample.docx" download className="font-semibold text-[#287FC1] underline">sample file</a> for the exact format.</li>
          </ul>
        </div>
      )}

      {preview && file && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Questions in File", preview.total, "text-gray-900"],
              ["Ready to Import", preview.valid, "text-emerald-700"],
              ["Have Problems", preview.invalid, "text-red-700"],
              ["Already in Bank", preview.duplicates, "text-amber-700"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label htmlFor="add-to-exam" className="block text-sm font-medium text-gray-700 mb-1.5">Also add these questions to a paper (optional)</label>
            <div className="relative md:max-w-md">
              <select id="add-to-exam" value={examId} onChange={(e) => setExamId(e.target.value)} className={selectClass}>
                <option value="">Question bank only</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {preview.needsSubject > 0 && (
            <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              {preview.needsSubject} question{preview.needsSubject === 1 ? " has" : "s have"} no subject in the file. Choose a subject at the top of this page to include {preview.needsSubject === 1 ? "it" : "them"}.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">
              {preview.invalid > 0 ? "Questions with problems will be skipped. Fix them in the file and upload it again." : "Check the questions below, then import them."}
            </p>
            <button
              onClick={() => send(file, defaultSubject, true)}
              disabled={busy || preview.valid === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? "Working..." : `Import ${preview.valid} Question${preview.valid === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="space-y-3">
            {preview.rows.map((row: any) => (
              <article
                key={row.table}
                className={`bg-white p-5 rounded-xl border ${
                  row.errors.length > 0 ? "border-red-300" : row.duplicate || !row.subject ? "border-amber-300" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-medium mb-2">
                  <span className="font-bold text-gray-900 text-xs">Table {row.table}</span>
                  <span className="px-2 py-0.5 rounded-md border text-sky-700 bg-sky-50 border-sky-200">{TYPE_LABELS[row.type] ?? row.type}</span>
                  <span className="px-2 py-0.5 rounded-md border text-gray-700 bg-gray-50 border-gray-200">{row.difficulty}</span>
                  {row.subject && <span className="px-2 py-0.5 rounded-md border text-emerald-800 bg-emerald-50 border-emerald-200">{row.subject}</span>}
                  {row.chapters.map((c: string) => (
                    <span key={c} className="px-2 py-0.5 rounded-md border text-gray-700 bg-gray-50 border-gray-200">{c}</span>
                  ))}
                  {row.pyq && <span className="px-2 py-0.5 rounded-md border text-purple-800 bg-purple-50 border-purple-200">PYQ: {row.pyq.exam}{row.pyq.year ? ` ${row.pyq.year}` : ""}</span>}
                  {row.errors.length === 0 && !row.duplicate && !row.subject && (
                    <span className="px-2 py-0.5 rounded-md border text-amber-800 bg-amber-50 border-amber-200">Needs a subject</span>
                  )}
                  {row.errors.length === 0 && row.duplicate && (
                    <span className="px-2 py-0.5 rounded-md border text-amber-800 bg-amber-50 border-amber-200">Already in the bank, will be skipped</span>
                  )}
                </div>

                <div className="text-sm text-gray-900 font-medium"><MathText text={row.text} /></div>

                {row.options.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-3">
                    {row.options.map((option: string, i: number) => (
                      <div
                        key={i}
                        className={`text-xs px-2.5 py-1.5 rounded border flex items-start gap-1.5 ${
                          row.correctAnswer === i ? "bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold" : "bg-gray-50 text-gray-700 border-gray-100"
                        }`}
                      >
                        <span className="font-bold text-[10px] text-gray-500 mt-px">{String.fromCharCode(65 + i)}.</span>
                        <span className="flex-1"><MathText text={option} /></span>
                        {row.correctAnswer === i && <span className="text-[10px] font-bold text-emerald-800 whitespace-nowrap">✓ Correct</span>}
                      </div>
                    ))}
                  </div>
                )}

                {answerText(row) && <p className="text-xs font-semibold text-emerald-800 mt-2">{answerText(row)}</p>}
                {row.solution && (
                  <p className="text-xs text-gray-600 mt-2"><strong>Solution:</strong> <MathText text={row.solution} /></p>
                )}

                {row.errors.length > 0 && (
                  <ul className="mt-3 text-xs text-red-800 bg-red-50 rounded-lg p-2.5 list-disc ml-0 pl-6 space-y-0.5">
                    {row.errors.map((e: string) => <li key={e}>{e}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
