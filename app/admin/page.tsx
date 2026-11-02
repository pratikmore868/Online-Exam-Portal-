"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  TrendingUp,
  BarChart3,
  Clock,
  Award,
  AlertCircle,
  FileText,
  BookOpen,
  Plus
} from "lucide-react";

function StudentRanking({ rows, tone }: { rows: any[]; tone: string }) {
  if (rows.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-sm text-gray-400">
        No data available
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-none">
          <div>
            <div className="font-semibold text-gray-800">{s.name}</div>
            <div className="text-gray-400">{s.batch} • {s.exams} exam{s.exams === 1 ? "" : "s"}</div>
          </div>
          <span className={`font-bold ${tone}`}>{s.average.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminTeacherDashboard() {
  const router = useRouter();

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    newThisWeek: 0,
    avgPerformance: 0.0,
    recentActivity: 0,
    completionRate: 0.0,
    classAverage: 0.0,
    topPerformers: [] as any[],
    needsAttention: [] as any[],
    recentExams: [] as any[],
    questionBank: {
      total: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      bySubject: {
        Chemistry: 0,
        Physics: 0,
        Biology: 0,
        Mathematics: 0,
        Foundation: 0
      }
    }
  });

  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamSubject, setNewExamSubject] = useState("Physics + Chemistry + Math");

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch((err) => console.error("Error loading stats:", err));
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim()) return;

    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newExamTitle.trim(), subject: newExamSubject })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Could not create the exam.");
        return;
      }
      // New exams are drafts, so go straight to adding questions.
      router.push(`/admin/exams/${data.exam.id}`);
    } catch (err) {
      console.error("Failed to create exam:", err);
      alert("Could not reach the server.");
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Teacher Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Student performance and teaching insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateExamModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] rounded-lg hover:bg-[#1a5f94] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Exam</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Student Overview - 4 Stat Cards matching Screenshot 1 */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3.5">
          Student Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Students */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium text-[#287FC1] mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#287FC1]" />
              </div>
              <span className="text-gray-600 font-medium text-xs">Total Students</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.totalStudents.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.activeStudents.toLocaleString()} active
            </div>
          </div>

          {/* Card 2: New This Week */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-gray-600 font-medium text-xs">New This Week</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.newThisWeek}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              New registrations
            </div>
          </div>

          {/* Card 3: Avg Performance */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 mb-3">
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-600 font-medium text-xs">Avg Performance</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.avgPerformance.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Class average
            </div>
          </div>

          {/* Card 4: Recent Activity */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-600 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-gray-600 font-medium text-xs">Recent Activity</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.recentActivity}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Exam attempts this week
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Top Performers & Needs Attention matching Screenshot 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performers */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Top Performers</h3>
          </div>
          <StudentRanking rows={stats.topPerformers} tone="text-emerald-600" />
        </div>

        {/* Needs Attention */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">Needs Attention</h3>
          </div>
          <StudentRanking rows={stats.needsAttention} tone="text-red-500" />
        </div>
      </div>

      {/* SECTION 3: Recent Exams matching Screenshots 1 & 2 */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Exams
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Showing {stats.recentExams.length} assessments
          </span>
        </div>

        <div className="space-y-3">
          {stats.recentExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>
                <h4 className="text-base font-semibold text-gray-900">
                  {exam.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Created on {exam.created}
                </p>
              </div>

              {/* Stats on the right: Attempts (blue), Avg Score (green), Completion (purple) */}
              <div className="flex items-center gap-6 self-start sm:self-center">
                <div className="text-center">
                  <div className="text-lg font-bold text-[#287FC1]">
                    {exam.attempts}
                  </div>
                  <div className="text-xs text-gray-400">Attempts</div>
                </div>

                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">
                    {exam.avgScore.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">Avg Score</div>
                </div>

                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {exam.completion.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">Completion</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: Question Bank Analytics matching Screenshot 3 */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3.5">
          Question Bank Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Card: Total Questions + Easy/Medium/Hard pills */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-[#287FC1] mb-4">
              <FileText className="w-4 h-4 text-[#287FC1]" />
              <span className="text-gray-700 font-medium text-xs">Total Questions</span>
            </div>
            <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {stats.questionBank.total.toLocaleString()}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs font-medium">
              <span className="text-emerald-600">
                Easy: {stats.questionBank.easy.toLocaleString()}
              </span>
              <span className="text-amber-500">
                Medium: {stats.questionBank.medium.toLocaleString()}
              </span>
              <span className="text-red-500">
                Hard: {stats.questionBank.hard.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right Card: By Subject list */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 mb-4">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span className="text-gray-700 font-medium text-xs">By Subject</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(stats.questionBank.bySubject).map(([subjectName, count]) => (
                <div
                  key={subjectName}
                  className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-none"
                >
                  <span className="text-gray-700 font-medium">{subjectName}</span>
                  <span className="font-semibold text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: Performance Summary matching Screenshot 3 */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3.5">
          Performance Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Completion Rate */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-xs">
            <div className="text-xs font-medium text-gray-700 mb-2">
              Completion Rate
            </div>
            <div className="text-3xl font-extrabold text-[#287FC1] tracking-tight">
              {stats.completionRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Students completing exams
            </div>
          </div>

          {/* Card 2: Class Average */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/90 shadow-xs">
            <div className="text-xs font-medium text-gray-700 mb-2">
              Class Average
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">
              {stats.classAverage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Overall performance score
            </div>
          </div>
        </div>
      </div>

      {/* Create Exam Modal */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Create New Assessment
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Creates a draft. You can add questions and publish it on the next screen.
            </p>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12th JEE RRTS PCM Test 10"
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject / Stream
                </label>
                <select
                  value={newExamSubject}
                  onChange={(e) => setNewExamSubject(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                >
                  <option value="Physics + Chemistry + Math">Physics + Chemistry + Math (JEE)</option>
                  <option value="Physics + Chemistry + Biology">Physics + Chemistry + Biology (NEET)</option>
                  <option value="Physics">Physics Special</option>
                  <option value="Chemistry">Chemistry Special</option>
                  <option value="Mathematics">Mathematics Special</option>
                  <option value="Biology">Biology Special</option>
                  <option value="MHT-CET Combined">MHT-CET Combined</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors cursor-pointer"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
