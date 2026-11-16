"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileDown, Info, TrendingUp, XCircle } from "lucide-react";
import RamRajLogo from "../../../components/RamRajLogo";
import MathText from "@/app/components/MathText";
import { BreakdownTable, OUTCOME_LABELS, PieChart, PieGrid, formatLong } from "@/app/components/results/ResultCharts";
import { friendlyDateTime, friendlyDay } from "@/lib/dates";
import { MAX_WARNINGS } from "@/lib/proctoring";
import { markingLabel } from "@/lib/scoring";

const TABS = ["Score Card", "Overview", "Time Analysis", "Solution Details"];
const SUBJECT_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#14b8a6"];

const round2 = (n: number) => Math.round(n * 100) / 100;

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-3 text-xs text-gray-700 bg-blue-50 border border-blue-200 rounded-lg">
      <Info className="w-4 h-4 text-blue-600 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function ScoreCardTab({ data }: { data: any }) {
  const { attempt, analysis } = data;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h3 className="text-center text-xl font-bold text-gray-900 py-3 bg-gray-50 border-b border-gray-100">Exam Score Card</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 text-center">
          {[
            ["Percentile", `${analysis.percentile.toFixed(1)}%`],
            ["Overall Score", `${attempt.result.score} / ${attempt.result.maxScore}`],
            ["Accuracy", `${analysis.accuracy.toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <InfoNote>
        <strong>Percentile:</strong> the share of candidates who scored the same as you or lower in this exam. It may change as more students submit.
      </InfoNote>

      <BreakdownTable heading="Section" rows={analysis.sections} />
      <PieGrid title="Question Distribution by Section" rows={analysis.sections} />

      <BreakdownTable
        heading="Subject"
        rows={analysis.subjects}
        overall={{ score: attempt.result.score, maxScore: attempt.result.maxScore, accuracy: analysis.accuracy, percentile: analysis.percentile }}
      />
      <PieGrid title="Question Distribution by Subject" rows={analysis.subjects} />
    </div>
  );
}

function NumberChips({ label, numbers, color }: { label: string; numbers: number[]; color: string }) {
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1.5">{label}:</div>
      {numbers.length === 0 ? (
        <span className="text-xs text-gray-400">None</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {numbers.map((n) => (
            <span key={n} className="inline-flex items-center justify-center min-w-8 h-8 px-1.5 rounded-full text-xs font-bold text-white" style={{ background: color }}>
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  const { attempt, analysis } = data;
  const questions: any[] = analysis.questions;
  const sectionNames: string[] = analysis.sections.map((s: any) => s.name);

  const impactRow = (rows: any[]) => ({
    attempted: rows.filter((q) => q.outcome !== "unanswered").length,
    total: rows.length,
    correct: rows.filter((q) => q.outcome === "correct").length,
    incorrect: rows.filter((q) => q.outcome === "incorrect").length,
    gained: round2(rows.filter((q) => q.marksAwarded > 0).reduce((sum, q) => sum + q.marksAwarded, 0)),
    lost: round2(rows.filter((q) => q.marksAwarded < 0).reduce((sum, q) => sum + q.marksAwarded, 0)),
  });
  const bySection = sectionNames.map((name) => ({ name, ...impactRow(questions.filter((q) => q.section === name)) }));
  const overall = impactRow(questions);
  const withoutWrong = round2(attempt.result.score - overall.lost);

  const th = "py-2.5 px-3 text-left font-semibold";
  const td = "py-2.5 px-3";

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Impact of Incorrect Responses</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1b78bd] text-white">
              <tr>
                <th className={th}>Section</th>
                <th className={th}>Attempt</th>
                <th className={th}>No. Correct</th>
                <th className={th}>No. Incorrect</th>
                <th className={th}>Marks Gained</th>
                <th className={th}>Marks Lost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {[...bySection, { name: "Overall", ...overall }].map((row) => (
                <tr key={row.name} className={row.name === "Overall" ? "font-semibold" : ""}>
                  <td className={`${td} bg-[#1b78bd] text-white`}>{row.name}</td>
                  <td className={td}>{row.attempted}/{row.total}</td>
                  <td className={td}>{row.correct}</td>
                  <td className={td}>{row.incorrect}</td>
                  <td className={td}>{row.gained}</td>
                  <td className={`${td} text-red-600`}>{row.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overall.lost < 0 && (
          <p className="text-sm text-gray-700 mt-4">
            Had you not attempted the questions that cost you marks, you would have scored <strong>{withoutWrong}</strong> marks.
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">Marking scheme (correct / wrong): {markingLabel(attempt.marking)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Selection and Accuracy: Individual Question Breakup</h3>
        <div className="space-y-3">
          {sectionNames.map((name) => {
            const rows = questions.filter((q) => q.section === name);
            const numbersFor = (outcome: string) => rows.filter((q) => q.outcome === outcome).map((q) => q.number);
            return (
              <div key={name} className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_1fr] gap-4 border border-gray-100 rounded-lg overflow-hidden break-inside-avoid">
                <div className="bg-[#1b78bd] text-white text-sm font-semibold p-3 flex items-center">{name}</div>
                <div className="p-3"><NumberChips label="Correct" numbers={numbersFor("correct")} color="#16a34a" /></div>
                <div className="p-3"><NumberChips label="Incorrect" numbers={numbersFor("incorrect")} color="#dc2626" /></div>
                <div className="p-3"><NumberChips label="Not Attempted" numbers={numbersFor("unanswered")} color="#9ca3af" /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-700">
        <strong>Submission:</strong>{" "}
        {attempt.submitType === "violations"
          ? `Submitted automatically after ${MAX_WARNINGS} warnings for leaving the exam screen`
          : attempt.submitType === "time_up"
          ? "Submitted automatically when time ran out"
          : "Submitted by you"}
      </div>
    </div>
  );
}

function accuracyBadge(value: number) {
  if (value >= 80) return "bg-green-500 text-white";
  if (value >= 60) return "bg-sky-400 text-white";
  if (value >= 30) return "bg-amber-400 text-white";
  return "bg-red-500 text-white";
}

function TimeTab({ data }: { data: any }) {
  const { attempt, analysis } = data;
  const { time, questions } = analysis;
  const th = "py-3 px-3 text-center font-semibold";
  const td = "py-2.5 px-3 text-center";

  const subjectTimes: { name: string; seconds: number }[] = time.tracked ? time.bySubject : [];
  const used = subjectTimes.reduce((sum, s) => sum + s.seconds, 0);
  const allowed = Math.max(attempt.allowedSeconds ?? 0, used);
  const share = (seconds: number) => (allowed > 0 ? Math.round((seconds / allowed) * 100) : 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#1b78bd] text-white">
            <tr>
              <th className={th}>Q. No.</th>
              <th className={`${th} text-left`}>Subject</th>
              <th className={`${th} text-left`}>Chapter</th>
              <th className={th}>Your Score</th>
              <th className={th}>Global Attempt</th>
              <th className={th}>Global Accuracy</th>
              <th className={th}>Your Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {questions.map((q: any) => (
              <tr key={q.id}>
                <td className={td}>{q.number}</td>
                <td className={`${td} text-left`}>{q.subject}</td>
                <td className={`${td} text-left`}>{q.chapter}</td>
                <td className={`${td} ${q.marksAwarded > 0 ? "text-green-700 font-semibold" : q.marksAwarded < 0 ? "text-red-600 font-semibold" : ""}`}>
                  {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded}
                </td>
                <td className={td}>{q.globalAttempt}%</td>
                <td className={td}>
                  <span className={`inline-block min-w-12 px-2 py-1 rounded-md text-xs font-bold ${accuracyBadge(q.globalAccuracy)}`}>{q.globalAccuracy}%</span>
                </td>
                <td className={`${td} ${!q.timeSeconds ? "italic text-gray-400" : ""}`}>
                  {q.timeSeconds == null ? "Not recorded" : q.timeSeconds === 0 ? "Not visited" : formatLong(q.timeSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoNote>
        <strong>Global Attempt:</strong> share of all students who answered the question. <strong>Global Accuracy:</strong> share of those students who got it right.
      </InfoNote>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-center text-sm font-semibold text-gray-900 mb-4">Time Distribution by Subject</h3>
        {!time.tracked ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Time per question wasn&apos;t recorded for this attempt. Total time taken was {formatLong(attempt.result.timeTakenSeconds)}.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <PieChart
              ariaLabel="Time spent on each subject, and time left unused"
              slices={[
                ...subjectTimes.map((s, i) => ({
                  key: s.name,
                  label: s.name,
                  value: s.seconds,
                  color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
                  callout: `${s.name}: ${share(s.seconds)}%`,
                })),
                { key: "remaining", label: "Remaining Time", value: Math.max(0, allowed - used), color: "#6b7280", callout: "Not Used" },
              ]}
            />
            <div className="max-w-sm w-full mx-auto">
              <h4 className="text-base font-semibold text-gray-900 mb-3">Time Summary</h4>
              <ul className="space-y-2 text-sm text-gray-800">
                {subjectTimes.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                      <span className="font-medium">{s.name}</span>
                    </span>
                    <span>{formatLong(s.seconds)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 mt-3 pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span>Time Used</span><span>{formatLong(used)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total Exam Time</span><span>{Math.round(allowed / 60)}m</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "border-green-300 text-green-700",
  medium: "border-amber-300 text-amber-700",
  hard: "border-red-300 text-red-600",
};

function SolutionsTab({ data }: { data: any }) {
  const [filter, setFilter] = useState("all");
  const all: any[] = data.analysis.questions;
  const questions = all.filter((q) => filter === "all" || q.outcome === filter);
  const filters = [["all", "All"], ["correct", "Correct"], ["incorrect", "Incorrect"], ["unanswered", "Not Attempted"]];
  const statusStyle: Record<string, string> = {
    correct: "bg-emerald-50 text-emerald-800 border-emerald-200",
    incorrect: "bg-red-50 text-red-800 border-red-200",
    unanswered: "bg-gray-50 text-gray-700 border-gray-200",
  };
  const StatusIcon = ({ outcome }: { outcome: string }) =>
    outcome === "correct" ? <CheckCircle2 className="w-4 h-4" /> : outcome === "incorrect" ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />;

  return (
    <div className="space-y-4">
      {!data.answersVisible && (
        <InfoNote>
          Correct answers and solutions will appear here after the exam closes
          {data.answersFrom ? ` (${friendlyDateTime(data.answersFrom)})` : ""}, so they can&apos;t be shared with students still taking it.
        </InfoNote>
      )}
      <div className="flex gap-2 flex-wrap print:hidden">
        {filters.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${filter === key ? "bg-[#287FC1] text-white border-[#287FC1]" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
          >
            {label} ({key === "all" ? all.length : all.filter((q) => q.outcome === key).length})
          </button>
        ))}
      </div>
      {questions.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No questions in this group.</p>}
      {questions.map((q) => {
        const numeric = q.type === "numeric";
        const correctText = numeric
          ? q.answerRange
            ? q.answerRange.min === q.answerRange.max ? `${q.answerRange.min}` : `${q.answerRange.min} to ${q.answerRange.max}`
            : null
          : q.correctAnswer != null
          ? String.fromCharCode(65 + q.correctAnswer)
          : null;
        return (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="text-base font-semibold text-gray-900">Question {q.number}</h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${statusStyle[q.outcome]}`}>
                <StatusIcon outcome={q.outcome} />
                {OUTCOME_LABELS[q.outcome]} · {q.marksAwarded > 0 ? "+" : ""}{q.marksAwarded} / {q.marksPossible}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-800">{numeric ? "Numeric" : "MCQ"}</span>
              {q.difficulty && (
                <span className={`px-3 py-1.5 rounded-md border bg-white capitalize ${DIFFICULTY_STYLES[String(q.difficulty).toLowerCase()] ?? "border-gray-200 text-gray-700"}`}>
                  {q.difficulty}
                </span>
              )}
              <span className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-800">{q.subject}</span>
              <span className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-800">{q.chapter}</span>
              {q.timeSeconds > 0 && <span className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600">Your time: {q.timeSeconds}s</span>}
            </div>

            <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Question</h4>
            <div className="text-sm text-gray-900 mb-4 leading-relaxed"><MathText text={q.text} /></div>

            {!numeric && q.options.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                {q.options.map((option: string, i: number) => {
                  const isCorrect = q.correctAnswer != null && i === q.correctAnswer;
                  const isChosen = i === q.choice;
                  const style = isCorrect ? "bg-emerald-50 border-emerald-300" : isChosen ? (q.outcome === "correct" ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300") : "bg-gray-50 border-gray-100";
                  return (
                    <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm text-gray-800 ${style}`}>
                      <span className="font-bold text-xs mt-0.5">{String.fromCharCode(65 + i)}.</span>
                      <span className="flex-1"><MathText text={option} /></span>
                      {isChosen && <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Your answer</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Your Answer</h4>
            <div className={`p-3 rounded-lg border text-sm mb-4 ${q.choice == null ? "bg-white border-gray-200 text-gray-500" : q.outcome === "correct" ? "bg-emerald-50 border-emerald-200 text-gray-900" : "bg-red-50 border-red-200 text-gray-900"}`}>
              {q.choice == null ? "No answer provided" : numeric ? q.choice : String.fromCharCode(65 + q.choice)}
            </div>

            {correctText && (
              <>
                <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Correct Answer</h4>
                <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200 mb-4">
                  <span className="inline-flex items-center justify-center min-w-10 h-10 px-2 rounded-md bg-green-600 text-white font-bold">{correctText}</span>
                </div>
              </>
            )}

            {q.explanation && (
              <>
                <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Solution</h4>
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-800 leading-relaxed"><MathText text={q.explanation} /></div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InsightsCard({ insights }: { insights: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <TrendingUp className="w-4 h-4" />
        Performance Insights
      </h3>
      <p className="text-xs text-gray-500 mb-4">Key observations and recommendations</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Strengths</h4>
          {insights.strengths.length === 0 && <p className="text-sm text-gray-400">Keep practising: strengths will show up here.</p>}
          <ul className="space-y-1.5">
            {insights.strengths.map((text: string) => (
              <li key={text} className="flex items-start gap-2 text-sm text-green-700">
                <span className="w-2 h-2 rounded-full bg-green-600 mt-1.5 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Areas for Improvement</h4>
          {insights.improvements.length === 0 && <p className="text-sm text-gray-400">Nothing major stood out.</p>}
          <ul className="space-y-1.5">
            {insights.improvements.map((text: string) => (
              <li key={text} className="flex items-start gap-2 text-sm text-orange-700">
                <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h4 className="text-sm font-semibold text-gray-900 mt-4 mb-1.5">Recommendations</h4>
      <ul className="space-y-1 text-sm text-gray-700">
        {insights.recommendations.map((text: string) => (
          <li key={text}>• {text}</li>
        ))}
      </ul>
    </div>
  );
}

function ProgressCard({ data }: { data: any }) {
  const [view, setView] = useState<"progress" | "compare">("progress");
  const { attempt, analysis, progress } = data;
  const th = "py-2.5 px-3 text-left text-sm font-semibold text-gray-700";
  const td = "py-2.5 px-3 text-sm text-gray-800";
  const compareRows = [
    { name: "Overall", score: attempt.result.score, classAverage: attempt.classAverage, topScore: attempt.topScore, maxScore: attempt.result.maxScore },
    ...analysis.subjects,
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 break-inside-avoid">
      <div role="tablist" className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 print:hidden">
        {([["progress", "My Progress"], ["compare", "Class Compare"]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer ${view === key ? "bg-[#1b78bd] text-white" : "text-gray-700 hover:bg-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {view === "progress" ? (
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr><th className={th}>Exam</th><th className={th}>Submitted</th><th className={th}>Time</th><th className={th}>Score</th><th className={th}>Accuracy</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {progress.map((p: any) => (
                <tr key={p.examId} className={p.examId === attempt.examId ? "bg-blue-50/60 font-medium" : ""}>
                  <td className={td}>{p.examTitle}</td>
                  <td className={td}>{friendlyDay(p.submittedAt)}</td>
                  <td className={td}>{formatLong(p.timeTakenSeconds)}</td>
                  <td className={td}>{p.score}/{p.maxScore} ({p.percentage}%)</td>
                  <td className={td}>{p.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr><th className={th}></th><th className={th}>Your Score</th><th className={th}>Class Average</th><th className={th}>Top Score</th><th className={th}>Total</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {compareRows.map((row: any) => (
                  <tr key={row.name} className={row.name === "Overall" ? "font-semibold" : ""}>
                    <td className={td}>{row.name}</td>
                    <td className={`${td} ${row.score >= row.classAverage ? "text-green-700" : "text-red-600"}`}>{row.score}</td>
                    <td className={td}>{row.classAverage}</td>
                    <td className={td}>{row.topScore}</td>
                    <td className={td}>{row.maxScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3">
              Rank {attempt.rank} of {attempt.participants} so far. Compared with everyone who has submitted this exam.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ResultsContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState(TABS[0]);

  // Results always come from the server, so editing the URL can't change them.
  useEffect(() => {
    fetch(`/api/exams/${encodeURIComponent(examId)}/analysis`)
      .then(async (res) => {
        const body = await res.json();
        if (body.success) setData(body);
        else if (body.code === "IN_PROGRESS") router.replace(`/exam/${examId}`);
        else if (res.status === 401) router.replace("/login");
        else setLoadError(body.error || "This result could not be loaded.");
      })
      .catch(() => setLoadError("Could not reach the server. Please check your connection and refresh."));
  }, [examId, router]);

  const message = useMemo(() => {
    const pct = data?.attempt.result.percentage ?? 0;
    return pct >= 75 ? "Excellent work!" : pct >= 50 ? "Good work!" : pct >= 33 ? "Keep practising" : "Needs improvement";
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="text-center">
          <div className={`text-base font-semibold mb-3 ${loadError ? "text-gray-900" : "text-[#287FC1]"}`}>{loadError || "Loading results..."}</div>
          {loadError && (
            <button onClick={() => router.push("/")} className="px-5 py-2.5 bg-[#287FC1] text-white rounded-lg text-sm font-semibold cursor-pointer">
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const { attempt, analysis } = data;
  const { result } = attempt;
  const attempted = result.correct + result.incorrect;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#287FC1] px-6 h-[60px] flex items-center justify-between shadow-md print:hidden">
        <RamRajLogo size="sm" variant="light" />
        <div className="text-sm text-white/90 font-medium">Examination Results</div>
      </header>

      <main className="max-w-[1420px] w-full mx-auto px-4 sm:px-6 py-8 space-y-6 print:p-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exam Result</h1>
            <p className="text-sm text-gray-500">{attempt.examTitle}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1b78bd] hover:bg-[#1a5f94] rounded-lg cursor-pointer print:hidden"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/70 flex justify-between gap-3">
            <div>
              <div className="font-medium text-blue-900">Overall Score</div>
              <div className="text-xs text-blue-800">Your performance score</div>
              <div className="text-xs text-blue-800 mt-2"><strong>{result.percentage}%</strong> · {message}</div>
            </div>
            <div className="text-2xl font-bold text-blue-950 whitespace-nowrap">{result.score}/{result.maxScore}</div>
          </div>
          <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60 flex justify-between gap-3">
            <div>
              <div className="font-medium text-emerald-900">Accuracy</div>
              <div className="text-xs text-emerald-800">Correct answer rate</div>
              <div className="text-xs text-emerald-800 mt-2">{result.correct} correct of {attempted} attempted · {result.unanswered} not attempted</div>
            </div>
            <div className="text-2xl font-bold text-emerald-900">{analysis.accuracy}%</div>
          </div>
          <div className="p-4 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/60 flex justify-between gap-3">
            <div>
              <div className="font-medium text-orange-900">Time Management</div>
              <div className="text-xs text-orange-800">Exam completion time</div>
              <div className="text-xs text-orange-800 mt-2">Avg: {result.total > 0 ? round2(result.timeTakenSeconds / result.total) : 0}s/question</div>
            </div>
            <div className="text-2xl font-bold text-orange-900 whitespace-nowrap">{formatLong(result.timeTakenSeconds)}</div>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Exam Analytics</h2>
              <p className="text-sm text-gray-600">Submitted: {friendlyDateTime(attempt.submittedAt)}</p>
            </div>
            <div className="text-sm text-gray-600 text-right">
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
                className={`py-2.5 text-sm font-medium rounded-md cursor-pointer ${tab === name ? "bg-[#1b78bd] text-white" : "text-gray-700 hover:bg-gray-200"}`}
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

        <InsightsCard insights={analysis.insights} />
        <ProgressCard data={data} />

        <div className="flex justify-center print:hidden">
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 bg-[#1b78bd] hover:bg-[#1a5f94] text-white rounded-lg text-sm font-semibold cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-[#287FC1]">Loading results...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
