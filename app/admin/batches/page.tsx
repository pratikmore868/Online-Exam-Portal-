"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Users2, ArrowRight, UserCheck, Calendar, BookOpen } from "lucide-react";

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/students?limit=5000")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.students) {
          const map: Record<string, number> = {};
          data.students.forEach((s: any) => {
            map[s.batch] = (map[s.batch] || 0) + 1;
          });
          const list = Object.entries(map).map(([name, count]) => ({ name, count }));
          setBatches(list.sort((a, b) => b.count - a.count));
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Batches & Classes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage academic batches, student distributions, and schedules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((batch) => (
          <div
            key={batch.name}
            className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs hover:border-[#287FC1] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-9 h-9 rounded-lg bg-blue-50 text-[#287FC1] flex items-center justify-center font-bold">
                  <Users2 className="w-5 h-5" />
                </span>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-100">
                  Active
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base">{batch.name}</h3>
              <p className="text-xs text-gray-500 mt-1">
                Academic Session 2026-2027
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">
                {batch.count} Enrolled Students
              </span>
              <Link
                href={`/admin/students?batch=${encodeURIComponent(batch.name)}`}
                className="text-xs font-semibold text-[#287FC1] hover:underline flex items-center gap-1"
              >
                <span>View Students</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
