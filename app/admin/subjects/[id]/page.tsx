"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  X,
  Check,
  BookOpen,
  Layers,
  Sparkles
} from "lucide-react";

interface ChapterDoc {
  _id?: string;
  id: string;
  subjectId: string;
  name: string;
  order: number;
  questionsCount: number;
  created: string;
  updated: string;
}

interface SubjectDoc {
  id: string;
  name: string;
  icon: string;
  color: string;
  chaptersCount: number;
  created: string;
  updated: string;
}

export default function SubjectChaptersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const subjectId = resolvedParams.id;

  const [subject, setSubject] = useState<SubjectDoc | null>(null);
  const [chapters, setChapters] = useState<ChapterDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"name-asc" | "name-desc" | "order-asc">("order-asc");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [editChapter, setEditChapter] = useState<ChapterDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch subject and chapters from MongoDB Atlas
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get Subject
      const subRes = await fetch(`/api/subjects/${subjectId}`);
      const subData = await subRes.json();
      if (subData.success) {
        setSubject(subData.subject);
      }

      // 2. Get Chapters
      const chRes = await fetch(`/api/chapters?subjectId=${subjectId}`);
      const chData = await chRes.json();
      if (chData.success) {
        setChapters(chData.chapters);
      }
    } catch (e) {
      console.error("Error loading chapters:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  // Filter and sort
  const filteredChapters = useMemo(() => {
    return chapters
      .filter((ch) => {
        const q = searchQuery.toLowerCase().trim();
        return !q || ch.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortOption === "name-asc") return a.name.localeCompare(b.name);
        if (sortOption === "name-desc") return b.name.localeCompare(a.name);
        return a.order - b.order;
      });
  }, [chapters, searchQuery, sortOption]);

  // Add Chapter to MongoDB Atlas
  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          name: newChapterName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setChapters((prev) => [...prev, data.chapter]);
        setNewChapterName("");
        setShowAddModal(false);
      }
    } catch (e) {
      console.error("Error adding chapter:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Chapter in MongoDB Atlas
  const handleUpdateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChapter || !editName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/chapters/${editChapter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setChapters((prev) =>
          prev.map((c) => (c.id === editChapter.id ? { ...c, name: editName.trim(), updated: "Nov 02, 2026" } : c))
        );
        setEditChapter(null);
      }
    } catch (e) {
      console.error("Error updating chapter:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Chapter from MongoDB Atlas
  const handleDeleteChapter = async (chapter: ChapterDoc) => {
    if (!confirm(`Are you sure you want to delete chapter "${chapter.name}"?`)) return;

    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setChapters((prev) => prev.filter((c) => c.id !== chapter.id));
      }
    } catch (e) {
      console.error("Error deleting chapter:", e);
    }
  };

  const subjectName = subject?.name || subjectId.charAt(0).toUpperCase() + subjectId.slice(1);
  const subjectColor = subject?.color || "#f59e0b";

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Back button link */}
      <div>
        <Link
          href="/admin/subjects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Subjects</span>
        </Link>
      </div>

      {/* Header matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Chapters in {subjectName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage chapters for {subjectName}.
          </p>
        </div>

        {/* Top Right '+ Add Chapter' Button matching Screenshot 1 */}
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Chapter</span>
        </button>
      </div>

      {/* Search & Sort Bar matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search chapters by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg pl-9 pr-4 py-2 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative min-w-[160px]">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer"
          >
            <option value="order-asc">Curriculum Order</option>
            <option value="name-asc">↑↓ A-Z Name</option>
            <option value="name-desc">↑↓ Z-A Name</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Subtitle counter matching Screenshot 1 */}
      <div className="text-sm font-medium text-gray-700">
        Total: {filteredChapters.length} chapters
      </div>

      {/* Chapters Table matching Screenshot 1 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Name</th>
                <th className="py-3.5 px-6">Created</th>
                <th className="py-3.5 px-6">Updated</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredChapters.map((chapter) => {
                return (
                  <tr
                    key={chapter.id}
                    className="hover:bg-blue-50/30 transition-colors relative"
                  >
                    {/* Chapter Name with left vertical color bar indicator */}
                    <td className="py-3.5 px-6 relative">
                      {/* Left indicator strip matching Screenshot 1 */}
                      <span
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md"
                        style={{ backgroundColor: subjectColor }}
                      />

                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {subject?.icon || "📖"}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {chapter.name}
                        </span>
                      </div>
                    </td>

                    {/* Created (latest date) */}
                    <td className="py-3.5 px-6 text-gray-500 font-medium text-xs font-mono">
                      {chapter.created || "Nov 02, 2026"}
                    </td>

                    {/* Updated (latest date) */}
                    <td className="py-3.5 px-6 text-gray-500 font-medium text-xs font-mono">
                      {chapter.updated || "Nov 02, 2026"}
                    </td>

                    {/* Actions: Edit icon (pencil) & Delete icon (red trash bin) matching Screenshot 1 */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit icon */}
                        <button
                          onClick={() => {
                            setEditChapter(chapter);
                            setEditName(chapter.name);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                          title="Edit Chapter"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete icon */}
                        <button
                          onClick={() => handleDeleteChapter(chapter)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Delete Chapter"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredChapters.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400 text-sm">
                    No chapters found matching your search.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400 text-sm">
                    Loading chapters from MongoDB Atlas...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Chapter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Add Chapter to {subjectName}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Add a new syllabus chapter stored directly in MongoDB Atlas.
            </p>

            <form onSubmit={handleAddChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Chapter Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wave Optics & Polarization"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newChapterName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Add Chapter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chapter Modal */}
      {editChapter && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Edit Chapter Name
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Update chapter title in MongoDB Atlas.
            </p>

            <form onSubmit={handleUpdateChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Chapter Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditChapter(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
