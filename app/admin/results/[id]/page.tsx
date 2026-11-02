"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileDown, Info, RotateCcw, TrendingUp } from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";
import { MAX_WARNINGS, VIOLATION_LABELS } from "@/lib/proctoring";
import { markingLabel } from "@/lib/scoring";

const OUTCOME_COLORS = {
  correct: "#059669",
  incorrect: "#dc2626",
  unanswered: "#ca8a04",
};

const OUTCOME_LABELS: Record<string, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Not Attempted",
};

const TABS = ["Score Card", "Overview", "Time Analysis", "Solution Details"];

function formatLong(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function OutcomePie({ correct, incorrect, unanswered }: { correct: number; incorrect: number; unanswered: number }) {
  const slices = [
    { key: "correct", value: correct },
    { key: "incorrect", value: incorrect },
    { key: "unanswered", value: unanswered },
  ].filter((s) => s.value > 0) as { key: keyof typeof OUTCOME_COLORS; value: number }[];
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // Wide side margins leave room for the longest label, "Not Attempted: 100".
  const cx = 180;
  const cy = 85;
  const r = 58;
  let angle = -Math.PI / 2;

  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 360 170"
        className="w-full max-w-[380px] mx-auto"
        role="img"
        aria-label={`${correct} correct, ${incorrect} incorrect, ${unanswered} not attempted`}
      >
        {total === 0 && <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />}
        {slices.map((slice) => {
          const sweep = (slice.value / total) * Math.PI * 2;
          const start = angle;
          const end = angle + sweep;
          angle = end;
          const mid = start + sweep / 2;
          const a = polar(cx, cy, r, start);
          const b = polar(cx, cy, r, end);
          const lineStart = polar(cx, cy, r, mid);
          const lineEnd = polar(cx, cy, r + 12, mid);
          const onRight = Math.cos(mid) >= 0;
          const label = `${OUTCOME_LABELS[slice.key]}: ${slice.value}`;
          return (
            <g key={slice.key}>
              <title>{`${label} (${Math.round((slice.value / total) * 100)}%)`}</title>
              {slices.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={OUTCOME_COLORS[slice.key]} />
              ) : (
                <path
                  d={`M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${b.x} ${b.y} Z`}
                  fill={OUTCOME_COLORS[slice.key]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="#9ca3af" strokeWidth={1} />
              <text
                x={lineEnd.x + (onRight ? 3 : -3)}
                y={lineEnd.y + 4}
                textAnchor={onRight ? "start" : "end"}
                fontSize={11}
                fill="#374151"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex items-center justify-center gap-3 flex-wrap text-xs text-gray-600">
        {Object.entries(OUTCOME_COLORS).map(([key, color]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            {OUTCOME_LABELS[key]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function BreakdownTable({ heading, rows, overall }: { heading: string; rows: any[]; overall?: any }) {
  const cell = "py-3 px-4 text-center border-r border-white/60 last:border-r-0";
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1b78bd] text-white font-semibold">
          <tr>
            <th className={cell}>{heading}</th>
            <th className={cell}>Score</th>
            <th className={cell}>Accuracy</th>
            <th className={cell}>Percentile</th>
            <th className={cell}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white text-gray-900">
          {rows.map((row) => (
            <tr key={row.name} className="bg-blue-50/70">
              <td className={`${cell} font-medium`}>{row.name}</td>
              <td className={cell}>{row.score}</td>
              <td className={cell}>{row.accuracy.toFixed(1)}%</td>
              <td className={cell}>{row.percentile.toFixed(1)}</td>
              <td className={cell}>{row.maxScore}</td>
            </tr>
          ))}
          {overall && (
            <tr className="bg-blue-200/60 font-bold">
              <td className={cell}>Overall</td>
              <td className={cell}>{overall.score}</td>
              <td className={cell}>{overall.accuracy.toFixed(1)}%</td>
              <td className={cell}>{overall.percentile.toFixed(1)}</td>
              <td className={cell}>{overall.maxScore}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PieGrid({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-center text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((row) => (
          <div key={row.name} className="border border-gray-200 rounded-xl p-4 break-inside-avoid">
            <div className="text-center font-medium text-gray-900">{row.name}</div>
            <div className="text-center text-xs text-gray-600 mb-2">
              Score: {row.score} | Accuracy: {row.accuracy.toFixed(1)}%
            </div>
            <OutcomePie correct={row.correct} incorrect={row.incorrect} unanswered={row.unanswered} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCardTab({ data }: { data: any }) {
  const { attempt, analysis } = data;
  const { insights } = analysis;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h3 className="text-center text-xl font-bold text-gray-900 py-3 bg-gray-50 border-b border-gray-100">Exam Score Card</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 text-center">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Overall Percentile</div>
            <div className="text-2xl font-bold text-gray-900">{analysis.percentile.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Overall Score</div>
            <div className="text-2xl font-bold text-gray-900">{attempt.result.score} / {attempt.result.maxScore}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Accuracy</div>
            <div className="text-2xl font-bold text-gray-900">{analysis.accuracy.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 text-xs text-gray-700 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          <strong>Overall Percentile:</strong> the share of candidates who scored the same or lower in this exam. It may change as more students submit.
        </span>
      </div>

      <BreakdownTable heading="Section" rows={analysis.sections} />
      <PieGrid title="Question Distribution by Section" rows={analysis.sections} />

      <BreakdownTable
        heading="Subject"
        rows={analysis.subjects}
        overall={{ score: attempt.result.score, maxScore: attempt.result.maxScore, accuracy: analysis.accuracy, percentile: analysis.percentile }}
      />
      <PieGrid title="Question Distribution by Subject" rows={analysis.subjects} />

      <div className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <TrendingUp className="w-4 h-4" />
          Performance Insights (Admin View)
        </h3>
        <p className="text-xs text-gray-500 mb-4">Worked out from this student&apos;s answers</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Student Strengths</h4>
            {insights.strengths.length === 0 && <p className="text-sm text-gray-400">None stood out in this attempt.</p>}
            <ul className="space-y-1.5">
              {insights.strengths.map((text: string) => (
                <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Areas for Student Improvement</h4>
            {insights.improvements.length === 0 && <p className="text-sm text-gray-400">None stood out in this attempt.</p>}
            <ul className="space-y-1.5">
              {insights.improvements.map((text: string) => (
                <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <h4 className="text-sm font-semibold text-gray-900 mt-4 mb-1.5">Teaching Recommendations</h4>
        <ul className="space-y-1 text-sm text-gray-700">
          {insights.recommendations.map((text: string) => (
            <li key={text}>• {text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  const { attempt, analysis } = data;
  const { result } = attempt;
  const gained = analysis.questions.filter((q: any) => q.marksAwarded > 0).reduce((sum: number, q: any) => sum + q.marksAwarded, 0);
  const lost = analysis.questions.filter((q: any) => q.marksAwarded < 0).reduce((sum: number, q: any) => sum + q.marksAwarded, 0);
  const tiles: [string, string | number][] = [
    ["Rank", `${attempt.rank} of ${attempt.participants}`],
    ["Percentile", analysis.percentile.toFixed(1)],
    ["Total Questions", result.total],
    ["Attempted", result.correct + result.incorrect],
    ["Correct", result.correct],
    ["Incorrect", result.incorrect],
    ["Not Attempted", result.unanswered],
    ["Marks Gained", `+${Math.round(gained * 100) / 100}`],
    ["Marks Lost", Math.round(lost * 100) / 100],
    ["Student Score", result.score],
    ["Class Average", attempt.classAverage],
    ["Highest Score", attempt.topScore],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-700 space-y-1.5">
        <div><strong>Batch:</strong> {attempt.batch}</div>
        <div><strong>Marking scheme (correct / wrong):</strong> {markingLabel(attempt.marking)}</div>
        <div>
          <strong>Submission:</strong>{" "}
          {attempt.submitType === "violations"
            ? `Submitted automatically after ${MAX_WARNINGS} warnings for leaving the exam screen`
            : attempt.submitType === "time_up"
            ? "Submitted automatically when time ran out"
            : "Submitted by the student"}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
        <h3 className="text-sm font-semibold text-gray-900">Left the Exam Screen: {attempt.violations.length} time{attempt.violations.length === 1 ? "" : "s"}</h3>
        <p className="text-xs text-gray-500 mb-3">
          This can also be caused by things like a notification, so please review before taking any action.
        </p>
        {attempt.violations.length === 0 ? (
          <p className="text-sm text-gray-400">The student stayed on the exam screen, or this attempt was taken before tracking began.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-800">
            {attempt.violations.map((v: any, i: number) => (
              <li key={v.leftAt} className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-50 pb-2 last:border-none">
                <span><strong>Warning {i + 1}:</strong> {VIOLATION_LABELS[v.type] ?? v.type}</span>
                <span className="text-xs text-gray-500">
                  {new Date(v.leftAt).toLocaleTimeString("en-IN")}
                  {" • "}
                  {v.returnedAt
                    ? `away ${Math.max(0, Math.round((new Date(v.returnedAt).getTime() - new Date(v.leftAt).getTime()) / 1000))}s`
                    : attempt.submitType === "violations" && i === attempt.violations.length - 1
                    ? "exam submitted"
                    : "no return recorded"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TimeBar({ share }: { share: number }) {
  return (
    <div className="h-2 w-full bg-gray-100 rounded-sm overflow-hidden">
      <div className="h-full bg-[#287FC1] rounded-sm" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
    </div>
  );
}

function TimeTab({ data }: { data: any }) {
  const { time } = data.analysis;
  if (!time.tracked) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <h3 className="text-sm font-semibold text-gray-800">Time per question wasn&apos;t recorded for this attempt</h3>
        <p className="text-sm text-gray-500 mt-1">
          It&apos;s only available for attempts started after this feature was added. Total time taken was {formatLong(data.attempt.result.timeTakenSeconds)}.
        </p>
      </div>
    );
  }
  const total = Math.max(1, time.totalSeconds);
  const th = "py-2.5 px-4 text-left text-xs font-semibold text-gray-600";
  const td = "py-2.5 px-4 text-sm text-gray-800";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-900 p-4 pb-2">Time by Subject</h3>
          <table className="w-full">
            <thead className="border-b border-gray-100"><tr><th className={th}>Subject</th><th className={th}>Time</th><th className={th}>Avg / question</th><th className={`${th} w-1/3`}>Share</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {time.bySubject.map((s: any) => (
                <tr key={s.name}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={td}>{formatLong(s.seconds)}</td>
                  <td className={td}>{s.average}s</td>
                  <td className={td}><TimeBar share={(s.seconds / total) * 100} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-900 p-4 pb-2">Time by Result</h3>
          <table className="w-full">
            <thead className="border-b border-gray-100"><tr><th className={th}>Result</th><th className={th}>Questions</th><th className={th}>Time</th><th className={th}>Avg / question</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {time.byOutcome.map((o: any) => (
                <tr key={o.outcome}>
                  <td className={`${td} font-medium`}>{OUTCOME_LABELS[o.outcome]}</td>
                  <td className={td}>{o.questions}</td>
                  <td className={td}>{formatLong(o.seconds)}</td>
                  <td className={td}>{o.average}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-900 p-4 pb-2">Slowest Questions</h3>
        <table className="w-full">
          <thead className="border-b border-gray-100"><tr><th className={th}>Question</th><th className={th}>Subject</th><th className={th}>Chapter</th><th className={th}>Result</th><th className={th}>Time</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {time.slowest.map((q: any) => (
              <tr key={q.number}>
                <td className={`${td} font-medium`}>Q{q.number}</td>
                <td className={td}>{q.subject}</td>
                <td className={td}>{q.chapter}</td>
                <td className={td}>{OUTCOME_LABELS[q.outcome]}</td>
                <td className={td}>{formatLong(q.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Times are approximate and count the seconds each question was on screen.</p>
    </div>
  );
}

function SolutionsTab({ data }: { data: any }) {
  const [filter, setFilter] = useState("all");
  const questions = data.analysis.questions.filter((q: any) => filter === "all" || q.outcome === filter);
  const filters = [["all", "All"], ["correct", "Correct"], ["incorrect", "Incorrect"], ["unanswered", "Not Attempted"]];
  const badge: Record<string, string> = {
    correct: "bg-emerald-50 text-emerald-800 border-emerald-200",
    incorrect: "bg-red-50 text-red-800 border-red-200",
    unanswered: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap print:hidden">
        {filters.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${filter === key ? "bg-[#287FC1] text-white border-[#287FC1]" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
          >
            {label} ({key === "all" ? data.analysis.questions.length : data.analysis.questions.filter((q: any) => q.outcome === key).length})
          </button>
        ))}
      </div>
      {questions.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No questions in this group.</p>}
      {questions.map((q: any) => (
        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="text-xs text-gray-500">
              <span className="font-bold text-gray-900 text-sm mr-2">Q{q.number}</span>
              {q.section} • {q.chapter}{q.difficulty ? ` • ${q.difficulty}` : ""}{q.timeSeconds != null ? ` • ${q.timeSeconds}s` : ""}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{q.marksAwarded > 0 ? "+" : ""}{q.marksAwarded} / {q.marksPossible}</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${badge[q.outcome]}`}>{OUTCOME_LABELS[q.outcome]}</span>
            </div>
          </div>
          <p className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{q.text}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {q.options.map((option: string, i: number) => {
              const isCorrect = i === q.correctAnswer;
              const isChosen = i === q.choice;
              const style = isCorrect
                ? "bg-emerald-50 border-emerald-300"
                : isChosen
                ? "bg-red-50 border-red-300"
                : "bg-gray-50 border-gray-100";
              return (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm text-gray-800 ${style}`}>
                  <span className="font-bold text-xs mt-0.5">{String.fromCharCode(65 + i)}.</span>
                  <span className="flex-1">{option}</span>
                  {isCorrect && <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">✓ Correct answer</span>}
                  {isChosen && !isCorrect && <span className="text-xs font-semibold text-red-800 whitespace-nowrap">✗ Student&apos;s answer</span>}
                  {isChosen && isCorrect && <span className="text-xs font-semibold text-emerald-800 whitespace-nowrap">• Student&apos;s answer</span>}
                </div>
              );
            })}
          </div>
          {q.explanation && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
              <strong>Explanation:</strong> {q.explanation}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResultDetail() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(TABS[0]);

  useEffect(() => {
    fetch(`/api/results/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setData(body);
        else setError(body.error || "This result could not be loaded.");
      })
      .catch(() => setError("Could not reach the server. Please check your connection and refresh."));
  }, [id]);

  const handleAllowRetake = async () => {
    const { attempt } = data;
    if (!confirm(`Delete ${attempt.studentName}'s result for "${attempt.examTitle}" (${attempt.result.score}/${attempt.result.maxScore}) so they can sit it again?\n\nThis cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/attempts/${attempt.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) {
        alert(body.error || "Could not delete this result.");
        return;
      }
      router.push("/admin/results");
    } catch {
      alert("Could not reach the server.");
    }
  };

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className={`text-sm font-medium ${error ? "text-gray-800" : "text-[#287FC1]"}`}>{error || "Loading result..."}</p>
        {error && (
          <Link href="/admin/results" className="inline-block mt-3 text-sm font-semibold text-[#287FC1]">Back to Results</Link>
        )}
      </div>
    );
  }

  const { attempt, analysis } = data;
  const { result } = attempt;
  const attempted = result.correct + result.incorrect;
  const message = result.percentage >= 75 ? "Excellent work!" : result.percentage >= 50 ? "Good work!" : result.percentage >= 33 ? "Needs more practice" : "Needs attention";

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2">
          <Link href="/admin/results" aria-label="Back to Results" className="text-gray-400 hover:text-gray-700 p-1 -ml-1 rounded-md print:hidden">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Student Exam Result - {attempt.studentName}</h1>
            <p className="text-sm text-gray-500">{attempt.examTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {user.role === "admin" && (
            <button
              onClick={handleAllowRetake}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Allow Retake
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Export as PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
          <div className="font-medium text-blue-900">Overall Score</div>
          <div className="text-xs text-blue-800 mb-4">Student performance score</div>
          <div className="text-3xl font-bold text-blue-950">{result.score}/{result.maxScore}</div>
          <div className="text-sm text-blue-800 mt-1">{result.percentage}%</div>
          <div className="text-xs text-blue-800 mt-2">{message}</div>
        </div>
        <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="font-medium text-emerald-900">Accuracy</div>
          <div className="text-xs text-emerald-800 mb-4">Correct answer rate</div>
          <div className="text-3xl font-bold text-emerald-950">{analysis.accuracy}%</div>
          <div className="text-xs text-emerald-800 mt-2">{result.correct} correct out of {attempted} attempted</div>
          <div className="text-xs text-emerald-800 mt-1">{result.unanswered} questions not attempted</div>
        </div>
        <div className="p-5 rounded-xl border border-orange-200 bg-orange-50">
          <div className="font-medium text-orange-900">Time Management</div>
          <div className="text-xs text-orange-800 mb-4">Exam completion time</div>
          <div className="text-3xl font-bold text-orange-950">{formatLong(result.timeTakenSeconds)}</div>
          <div className="text-xs text-orange-800 mt-2">
            Avg: {result.total > 0 ? Math.round(result.timeTakenSeconds / result.total) : 0}s/question
          </div>
          <div className="text-xs text-orange-800 mt-1">
            {attempt.submitType === "violations"
              ? `Auto-submitted after ${MAX_WARNINGS} warnings`
              : attempt.submitType === "time_up"
              ? "Auto-submitted"
              : "Submitted by student"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Exam Analytics</h2>
            <p className="text-xs text-gray-500">Submitted: {new Date(attempt.submittedAt).toLocaleString("en-IN")}</p>
          </div>
          <div className="text-xs text-gray-600 text-right">
            <div>Candidate: {attempt.studentName}</div>
            <div>ID: {attempt.studentId}</div>
          </div>
        </div>
        <div role="tablist" className="grid grid-cols-2 md:grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg print:hidden">
          {TABS.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`py-2 text-sm font-medium rounded-md cursor-pointer ${tab === name ? "bg-[#1b78bd] text-white" : "text-gray-700 hover:bg-gray-200"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {tab === "Score Card" && <ScoreCardTab data={data} />}
      {tab === "Overview" && <OverviewTab data={data} />}
      {tab === "Time Analysis" && <TimeTab data={data} />}
      {tab === "Solution Details" && <SolutionsTab data={data} />}
    </div>
  );
}

export default function AdminResultDetailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-[#287FC1]">Loading result...</div>}>
      <ResultDetail />
    </Suspense>
  );
}
