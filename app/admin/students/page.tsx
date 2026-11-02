"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Search,
  ChevronDown,
  Copy,
  History,
  KeyRound,
  Check,
  Plus,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";
import { friendlyDay } from "@/lib/dates";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  batch: string;
  dob: string;
  created: string;
  status: "active" | "inactive";
}

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  // MongoDB Atlas dynamic state
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [batches, setBatches] = useState<string[]>(["All Batches"]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [selectedBatch, setSelectedBatch] = useState<string>("All Batches");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortOption, setSortOption] = useState<"name-asc" | "name-desc" | "created-desc" | "id-asc">("name-asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selection & Modals
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [resetModalStudent, setResetModalStudent] = useState<{ id: string; name: string } | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [issuingPasswords, setIssuingPasswords] = useState(false);

  // Add student form
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentBatch, setNewStudentBatch] = useState("Testing");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load students from MongoDB Atlas API
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sort: sortOption
      });
      if (selectedBatch && selectedBatch !== "All Batches") {
        params.append("batch", selectedBatch);
      }
      if (debouncedSearch) {
        params.append("q", debouncedSearch);
      }

      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        setTotalStudents(data.total);
        if (data.batches) {
          setBatches(data.batches);
        }
      }
    } catch (e) {
      console.error("Error fetching students from MongoDB Atlas:", e);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, sortOption, selectedBatch, debouncedSearch]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const totalPages = Math.ceil(totalStudents / pageSize) || 1;

  // Copy to clipboard
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Selection handlers
  const handleSelectAllOnPage = () => {
    const pageIds = students.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export CSV
  const handleExportCSV = async () => {
    // Fetch all matching students for CSV
    const params = new URLSearchParams({
      page: "1",
      limit: "5000",
      sort: sortOption
    });
    if (selectedBatch && selectedBatch !== "All Batches") {
      params.append("batch", selectedBatch);
    }
    if (debouncedSearch) {
      params.append("q", debouncedSearch);
    }

    try {
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      const exportList: Student[] = data.success ? data.students : students;

      const headers = ["Student ID", "Name", "Email", "Phone", "Batch", "DOB", "Created Date", "Status"];
      const rows = exportList.map((s) => [
        s.id,
        `"${s.name}"`,
        s.email,
        s.phone,
        `"${s.batch}"`,
        s.dob,
        s.created,
        s.status
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ram_raj_students_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  // Add student submit to MongoDB Atlas
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentPhone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStudentName.trim(),
          phone: newStudentPhone.trim(),
          batch: newStudentBatch,
          email: newStudentEmail.trim() || "-"
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewStudentName("");
        setNewStudentPhone("");
        setNewStudentEmail("");
        setShowAddStudentModal(false);
        fetchStudents();
        // Shown once, so staff can hand it to the student.
        setResetModalStudent({ id: data.student.id, name: data.student.name });
        setGeneratedPassword(data.tempPassword);
      } else {
        alert(data.error || "Could not add the student.");
      }
    } catch (e) {
      console.error("Add student error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Delete in MongoDB Atlas
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedStudentIds.length} students from the database?`)) return;

    try {
      const res = await fetch("/api/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedStudentIds })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedStudentIds([]);
        fetchStudents();
      } else {
        alert(data.error || "Could not delete these students.");
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const handleResetPassword = async (student: Student) => {
    if (!confirm(`Reset the password for ${student.name}? Their old password will stop working and they will be logged out.`)) return;

    try {
      const res = await fetch(`/api/students/${encodeURIComponent(student.id)}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Could not reset the password.");
        return;
      }
      setResetModalStudent(student);
      setGeneratedPassword(data.tempPassword);
    } catch (e) {
      console.error("Reset password error:", e);
      alert("Could not reach the server.");
    }
  };

  const handleOpenHistory = async (student: Student) => {
    setHistoryStudent(student);
    setHistory(null);
    try {
      const res = await fetch(`/api/results?studentId=${encodeURIComponent(student.id)}&limit=200`);
      const data = await res.json();
      setHistory(data.success ? data.results : []);
    } catch (e) {
      console.error("History error:", e);
      setHistory([]);
    }
  };

  // Gives first-time passwords to everyone in the selected batch who has none, and downloads them as a CSV.
  const handleIssuePasswords = async () => {
    if (!confirm(`Create first-time passwords for students in "${selectedBatch}" who don't have one yet? Students who already have a password are not affected.\n\nA CSV with the passwords will download. Keep it private and delete it after handing the passwords out.`)) return;

    setIssuingPasswords(true);
    const issued: any[] = [];
    try {
      // The server issues a limited number per request.
      for (;;) {
        const res = await fetch("/api/students/issue-passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: selectedBatch })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || "Could not issue passwords.");
          break;
        }
        issued.push(...data.issued);
        if (data.remaining === 0 || data.issued.length === 0) break;
      }
    } catch (e) {
      console.error("Issue passwords error:", e);
      alert("The connection was lost. Any passwords created so far are in the download; run this again for the rest.");
    } finally {
      setIssuingPasswords(false);
    }

    if (issued.length === 0) {
      alert("Every student in this batch already has a password.");
      return;
    }

    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "Student ID,Name,Batch,Phone,Temporary Password",
      ...issued.map((s) => [s.id, s.name, s.batch, s.phone, s.tempPassword].map(quote).join(","))
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ram_raj_student_passwords_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(`Created passwords for ${issued.length} student(s). The CSV has been downloaded.`);
  };

  return (
    <div className="p-8 max-w-[1500px] mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {copiedId && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Copied Student ID <strong>{copiedId}</strong> to clipboard!</span>
        </div>
      )}

      {/* Header matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Students
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage student accounts and batches
          </p>
        </div>

        {/* Action Buttons matching Screenshot 4 */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleIssuePasswords}
              disabled={issuingPasswords}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Create first-time passwords for the selected batch"
            >
              <KeyRound className="w-4 h-4 text-gray-500" />
              <span>{issuingPasswords ? "Creating passwords..." : "Issue Passwords"}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs cursor-pointer"
            title="Export student records to CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Download</span>
          </button>

          <button
            onClick={() => setShowAddStudentModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Bar matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left Dropdown: Batches */}
        <div className="relative min-w-[200px]">
          <select
            value={selectedBatch}
            onChange={(e) => {
              setSelectedBatch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer"
          >
            {batches.map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Center: Search Students input matching Screenshot 4 */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students..."
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

        {/* Right: Sort Dropdown matching Screenshot 4 */}
        <div className="relative min-w-[160px]">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg px-3.5 py-2 pr-9 hover:border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] shadow-xs cursor-pointer"
          >
            <option value="name-asc">↑↓ A-Z Name</option>
            <option value="name-desc">↑↓ Z-A Name</option>
            <option value="id-asc">↑↓ Student ID</option>
            <option value="created-desc">↑↓ Date Created</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Bulk actions banner if any rows selected */}
      {selectedStudentIds.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedStudentIds.length} students selected</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Total Students Counter matching Screenshot 4 */}
      <div className="text-sm font-medium text-gray-700">
        Total: {totalStudents} students
      </div>

      {/* Table Container matching Screenshot 4 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="text-gray-400 hover:text-gray-700 focus:outline-hidden"
                  >
                    {students.length > 0 &&
                    students.every((s) => selectedStudentIds.includes(s.id)) ? (
                      <CheckSquare className="w-4 h-4 text-[#287FC1]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Student ID</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Batch</th>
                <th className="py-3.5 px-4">DOB</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {students.map((student) => {
                const isSelected = selectedStudentIds.includes(student.id);

                return (
                  <tr
                    key={student.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      isSelected ? "bg-blue-50/60" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStudent(student.id)}
                        className="text-gray-400 hover:text-gray-700 focus:outline-hidden"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#287FC1]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300" />
                        )}
                      </button>
                    </td>

                    {/* Student ID with copy icon matching Screenshot 4 */}
                    <td className="py-3 px-4 font-mono font-medium text-[#287FC1]">
                      <div className="flex items-center gap-1.5 group">
                        <button
                          onClick={() => handleCopyId(student.id)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                          title="Click to copy ID"
                        >
                          <span>{student.id}</span>
                          <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#287FC1] transition-colors" />
                        </button>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {student.name}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-gray-500">
                      {student.email}
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 font-mono text-gray-700">
                      {student.phone}
                    </td>

                    {/* Batch */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 border border-gray-200">
                        {student.batch}
                      </span>
                    </td>

                    {/* DOB */}
                    <td className="py-3 px-4 text-gray-500">
                      {student.dob}
                    </td>

                    {/* Created (latest dates) */}
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                      {student.created}
                    </td>

                    {/* Actions matching Screenshot 4 */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-gray-400">
                        {/* History icon */}
                        <button
                          onClick={() => handleOpenHistory(student)}
                          className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                          title="View Exam History"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Reset password Key icon */}
                        <button
                          onClick={() => handleResetPassword(student)}
                          className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                    No students found matching your criteria.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                    Loading student records...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3.5 px-6 border-t border-gray-200 bg-[#f8fafc] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div>
            Showing{" "}
            <strong>
              {totalStudents === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{" "}
            to{" "}
            <strong>
              {Math.min(currentPage * pageSize, totalStudents)}
            </strong>{" "}
            of <strong>{totalStudents}</strong> students
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Student Examination History
                </h3>
                <p className="text-xs text-gray-500">
                  {historyStudent.name} • <span className="font-mono text-[#287FC1]">{historyStudent.id}</span>
                </p>
              </div>
              <button
                onClick={() => setHistoryStudent(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
              {history === null && (
                <p className="text-xs text-gray-400 text-center py-6">Loading...</p>
              )}
              {history?.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No exams attempted yet.</p>
              )}
              {history?.map((attempt) => (
                <div key={attempt.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-gray-800">{attempt.examTitle}</div>
                    <div className="text-gray-400 mt-0.5">
                      Submitted: {friendlyDay(attempt.submittedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600 text-sm">{attempt.result.percentage}%</div>
                    <div className="text-gray-500 font-mono text-[11px]">{attempt.result.score} / {attempt.result.maxScore} marks</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setHistoryStudent(null)}
                className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Temporary Password
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              For <strong>{resetModalStudent.name}</strong>. Student ID: <strong className="font-mono">{resetModalStudent.id}</strong>
            </p>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 mb-4">
              <span className="text-xs text-emerald-800 font-medium">Temporary Password:</span>
              <div className="text-xl font-mono font-bold text-emerald-700 tracking-wider">
                {generatedPassword}
              </div>
              <p className="text-[11px] text-emerald-600">
                Give this to the student now. It won&apos;t be shown again, and they must change it when they first log in.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setResetModalStudent(null);
                  setGeneratedPassword(null);
                }}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Add New Student Account
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              A student ID and temporary password are created automatically.
            </p>

            <form onSubmit={handleAddStudentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign Batch
                </label>
                <select
                  value={newStudentBatch}
                  onChange={(e) => setNewStudentBatch(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
                >
                  {batches.filter((b) => b !== "All Batches").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
