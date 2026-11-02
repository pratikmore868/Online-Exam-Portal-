"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import RamRajLogo from "../../../components/RamRajLogo";
import { markingLabel } from "@/lib/scoring";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function getGrade(percentage: number): { grade: string; color: string; bg: string } {
  if (percentage >= 90) return { grade: "A+", color: "#15803d", bg: "#dcfce7" };
  if (percentage >= 75) return { grade: "A", color: "#16a34a", bg: "#dcfce7" };
  if (percentage >= 60) return { grade: "B", color: "#2563eb", bg: "#dbeafe" };
  if (percentage >= 45) return { grade: "C", color: "#d97706", bg: "#fef3c7" };
  if (percentage >= 33) return { grade: "D", color: "#ea580c", bg: "#fed7aa" };
  return { grade: "F", color: "#dc2626", bg: "#fee2e2" };
}

function ResultsContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [attempt, setAttempt] = useState<any>(null);
  const [loadError, setLoadError] = useState("");

  // Results always come from the server, so editing the URL can't change them.
  useEffect(() => {
    fetch(`/api/exams/${examId}/attempt`)
      .then(async (res) => {
        const data = await res.json();
        if (!data.success) {
          setLoadError(data.error || "This result could not be loaded.");
        } else if (!data.attempt) {
          setLoadError("You have not attempted this exam yet.");
        } else if (data.attempt.status !== "submitted") {
          router.replace(`/exam/${examId}`);
        } else {
          setAttempt(data.attempt);
        }
      })
      .catch((err) => {
        console.error("Error loading result:", err);
        setLoadError("Could not reach the server. Please check your connection and refresh.");
      });
  }, [examId, router]);

  if (!attempt) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6", padding: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, color: loadError ? "#111827" : "#287FC1", fontWeight: 600, marginBottom: 12 }}>
            {loadError || "Loading results..."}
          </div>
          {loadError && (
            <button
              onClick={() => router.push("/")}
              style={{ padding: "10px 20px", background: "#287FC1", color: "#ffffff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const result = attempt.result;
  const score: number = result.score;
  const correct: number = result.correct;
  const incorrect: number = result.incorrect;
  const unanswered: number = result.unanswered;
  const timeTaken: number = result.timeTakenSeconds;
  const total: number = result.total;
  const answered = correct + incorrect;
  const maxScore: number = result.maxScore;
  const examTitle: string = attempt.examTitle;
  const percentage: number = result.percentage;
  const { grade, color: gradeColor, bg: gradeBg } = getGrade(percentage);
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const formattedDate = new Date(attempt.submittedAt).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (circumference * Math.max(0, Math.min(percentage, 100))) / 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#287FC1",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(40,127,193,0.3)",
        }}
      >
        <RamRajLogo size="sm" variant="light" />
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
          Examination Results
        </div>
      </header>

      <div
        style={{
          maxWidth: 900,
          width: "100%",
          marginInline: "auto",
          padding: "32px 24px",
        }}
      >
        {/* Hero card */}
        <div
          style={{
            background: "linear-gradient(135deg, #287FC1 0%, #1a5f94 100%)",
            borderRadius: 20,
            padding: "36px",
            color: "#ffffff",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 8px 32px rgba(40,127,193,0.4)",
            flexWrap: "wrap",
            gap: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* BG decorations */}
          <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", right: 80, bottom: -60, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ zIndex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
              🎉 Examination Completed!
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800 }}>
              {examTitle}
            </h1>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {total} Questions {attempt.batch ? `• Batch: ${attempt.batch}` : ""} • Rank {attempt.rank} of {attempt.participants} so far
            </div>
            {attempt.submitType === "time_up" && (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                ⏰ Submitted automatically when time ran out
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: "10px 20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {score}/{maxScore}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Total Score</div>
              </div>
              <div
                style={{
                  background: gradeBg,
                  borderRadius: 12,
                  padding: "10px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: 26, fontWeight: 800, color: gradeColor }}
                >
                  {grade}
                </div>
                <div style={{ fontSize: 11, color: gradeColor, opacity: 0.8 }}>
                  Grade
                </div>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: "10px 20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {formatTime(timeTaken)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Time Taken</div>
              </div>
            </div>
          </div>

          {/* Circular progress */}
          <div
            style={{
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke={percentage >= 60 ? "#22c55e" : percentage >= 33 ? "#fbbf24" : "#f87171"}
                opacity={percentage > 0 ? 1 : 0}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 64 64)"
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
              <text
                x="64"
                y="58"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="22"
                fontWeight="800"
                fontFamily="Inter, sans-serif"
              >
                {percentage}%
              </text>
              <text
                x="64"
                y="76"
                textAnchor="middle"
                fill="rgba(255,255,255,0.75)"
                fontSize="11"
                fontFamily="Inter, sans-serif"
              >
                Score
              </text>
            </svg>
            <div style={{ fontSize: 11, opacity: 0.75, textAlign: "center" }}>
              {accuracy}% accuracy
            </div>
          </div>
        </div>

        {/* Detail cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            {
              icon: "📝",
              label: "Total Questions",
              value: total,
              color: "#287FC1",
              bg: "#e8f4fd",
            },
            {
              icon: "✅",
              label: "Answered",
              value: answered,
              color: "#16a34a",
              bg: "#dcfce7",
            },
            {
              icon: "❌",
              label: "Unanswered",
              value: unanswered,
              color: "#dc2626",
              bg: "#fee2e2",
            },
            {
              icon: "🏆",
              label: `Rank (of ${attempt.participants})`,
              value: attempt.rank,
              color: "#7c3aed",
              bg: "#ede9fe",
            },
            {
              icon: "🎯",
              label: "Correct Answers",
              value: correct,
              color: "#16a34a",
              bg: "#dcfce7",
            },
            {
              icon: "⚠️",
              label: "Wrong Answers",
              value: incorrect,
              color: "#dc2626",
              bg: "#fee2e2",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="card"
              style={{ padding: "20px", textAlign: "center" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: card.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginInline: "auto",
                  marginBottom: 10,
                }}
              >
                {card.icon}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: card.color,
                  lineHeight: 1,
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            📊 Score Breakdown
          </h3>
          <p style={{ margin: "-8px 0 14px", fontSize: 12, color: "#6b7280" }}>
            Marking scheme (correct / wrong): {markingLabel(attempt.marking)}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries<any>(result.bySubject ?? {}).map(([subject, tally]) => ({
              label: subject,
              points: `${tally.score}/${tally.maxScore}`,
              sub: `${tally.correct} correct • ${tally.incorrect} wrong • ${tally.unanswered} unattempted`,
              color: "#287FC1",
              bg: "#e8f4fd",
            })).map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: row.bg,
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {row.sub}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: row.color,
                  }}
                >
                  {row.points}
                </div>
              </div>
            ))}
            {/* Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                background: "#1a5f94",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                Net Score
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {score}/{maxScore}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "13px 28px",
              background: "#287FC1",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(40,127,193,0.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🏠 Back to Dashboard
          </button>
        </div>

        {/* Footer note */}
        <div
          suppressHydrationWarning
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          Ram Raj Online Exam Portal &bull; Submitted on{" "}
          <span suppressHydrationWarning>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: 16, color: "#287FC1" }}>Loading results...</div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
