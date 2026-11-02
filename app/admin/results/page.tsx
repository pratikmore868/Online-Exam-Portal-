"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Download,
  RefreshCw,
  ArrowUpDown,
  X,
  Users,
  Target,
  TrendingUp,
  Zap,
  Clock,
  Activity,
  ListOrdered,
  Trophy
} from "lucide-react";
import { submitTypeLabel } from "@/lib/proctoring";

const PAGE_SIZE = 50;

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  valueClass: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <Icon className={`w-4 h-4 ${valueClass}`} />
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

const selectClass =
  "w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm rounded-lg px-3.5 py-2.5 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer";

export default function AdminResultsPage() {
  const [selectedExam, setSelectedExam] = useState("All Exams");
  const [selectedBatch, setSelectedBatch] = useState("All Batches");
  const [sortKey, setSortKey] = useState("rank");
  const [reversed, setReversed] = useState(false);
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

  const buildParams = useCallback(
    (forPage: number, limit: number) => {
      const params = new URLSearchParams({ page: String(forPage), limit: String(limit), sort: sortKey, dir: reversed ? "desc" : "asc" });
      if (selectedExam !== "All Exams") params.set("examId", selectedExam);
      if (selectedBatch !== "All Batches") params.set("batch", selectedBatch);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      return params;
    },
    [selectedExam, selectedBatch, debouncedSearch, sortKey, reversed]
  );

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/results?${buildParams(page, PAGE_SIZE).toString()}`);
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
  }, [buildParams, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Exports every matching row, not just this page. Excel opens CSV files directly.
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/results?${buildParams(1, 5000).toString()}`);
      const body = await res.json();
      if (!body.success) {
        alert(body.error || "Could not export results.");
        return;
      }

      const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const headers = ["Rank", "Student ID", "Student Name", "Batch", "Exam Title", "Score", "Max Score", "Percentage", "Percentile", "Accuracy", "Correct", "Wrong", "Unattempted", "Time Taken (min)", "Submitted", "Submission Type", "Warnings"];
      const rows = body.results.map((a: any) => [
        a.rank,
        a.studentId,
        a.studentName,
        a.batch,
        a.examTitle,
        a.result.score,
        a.result.maxScore,
        a.result.percentage,
        a.percentile,
        a.accuracy,
        a.result.correct,
        a.result.incorrect,
        a.result.unanswered,
        Math.round(a.result.timeTakenSeconds / 60),
        new Date(a.submittedAt).toLocaleString("en-IN"),
        submitTypeLabel(a.submitType),
        a.violationCount ?? 0,
      ].map(quote).join(","));

      // The leading BOM makes Excel read Hindi and Marathi names correctly.
      const url = URL.createObjectURL(new Blob(["﻿" + [headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
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

  const results: any[] = data?.results ?? [];
  const exams: any[] = data?.exams ?? [];
  const exam = exams.find((e) => e.id === selectedExam);
  const hasFilters = selectedExam !== "All Exams" || selectedBatch !== "All Batches" || !!searchQuery;

  const clearFilters = () => {
    setSelectedExam("All Exams");
    setSelectedBatch("All Batches");
    setSearchQuery("");
    setPage(1);
  };

  // Raw marks only compare fairly within one paper, so "All Exams" uses percentages.
  const averageValue = exam
    ? (data?.averageScore != null ? data.averageScore.toFixed(1) : "—")
    : (data?.average != null ? `${data.average.toFixed(1)}%` : "—");
  const averageSub = exam && data?.averageScore != null && data.topScore > 0
    ? `${((data.averageScore / data.topScore) * 100).toFixed(1)}% of top score`
    : "Across these submissions";
  const highestValue = exam
    ? (data?.topScore ?? "—")
    : (data?.top != null ? `${data.top}%` : "—");

  return (
    <div className="p-8 max-w-[1500px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and analyze exam results</p>
        </div>
        <button
          onClick={fetchResults}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
        <div>
          <label htmlFor="filter-batch" className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
          <div className="relative">
            <select
              id="filter-batch"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setPage(1);
              }}
              className={selectClass}
            >
              {(data?.batches ?? ["All Batches"]).map((b: string) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="filter-exam" className="block text-sm font-medium text-gray-700 mb-1.5">Exam</label>
          <div className="relative">
            <select
              id="filter-exam"
              value={selectedExam}
              onChange={(e) => {
                setSelectedExam(e.target.value);
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="All Exams">All Exams</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.title}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {exam && (
            <p className="text-xs text-gray-500 mt-1">{exam.totalMarks} marks • {exam.duration} min</p>
          )}
        </div>

        <div>
          <label htmlFor="filter-search" className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="filter-search"
              type="text"
              placeholder="Student name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg pl-9 pr-4 py-2.5 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs"
            />
          </div>
        </div>

        <div>
          <label htmlFor="filter-sort" className="block text-sm font-medium text-gray-700 mb-1.5">Sort Results</label>
          <div className="flex gap-2">
            <button
              onClick={() => setReversed((prev) => !prev)}
              title="Reverse the order"
              aria-label="Reverse the order"
              aria-pressed={reversed}
              className="inline-flex items-center px-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 shadow-xs cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <div className="relative flex-1">
              <select
                id="filter-sort"
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value);
                  setPage(1);
                }}
                className={selectClass}
              >
                <option value="rank">Rank</option>
                <option value="name">Name</option>
                <option value="time">Time Taken</option>
                <option value="submitted">Latest Submitted</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-sm text-gray-500">Active filters:</span>
          {selectedBatch !== "All Batches" && (
            <button onClick={() => setSelectedBatch("All Batches")} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg font-medium text-gray-800 cursor-pointer">
              Batch: {selectedBatch} <X className="w-3 h-3" />
            </button>
          )}
          {exam && (
            <button onClick={() => setSelectedExam("All Exams")} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg font-medium text-gray-800 cursor-pointer">
              Exam: {exam.title} <X className="w-3 h-3" />
            </button>
          )}
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg font-medium text-gray-800 cursor-pointer">
              Search: {searchQuery} <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg font-medium text-gray-800 hover:bg-gray-50 cursor-pointer">
            <X className="w-3 h-3" /> Clear All
          </button>
        </div>
      )}

      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{exam ? `${exam.title} Results` : "All Exam Results"}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {data?.students ?? 0} student{data?.students === 1 ? "" : "s"} participated
          {data?.inProgress > 0 ? ` • ${data.inProgress} writing now` : ""}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Students" value={data?.students ?? 0} sub={`${data?.total ?? 0} total attempts`} icon={Users} valueClass="text-blue-600" />
        <StatCard label="Average Score" value={averageValue} sub={averageSub} icon={Target} valueClass="text-purple-600" />
        <StatCard
          label="Pass Rate"
          value={data?.passRate != null ? `${data.passRate.toFixed(1)}%` : "—"}
          sub={`Students scoring ≥${data?.passPercentage ?? 60}%`}
          icon={TrendingUp}
          valueClass="text-red-600"
        />
        <StatCard label="Highest Score" value={highestValue} sub="Best performance" icon={Zap} valueClass="text-amber-600" />
        <StatCard
          label="Average Time"
          value={data?.averageTime != null ? formatDuration(data.averageTime) : "—"}
          sub="Time per student"
          icon={Clock}
          valueClass="text-orange-600"
        />
        <StatCard
          label="Participation"
          value={data?.participation?.assigned > 0
            ? `${Math.min(100, (data.participation.submitted / data.participation.assigned) * 100).toFixed(1)}%`
            : "—"}
          sub={data?.participation
            ? `${data.participation.submitted} of ${data.participation.assigned} students`
            : "Select an exam to see this"}
          icon={Activity}
          valueClass="text-green-600"
        />
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">Student Results</h3>
            <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 rounded-md text-gray-700">{data?.total ?? 0} results</span>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-gray-200 text-sm font-medium text-gray-700">
              <tr>
                <th className="py-3 px-5">Rank</th>
                <th className="py-3 px-4">Student</th>
                {!exam && <th className="py-3 px-4">Exam</th>}
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Percentile</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Submission Type</th>
                <th className="py-3 px-5 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {results.map((att) => (
                <tr key={att.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      {att.rank <= 3 && (
                        <Trophy className={`w-4 h-4 ${att.rank === 1 ? "text-amber-500" : att.rank === 2 ? "text-gray-400" : "text-orange-400"}`} />
                      )}
                      {att.rank}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-gray-900">{att.studentName}</div>
                    <div className="text-xs text-gray-500">ID: {att.studentId} • {att.batch}</div>
                  </td>
                  {!exam && <td className="py-3.5 px-4 text-xs text-gray-700 max-w-[220px]">{att.examTitle}</td>}
                  <td className="py-3.5 px-4">
                    <div className="font-medium">{att.result.score} / {att.result.maxScore}</div>
                    <div className="text-xs text-gray-500">{att.result.percentage}%</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium">{att.percentile}</td>
                  <td className="py-3.5 px-4">{att.accuracy}%</td>
                  <td className="py-3.5 px-4">{formatDuration(att.result.timeTakenSeconds)}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        att.submitType === "violations"
                          ? "bg-red-50 text-red-800 border-red-200"
                          : att.submitType === "time_up"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {submitTypeLabel(att.submitType)}
                    </span>
                    {att.violationCount > 0 && att.submitType !== "violations" && (
                      <div className="text-xs text-red-700 mt-1">⚠ {att.violationCount} warning{att.violationCount === 1 ? "" : "s"}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <Link
                      href={`/admin/results/${att.id}`}
                      aria-label={`View details for ${att.studentName}`}
                      title="View details"
                      className="inline-flex p-2 text-gray-600 hover:text-[#287FC1] hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}

              {results.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
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
