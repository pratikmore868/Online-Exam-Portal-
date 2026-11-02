"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Menu,
  Plus,
  Trash2,
  Edit2,
  X,
  BookOpen,
  ArrowRight
} from "lucide-react";

interface SubjectItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  chaptersCount: number;
  questionsCount: number;
  created: string;
  updated: string;
}

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"name-asc" | "name-desc" | "chapters-desc">("name-asc");

  // Modals
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#3b82f6");
  const [newSubjectIcon, setNewSubjectIcon] = useState("📚");

  const [editSubject, setEditSubject] = useState<SubjectItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (data.success) {
        setSubjects(data.subjects);
      }
    } catch (e) {
      console.error("Error loading subjects from MongoDB Atlas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  // Filter & sort
  const filteredSubjects = useMemo(() => {
    return subjects
      .filter((s) => {
        const q = searchQuery.toLowerCase().trim();
        return !q || s.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortOption === "name-asc") return a.name.localeCompare(b.name);
        if (sortOption === "name-desc") return b.name.localeCompare(a.name);
        if (sortOption === "chapters-desc") return b.chaptersCount - a.chaptersCount;
        return 0;
      });
  }, [subjects, searchQuery, sortOption]);

  // Add subject to MongoDB Atlas
  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          color: newSubjectColor,
          icon: newSubjectIcon
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubjects((prev) => [...prev, data.subject]);
        setNewSubjectName("");
        setShowAddSubjectModal(false);
      }
    } catch (e) {
      console.error("Error creating subject:", e);
    }
  };

  // Edit subject in MongoDB Atlas
  const handleEditSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject || !editName.trim()) return;

    try {
      const res = await fetch(`/api/subjects/${editSubject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
          icon: editIcon
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === editSubject.id ? { ...s, ...data.subject } : s))
        );
        setEditSubject(null);
      }
    } catch (e) {
      console.error("Error updating subject:", e);
    }
  };

  // Delete subject from MongoDB Atlas
  const handleDeleteSubject = async (subject: SubjectItem) => {
    if (!confirm(`Are you sure you want to delete subject "${subject.name}" and all its chapters?`)) return;

    try {
      const res = await fetch(`/api/subjects/${subject.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
      }
    } catch (e) {
      console.error("Error deleting subject:", e);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      {/* Header matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Subjects
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage subjects and their chapters. Each subject can contain multiple chapters for better organization.
          </p>
        </div>

        {/* Top Right '+ Add Subject' button matching Screenshot 2 */}
        <button
          onClick={() => setShowAddSubjectModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Search & Sort Bar matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search subjects by name..."
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
            <option value="name-asc">↑↓ A-Z Name</option>
            <option value="name-desc">↑↓ Z-A Name</option>
            <option value="chapters-desc">↑↓ Most Chapters</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Subtitle count matching Screenshot 2 */}
      <div className="text-sm font-medium text-gray-700">
        Total: {filteredSubjects.length} subjects
      </div>

      {/* Table matching Screenshot 2 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Name</th>
                <th className="py-3.5 px-6">Chapters</th>
                <th className="py-3.5 px-6">Created</th>
                <th className="py-3.5 px-6">Updated</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredSubjects.map((subject) => {
                return (
                  <tr
                    key={subject.id}
                    className="hover:bg-blue-50/30 transition-colors relative"
                  >
                    {/* Name column with left vertical color bar indicator */}
                    <td className="py-4 px-6 relative">
                      {/* Left color bar indicator matching Screenshot 2 */}
                      <span
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md"
                        style={{ backgroundColor: subject.color }}
                      />

                      <div className="flex items-center gap-3">
                        <span className="text-xl" title={subject.name}>
                          {subject.icon}
                        </span>
                        <Link
                          href={`/admin/subjects/${subject.id}`}
                          className="font-semibold text-gray-900 hover:text-[#287FC1] hover:underline"
                        >
                          {subject.name}
                        </Link>
                      </div>
                    </td>

                    {/* Chapters badge (blue pill) matching Screenshot 2 */}
                    <td className="py-4 px-6">
                      <Link href={`/admin/subjects/${subject.id}`}>
                        <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-md bg-[#287FC1] text-white hover:bg-[#1a5f94] transition-colors">
                          {subject.chaptersCount}
                        </span>
                      </Link>
                    </td>

                    {/* Created (latest date) */}
                    <td className="py-4 px-6 text-gray-500 font-medium text-xs font-mono">
                      {subject.created || "Oct 28, 2026"}
                    </td>

                    {/* Updated (latest date) */}
                    <td className="py-4 px-6 text-gray-500 font-medium text-xs font-mono">
                      {subject.updated || "Nov 02, 2026"}
                    </td>

                    {/* Actions: Menu '≡', Edit, and Delete matching Screenshot 2 */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* ≡ Menu icon linking to chapters view */}
                        <Link
                          href={`/admin/subjects/${subject.id}`}
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                          title="Manage Chapters"
                        >
                          <Menu className="w-5 h-5" />
                        </Link>

                        {/* Edit icon */}
                        <button
                          onClick={() => {
                            setEditSubject(subject);
                            setEditName(subject.name);
                            setEditColor(subject.color);
                            setEditIcon(subject.icon);
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                          title="Edit Subject"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete icon */}
                        <button
                          onClick={() => handleDeleteSubject(subject)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Delete Subject"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSubjects.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                    No subjects found.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                    Loading subjects from MongoDB Atlas...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Add New Subject
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Create a new subject curriculum category in MongoDB Atlas.
            </p>

            <form onSubmit={handleAddSubjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject Icon Emoji
                </label>
                <div className="flex gap-2">
                  {["🧬", "🧪", "📖", "➗", "⚛️", "💻", "🔬", "🎯"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewSubjectIcon(emoji)}
                      className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                        newSubjectIcon === emoji
                          ? "border-[#287FC1] bg-blue-50 scale-105"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  {[
                    "#f59e0b", // Yellow (Biology)
                    "#3b82f6", // Blue (Chemistry)
                    "#1d4ed8", // Deep Blue (Foundation)
                    "#22c55e", // Green (Mathematics)
                    "#ef4444", // Red (Physics)
                    "#8b5cf6"  // Purple
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSubjectColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        newSubjectColor === color ? "ring-2 ring-offset-2 ring-[#287FC1] scale-110" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors cursor-pointer"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {editSubject && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Edit Subject
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Update subject details in MongoDB Atlas.
            </p>

            <form onSubmit={handleEditSubjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Icon
                </label>
                <div className="flex gap-2">
                  {["🧬", "🧪", "📖", "➗", "⚛️", "💻", "🔬", "🎯"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditIcon(emoji)}
                      className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                        editIcon === emoji
                          ? "border-[#287FC1] bg-blue-50 scale-105"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  {[
                    "#f59e0b",
                    "#3b82f6",
                    "#1d4ed8",
                    "#22c55e",
                    "#ef4444",
                    "#8b5cf6"
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        editColor === color ? "ring-2 ring-offset-2 ring-[#287FC1] scale-110" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditSubject(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
