"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronLeft, Download, KeyRound } from "lucide-react";
import FileDropZone from "@/app/admin/components/FileDropZone";
import { useAuth } from "@/app/components/AuthProvider";
import { issueAndDownloadPasswords } from "@/lib/issuePasswordsClient";

export default function BulkImportStudentsPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<string[]>([]);
  const [batch, setBatch] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string>("");

  useEffect(() => {
    fetch("/api/students?limit=1")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBatches(data.batches.filter((b: string) => b !== "All Batches"));
      })
      .catch(() => undefined);
  }, []);

  const send = async (selected: File, chosenBatch: string, confirm: boolean) => {
    if (!chosenBatch.trim()) {
      setPreview(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", selected);
      form.set("batch", chosenBatch.trim());
      if (confirm) form.set("confirm", "true");
      const res = await fetch("/api/students/import", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        setError(data?.error || "Could not read this file.");
        setPreview(null);
        return;
      }
      if (confirm) {
        setResult(data);
        setPreview(null);
        setFile(null);
      } else {
        setPreview(data);
      }
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = async () => {
    setBusy(true);
    const { count, failure } = await issueAndDownloadPasswords(result.batch);
    setBusy(false);
    setIssued(
      failure
        ? failure
        : count > 0
        ? `Passwords created for ${count} student(s) and downloaded. Keep the file private and delete it after handing them out.`
        : "Every student in this batch already has a password."
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2">
          <Link href="/admin/students" aria-label="Back to Students" className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded-md">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bulk Import Students</h1>
            <p className="text-sm text-gray-500 mt-0.5">Add many students to a batch from a CSV file</p>
          </div>
        </div>
        <a
          href="/samples/sample-students.csv"
          download
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg"
        >
          <Download className="w-4 h-4" />
          Download Sample
        </a>
      </div>

      {result && (
        <div role="status" className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {result.imported} student{result.imported === 1 ? "" : "s"} added to {result.batch ?? batch}.
          </div>
          {(result.invalid > 0 || result.duplicates > 0) && (
            <p className="mt-1 ml-6">Skipped: {result.invalid} with problems, {result.duplicates} already on the portal.</p>
          )}
          <p className="mt-1 ml-6">These students can&apos;t log in until they have a password.</p>
          {user.role === "admin" && result.imported > 0 && (
            <button
              onClick={handleIssue}
              disabled={busy}
              className="mt-2 ml-6 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              Create Passwords and Download Logins
            </button>
          )}
          {issued && <p className="mt-2 ml-6">{issued}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label htmlFor="import-batch" className="block text-sm font-medium text-gray-700 mb-1.5">
          Batch for these students (required): choose one or type a new name
        </label>
        <input
          id="import-batch"
          list="import-batches"
          placeholder="e.g. 12th JEE RRTS"
          value={batch}
          maxLength={80}
          onChange={(e) => {
            setBatch(e.target.value);
            setPreview(null);
          }}
          onBlur={() => {
            if (file) send(file, batch, false);
          }}
          className="w-full md:max-w-md text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1]"
        />
        <datalist id="import-batches">
          {batches.map((b) => <option key={b} value={b} />)}
        </datalist>
      </div>

      <FileDropZone
        accept=".csv"
        label="CSV"
        fileName={file?.name}
        onFile={(selected) => {
          setFile(selected);
          setResult(null);
          setIssued("");
          setError(batch.trim() ? "" : "Please enter a batch above, and the file will be checked.");
          send(selected, batch, false);
        }}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {busy && <p role="status" className="text-sm font-medium text-[#287FC1]">Working...</p>}

      {!preview && !result && (
        <div className="p-5 rounded-xl bg-gray-100 text-sm text-gray-800">
          <h2 className="font-semibold mb-2">File format</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Upload a .csv file with this exact first line: <code className="font-mono font-semibold">name,email,phone,dob</code></li>
            <li><strong>Required:</strong> name, and phone (exactly 10 digits).</li>
            <li><strong>Optional:</strong> email, and dob as YYYY-MM-DD. Leave them blank between the commas.</li>
            <li>Student IDs are created automatically, and the batch is chosen above.</li>
            <li>A student with the same name and phone as someone already on the portal is skipped.</li>
            <li>Download the <a href="/samples/sample-students.csv" download className="font-semibold text-[#287FC1] underline">sample file</a> for the exact format.</li>
          </ul>
        </div>
      )}

      {preview && file && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Students in File", preview.total, "text-gray-900"],
              ["Ready to Import", preview.valid, "text-emerald-700"],
              ["Have Problems", preview.invalid, "text-red-700"],
              ["Already on Portal", preview.duplicates, "text-amber-700"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">
              {preview.invalid > 0 ? "Rows with problems will be skipped. Fix them in the file and upload it again." : `These students will be added to ${batch}.`}
            </p>
            <button
              onClick={() => send(file, batch, true)}
              disabled={busy || preview.valid === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? "Working..." : `Import ${preview.valid} Student${preview.valid === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-200 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="py-3 px-4">Line</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Date of Birth</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {preview.rows.map((row: any) => (
                  <tr key={row.line} className={row.errors.length > 0 ? "bg-red-50/60" : row.duplicate ? "bg-amber-50/60" : ""}>
                    <td className="py-2.5 px-4 text-gray-500">{row.line}</td>
                    <td className="py-2.5 px-4 font-medium">{row.name}</td>
                    <td className="py-2.5 px-4">{row.email || "-"}</td>
                    <td className="py-2.5 px-4 font-mono">{row.phone}</td>
                    <td className="py-2.5 px-4">{row.dob || "-"}</td>
                    <td className="py-2.5 px-4 text-xs">
                      {row.errors.length > 0 ? (
                        <span className="text-red-800">{row.errors.join(" ")}</span>
                      ) : row.duplicate ? (
                        <span className="text-amber-800">Already on the portal ({row.existingBatch}), will be skipped</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
