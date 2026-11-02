"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronDown,
  Download,
  CheckCircle2,
  Clock,
  RotateCcw
} from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";

const PAGE_SIZE = 50;

function buildParams(exam: string, batch: string, search: string, page: number, limit: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (exam !== "All Exams") params.set("examId", exam);
  if (batch !== "All Batches") params.set("batch", batch);
  if (search.trim()) params.set("q", search.trim());
  return params;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminResultsPage() {
  const { user } = useAuth();

  const [selectedExam, setSelectedExam] = useState<string>("All Exams");
  const [selectedBatch, setSelectedBatch] = useState<string>("All Batches");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const params = buildParams(selectedExam, selectedBatch, debouncedSearch, page, PAGE_SIZE);
      const res = await fetch(`/api/results?${params.toString()}`);
      const body = await res.json();
      if (body.success) {
        setData(body);
      } else {
        setLoadFailed(true);
      }
    } catch (err) {
      console.error("Error loading results:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [selectedExam, selectedBatch, debouncedSearch, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Export Results CSV (every matching row, not just this page)
  const handleExportCSV = async () => {
    try {
      const params = buildParams(selectedExam, selectedBatch, debouncedSearch, 1, 5000);
      const res = await fetch(`/api/results?${params.toString()}`);
      const body = await res.json();
      if (!body.success) {
        alert(body.error || "Could not export results.");
        return;
      }

      const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const headers = ["Rank", "Student ID", "Student Name", "Batch", "Exam Title", "Score", "Max Score", "Percentage", "Correct", "Wrong", "Unattempted", "Time Taken (min)", "Submitted", "Submitted By"];
      const rows = body.results.map((a: any) => [
        a.rank,
        a.studentId,
        a.studentName,
        a.batch,
        a.examTitle,
        a.result.score,
        a.result.maxScore,
        a.result.percentage,
        a.result.correct,
        a.result.incorrect,
        a.result.unanswered,
        Math.round(a.result.timeTakenSeconds / 60),
        new Date(a.submittedAt).toLocaleString("en-IN"),
        a.submitType === "time_up" ? "Time ran out" : "Student",
      ].map(quote).join(","));

      const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `ram_raj_exam_results_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Could not reach the server.");
    }
  };

  const handleAllowRetake = async (attempt: any) => {
    if (!confirm(`Delete ${attempt.studentName}'s result for "${attempt.examTitle}" (${attempt.result.score}/${attempt.result.maxScore}) so they can sit it again?\n\nThis cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/attempts/${attempt.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) {
        alert(body.error || "Could not delete this result.");
        return;
      }
      fetchResults();
    } catch (err) {
      console.error("Retake error:", err);
      alert("Could not reach the server.");
    }
  };

  const results: any[] = data?.results ?? [];
  // Ranks only make sense when everyone in the list sat the same paper.
  const showRank = selectedExam !== "All Exams";
  const colCount = 8 + (user.role === "admin" ? 1 : 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Examination Results & Rankings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submitted attempts, scored on the server
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-gray-500" />
          <span>Export Results CSV</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="text-xs font-medium text-gray-500 mb-1">Total Submissions</div>
          <div className="text-2xl font-extrabold text-gray-900">{data?.total ?? 0}</div>
          <div className="text-[11px] text-gray-400 mt-1">Matching the filters</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="text-xs font-medium text-gray-500 mb-1">In Progress Now</div>
          <div className="text-2xl font-extrabold text-amber-600">{data?.inProgress ?? 0}</div>
          <div className="text-[11px] text-gray-400 mt-1">Students currently writing</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="text-xs font-medium text-gray-500 mb-1">Top Score</div>
          <div className="text-2xl font-extrabold text-emerald-600">
            {data?.top != null ? `${data.top}%` : "N/A"}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Highest percentage</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="text-xs font-medium text-gray-500 mb-1">Average Score</div>
          <div className="text-2xl font-extrabold text-[#287FC1]">
            {data?.average != null ? `${data.average.toFixed(1)}%` : "N/A"}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Across these submissions</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Exam Select */}
        <div className="relative min-w-[220px]">
          <select
            aria-label="Filter by exam"
            value={selectedExam}
            onChange={(e) => {
              setSelectedExam(e.target.value);
              setPage(1);
            }}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer"
          >
            <option value="All Exams">All Exams</option>
            {(data?.exams ?? []).map((ex: any) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Batch Select */}
        <div className="relative min-w-[180px]">
          <select
            aria-label="Filter by batch"
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              setPage(1);
            }}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer"
          >
            {(data?.batches ?? ["All Batches"]).map((b: string) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by student or test..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg pl-9 pr-4 py-2 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs"
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-14 text-center">{showRank ? "Rank" : "#"}</th>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Batch</th>
                <th className="py-3.5 px-4">Exam</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Percentage</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4">Submitted</th>
                {user.role === "admin" && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {results.map((att) => (
                <tr key={att.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 text-center font-bold text-gray-600">{att.rank}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-900">{att.studentName}</div>
                    <div className="font-mono text-xs text-[#287FC1]">{att.studentId}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{att.batch}</td>
                  <td className="py-3 px-4 font-medium text-gray-800">{att.examTitle}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                    {att.result.score} / {att.result.maxScore}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        att.result.percentage >= 75
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : att.result.percentage >= 50
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {att.result.percentage}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs font-mono">
                    {formatDuration(att.result.timeTakenSeconds)}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    <div className="font-mono">
                      {new Date(att.submittedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </div>
                    {att.submitType === "time_up" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                        <Clock className="w-3.5 h-3.5" />
                        Time ran out
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        By student
                      </span>
                    )}
                  </td>
                  {user.role === "admin" && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleAllowRetake(att)}
                        title="Delete this result and allow a retake"
                        className="inline-flex items-center gap-1 p-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retake
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {results.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center text-gray-400 text-sm">
                    {loading
                      ? "Loading results..."
                      : loadFailed
                      ? "Could not load results. Please refresh the page."
                      : "No results found for the selected filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="py-3.5 px-6 border-t border-gray-200 bg-[#f8fafc] flex items-center justify-between text-xs text-gray-600">
            <span>Page {data.page} of {data.totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
