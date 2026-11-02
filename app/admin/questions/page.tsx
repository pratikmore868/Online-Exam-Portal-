"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, RotateCw, Upload } from "lucide-react";

export default function AdminQuestionsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubjects(data.subjects);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Question Bank Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose a subject to see its questions
          </p>
        </div>
        <Link
          href="/admin/questions/bulk-import"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg shadow-xs"
        >
          <Upload className="w-4 h-4" />
          Bulk Import
        </Link>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
          <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#287FC1]" />
          <p className="text-sm">Loading subjects...</p>
        </div>
      )}

      {loadFailed && (
        <div className="p-12 text-center text-sm text-red-700 bg-white rounded-xl border border-gray-200">
          Could not load subjects. Please refresh the page.
        </div>
      )}

      {!loading && !loadFailed && subjects.length === 0 && (
        <div className="p-12 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
          No subjects yet. Add one on the Subjects page.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sub) => (
          <Link
            key={sub.id}
            href={`/admin/questions/${encodeURIComponent(sub.id)}`}
            className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-[#287FC1] hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{sub.icon}</span>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">{sub.name}</h2>
                  <p className="text-xs text-gray-500 font-mono">{sub.chaptersCount} Chapters</p>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#287FC1] mt-2">
                {sub.questionsCount.toLocaleString()}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {sub.questionsCount === 1 ? "Question" : "Questions"}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-[#287FC1]">
              <span>View Questions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
