"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Clock,
  Target,
  Search,
  ExternalLink,
  Edit3,
  Trash2,
  RotateCw,
  X
} from "lucide-react";

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
  cameraProctoring?: boolean;
  difficulty?: string;
  attempts?: number;
  avgScore?: number;
  completion?: number;
}

export default function AdminExaminationsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState("All Batches");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Exam Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBatch, setNewBatch] = useState("12th JEE RRTS");
  const [newSubject, setNewSubject] = useState("Physics + Chemistry + Mathematics");
  const [newDuration, setNewDuration] = useState(180);
  const [newCamera, setNewCamera] = useState(true);
  const [creating, setCreating] = useState(false);

  const batches = [
    "All Batches",
    "12th JEE RRTS",
    "AS 12th CET 26-27",
    "RE-NEET 2026",
    "IN 12th CET 26-27",
    "AS Outer Crash 2026",
    "Testing"
  ];

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        selectedBatch === "All Batches"
          ? "/api/exams"
          : `/api/exams?batch=${encodeURIComponent(selectedBatch)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.exams) {
        setExams(data.exams);
      }
    } catch (err) {
      console.error("Failed to load exams:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBatch]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          batch: newBatch,
          subject: newSubject,
          duration: Number(newDuration),
          cameraProctoring: newCamera,
          questions: []
        })
      });
      const data = await res.json();
      if (data.success && data.exam) {
        setShowCreateModal(false);
        setNewTitle("");
        // New exams are drafts, so go straight to adding questions.
        router.push(`/admin/exams/${data.exam.id}`);
      } else {
        alert(data.error || "Could not create the exam.");
      }
    } catch (err) {
      console.error("Failed to create exam:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteExam = async (examId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Could not delete this exam.");
        return;
      }
      setExams((prev) => prev.filter((e) => e.id !== examId && e._id !== examId));
    } catch (err) {
      console.error("Failed to delete exam:", err);
    }
  };

  const filteredExams = exams.filter((e) => {
    if (searchQuery.trim()) {
      return (
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Examinations & Online CBT Tests
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure, manage questions, and schedule assessments for specific student batches
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create New Examination
        </button>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Batch pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {batches.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBatch(b)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                selectedBatch === b
                  ? "bg-[#287FC1] text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
          />
        </div>
      </div>

      {/* ── EXAM CARDS LIST ── */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#287FC1]" />
            <p className="text-xs">Loading examinations...</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <h3 className="text-sm font-bold text-gray-700">No Examinations Found</h3>
            <p className="text-xs text-gray-500 mt-1">
              Create an exam or select a different batch filter above.
            </p>
          </div>
        ) : (
          filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              {/* Left Info */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {exam.status === "published" || exam.status === "available" ? (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded border border-emerald-100">
                      Published
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2.5 py-0.5 rounded border border-gray-200">
                      Draft: students can&apos;t see this
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                      exam.cameraProctoring
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    📷 Camera {exam.cameraProctoring ? "On" : "Off"}
                  </span>
                  <span className="text-xs bg-blue-50 text-[#287FC1] font-semibold px-2.5 py-0.5 rounded border border-blue-100">
                    {exam.subject}
                  </span>
                  <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-0.5 rounded border border-purple-100">
                    Batch: {exam.batch}
                  </span>
                  <span className="text-xs text-gray-400">• Created {exam.created}</span>
                </div>

                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  {exam.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{exam.duration} mins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-gray-400" />
                    <span>{exam.totalMarks} Marks</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-semibold text-gray-700">
                      {exam.totalQuestions || 0} Questions
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Stats & Action Buttons */}
              <div className="flex items-center gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                <div className="text-center pr-3 border-r border-gray-100">
                  <div className="text-base font-bold text-[#287FC1]">
                    {exam.attempts || 0}
                  </div>
                  <div className="text-[11px] text-gray-400">Attempts</div>
                </div>

                <div className="text-center pr-3 border-r border-gray-100">
                  <div className="text-base font-bold text-emerald-600">
                    {(exam.avgScore || 0).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-gray-400">Class Avg</div>
                </div>

                {/* Manage Questions button matching screenshot */}
                <Link
                  href={`/admin/exams/${exam.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Manage Questions
                </Link>

                {/* Preview student CBT test */}
                <Link
                  href={`/exam/${exam.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview CBT
                </Link>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Exam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── MODAL: CREATE NEW EXAMINATION ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">
                Create New Examination
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Creates a draft for a specific batch. On the next screen you can add questions, set the schedule and marking, and publish it.
            </p>

            <form onSubmit={handleCreateExam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Examination Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12CET Physics Test (18-10-2026)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assigned Batch (Only students in this batch will take this exam)
                </label>
                <select
                  value={newBatch}
                  onChange={(e) => setNewBatch(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                >
                  <option value="12th JEE RRTS">12th JEE RRTS</option>
                  <option value="AS 12th CET 26-27">AS 12th CET 26-27</option>
                  <option value="RE-NEET 2026">RE-NEET 2026</option>
                  <option value="IN 12th CET 26-27">IN 12th CET 26-27</option>
                  <option value="AS Outer Crash 2026">AS Outer Crash 2026</option>
                  <option value="Testing">Testing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject Stream
                </label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Physics + Chemistry + Mathematics">Physics + Chemistry + Mathematics</option>
                  <option value="Physics + Chemistry + Biology">Physics + Chemistry + Biology</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Biology">Biology</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={360}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCamera}
                  onChange={(e) => setNewCamera(e.target.checked)}
                  className="mt-0.5 accent-[#287FC1]"
                />
                <span>
                  <strong>Camera monitoring:</strong> students must allow their camera before starting, and flags are saved for review.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg shadow-xs disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create & Configure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}