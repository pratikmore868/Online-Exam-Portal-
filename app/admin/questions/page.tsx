"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HelpCircle, BookOpen, Layers, Plus, ArrowRight } from "lucide-react";

export default function AdminQuestionsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSubjects(data.subjects);
        }
      });
  }, []);

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Question Bank Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Curate questions, difficulty distributions, and syllabus questions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sub) => (
          <div
            key={sub.id}
            className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{sub.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{sub.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{sub.chaptersCount} Chapters</p>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#287FC1] mt-2">
                {sub.questionsCount?.toLocaleString() || "1,500+"}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Curated Questions</p>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <Link
                href={`/admin/subjects/${sub.id}`}
                className="text-xs font-semibold text-[#287FC1] hover:underline flex items-center gap-1"
              >
                <span>Browse Chapters</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
