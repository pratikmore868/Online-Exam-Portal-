"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import type { Marking } from "@/lib/scoring";

interface Props {
  exam: any;
  subjects: string[];
  onExamUpdated: (exam: any) => void;
}

type Preset = "question" | "jee" | "custom";

// datetime-local inputs work in local time, while the server stores UTC.
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function presetFor(marking?: Marking): Preset {
  if (!marking || (marking.correct === null && !marking.wrong && !marking.subjects)) return "question";
  if (marking.correct === 4 && marking.wrong === 1 && !marking.subjects) return "jee";
  return "custom";
}

export default function ExamSettingsPanel({ exam, subjects, onExamUpdated }: Props) {
  const isLive = exam.status === "published" || exam.status === "available";
  const locked = (exam.attemptCount ?? 0) > 0;

  const [duration, setDuration] = useState<number>(exam.duration ?? 180);
  const [availableFrom, setAvailableFrom] = useState(toLocalInput(exam.availableFrom));
  const [availableUntil, setAvailableUntil] = useState(toLocalInput(exam.availableUntil));

  const [preset, setPreset] = useState<Preset>(presetFor(exam.marking));
  const [correct, setCorrect] = useState<string>(exam.marking?.correct != null ? String(exam.marking.correct) : "");
  const [wrong, setWrong] = useState<string>(String(exam.marking?.wrong ?? 0));
  const [overrides, setOverrides] = useState<Record<string, { correct: string; wrong: string }>>(() => {
    const result: Record<string, { correct: string; wrong: string }> = {};
    for (const [name, rule] of Object.entries<any>(exam.marking?.subjects ?? {})) {
      result[name] = { correct: rule.correct != null ? String(rule.correct) : "", wrong: String(rule.wrong ?? 0) };
    }
    return result;
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; problems?: string[] } | null>(null);

  const subjectNames = useMemo(() => Array.from(new Set(subjects.filter(Boolean))), [subjects]);

  const buildMarking = (): Marking => {
    if (preset === "question") return { correct: null, wrong: 0 };
    if (preset === "jee") return { correct: 4, wrong: 1 };

    const marking: Marking = { correct: correct.trim() === "" ? null : Number(correct), wrong: Number(wrong || 0) };
    const subjectRules: NonNullable<Marking["subjects"]> = {};
    for (const [name, rule] of Object.entries(overrides)) {
      if (rule.correct.trim() !== "" || Number(rule.wrong || 0) > 0) {
        subjectRules[name] = { correct: rule.correct.trim() === "" ? null : Number(rule.correct), wrong: Number(rule.wrong || 0) };
      }
    }
    if (Object.keys(subjectRules).length > 0) marking.subjects = subjectRules;
    return marking;
  };

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        duration: Number(duration),
        availableFrom: fromLocalInput(availableFrom),
        availableUntil: fromLocalInput(availableUntil),
        ...extra,
      };
      if (!locked) body.marking = buildMarking();

      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage({ tone: "error", text: data.error || "Could not save.", problems: data.problems });
        return false;
      }
      onExamUpdated(data.exam);
      setMessage({
        tone: "ok",
        text: extra.status === "published"
          ? "Published. Students in this batch can now see the exam."
          : extra.status === "draft"
          ? "Unpublished. Students can no longer see or start this exam."
          : "Settings saved.",
      });
      return true;
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#287FC1] disabled:bg-gray-100 disabled:text-gray-500";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-1";

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Schedule, Marking & Publishing</h2>
          {isLive ? (
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded border border-emerald-100">Published</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2.5 py-0.5 rounded border border-gray-200">Draft: students can&apos;t see this</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save()}
            disabled={busy}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Save Settings
          </button>
          {isLive ? (
            <button
              onClick={() => {
                if (confirm("Unpublish this exam? Students who haven't started won't be able to see it. Anyone already writing can still finish.")) {
                  save({ status: "draft" });
                }
              }}
              disabled={busy}
              className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => save({ status: "published" })}
              disabled={busy}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              Publish to Students
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`p-3 rounded-lg text-xs ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {message.tone === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
          {message.problems && (
            <ul className="list-disc ml-6 mt-1 space-y-0.5">
              {message.problems.slice(0, 10).map((p) => <li key={p}>{p}</li>)}
              {message.problems.length > 10 && <li>...and {message.problems.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="exam-duration" className={labelClass}>Duration (minutes)</label>
          <input id="exam-duration" type="number" min={1} max={720} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label htmlFor="exam-from" className={labelClass}>Opens at (blank = as soon as published)</label>
          <input id="exam-from" type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="exam-until" className={labelClass}>Closes at (blank = no closing time)</label>
          <input id="exam-until" type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} className={inputClass} />
          <p className="text-[11px] text-gray-400 mt-1">Everyone must finish by this time, even if they started late.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="exam-marking" className={labelClass}>Marking scheme</label>
        {locked && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
            <Lock className="w-3.5 h-3.5" />
            Locked because {exam.attemptCount} student(s) have already started. The questions are locked too.
          </p>
        )}
        <select
          id="exam-marking"
          disabled={locked}
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
          className={`${inputClass} md:max-w-md`}
        >
          <option value="question">Each question&apos;s own marks, no negative (MHT-CET style)</option>
          <option value="jee">+4 correct, −1 wrong (JEE / NEET style)</option>
          <option value="custom">Custom</option>
        </select>

        {preset === "custom" && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 md:max-w-md gap-3">
              <div>
                <label htmlFor="marking-correct" className={labelClass}>Marks if correct (blank = question&apos;s own)</label>
                <input id="marking-correct" disabled={locked} type="number" min={0} step="any" value={correct} onChange={(e) => setCorrect(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="marking-wrong" className={labelClass}>Marks lost if wrong</label>
                <input id="marking-wrong" disabled={locked} type="number" min={0} step="any" value={wrong} onChange={(e) => setWrong(e.target.value)} className={inputClass} />
              </div>
            </div>

            {subjectNames.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-gray-500">Different marks for one subject? Fill in a row below. Blank rows use the rule above.</p>
                {subjectNames.map((name) => (
                  <div key={name} className="grid grid-cols-3 md:max-w-md gap-3 items-center">
                    <span className="text-xs font-medium text-gray-700">{name}</span>
                    <input
                      aria-label={`${name} marks if correct`}
                      disabled={locked}
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Correct"
                      value={overrides[name]?.correct ?? ""}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [name]: { wrong: prev[name]?.wrong ?? "0", correct: e.target.value } }))}
                      className={inputClass}
                    />
                    <input
                      aria-label={`${name} marks lost if wrong`}
                      disabled={locked}
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Wrong"
                      value={overrides[name]?.wrong ?? ""}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [name]: { correct: prev[name]?.correct ?? "", wrong: e.target.value } }))}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
