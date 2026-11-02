"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { markingLabel } from "@/lib/scoring";

interface ExamCardProps {
  exam: any;
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "Easy":
      return { bg: "#dcfce7", color: "#15803d" };
    case "Medium":
      return { bg: "#fef3c7", color: "#92400e" };
    case "Hard":
      return { bg: "#fee2e2", color: "#991b1b" };
    default:
      return { bg: "#f3f4f6", color: "#374151" };
  }
}

function getSubjectColor(subject: string = "") {
  if (subject.includes("Physics")) return { bg: "#e8f4fd", color: "#287FC1" };
  if (subject.includes("Chemistry")) return { bg: "#fdf4ff", color: "#9333ea" };
  if (subject.includes("Math")) return { bg: "#fff7ed", color: "#ea580c" };
  if (subject.includes("Biology")) return { bg: "#f0fdf4", color: "#16a34a" };
  return { bg: "#f1f5f9", color: "#334155" };
}

function CountdownTimer({ until, label }: { until: string; label: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const targetDate = new Date(until);
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h`);
      else setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [until]);

  if (!timeLeft) return null;

  return (
    <span className="countdown-badge">
      <span>⏱</span> {label} {timeLeft}
    </span>
  );
}

const primaryButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 18px",
  background: "#287FC1",
  color: "#ffffff",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(40,127,193,0.3)"
};

export default function ExamCard({ exam }: ExamCardProps) {
  const router = useRouter();
  const diffColor = getDifficultyColor(exam.difficulty || "Medium");
  const subjectColor = getSubjectColor(exam.subject || "CBT");
  const attempt = exam.attempt;

  const renderAction = () => {
    if (attempt?.status === "submitted") {
      return (
        <button style={primaryButton} onClick={() => router.push(`/exam/${exam.id}/results`)}>
          📊 View Result ({attempt.score}/{attempt.maxScore})
        </button>
      );
    }
    if (attempt?.status === "in_progress") {
      return (
        <button
          id={`start-exam-${exam.id}`}
          style={{ ...primaryButton, background: "#ea580c" }}
          onClick={() => router.push(`/exam/${exam.id}`)}
        >
          ▶ Resume Exam
        </button>
      );
    }
    if (exam.availability === "upcoming") {
      return (
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
          Opens {new Date(exam.availableFrom).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      );
    }
    if (exam.availability === "closed") {
      return <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Exam closed</span>;
    }
    return (
      <button
        id={`start-exam-${exam.id}`}
        style={primaryButton}
        onClick={() => router.push(`/exam/${exam.id}/instructions`)}
      >
        <span>▶</span> Start Exam
      </button>
    );
  };

  return (
    <div
      className="card card-hover"
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        borderLeft: "4px solid #287FC1",
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        borderLeftWidth: "4px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 6,
            }}
          >
            {exam.title}
          </h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span
              className="badge"
              style={{
                background: subjectColor.bg,
                color: subjectColor.color,
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600
              }}
            >
              {exam.subject || "CBT Test"}
            </span>
            <span
              className="badge"
              style={{
                background: "#f3e8ff",
                color: "#7e22ce",
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600
              }}
            >
              Batch: {exam.batch || "General"}
            </span>
            <span
              className="badge"
              style={{
                background: diffColor.bg,
                color: diffColor.color,
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600
              }}
            >
              {exam.difficulty || "Medium"}
            </span>
          </div>
        </div>
        {exam.availability === "upcoming" && exam.availableFrom && (
          <CountdownTimer until={exam.availableFrom} label="Starts in" />
        )}
        {exam.availability === "open" && !attempt && exam.availableUntil && (
          <CountdownTimer until={exam.availableUntil} label="Closes in" />
        )}
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "#6b7280",
          lineHeight: 1.5,
        }}
      >
        {exam.description || `Batch ${exam.batch} full mock CBT examination.`}
      </p>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          padding: "12px",
          background: "#f9fafb",
          borderRadius: "8px",
        }}
      >
        {[
          { label: "Duration", value: `${exam.duration} min`, icon: "⏰" },
          { label: "Questions", value: exam.totalQuestions ?? 0, icon: "❓" },
          { label: "Total Marks", value: exam.totalMarks, icon: "🎯" },
          { label: "Marking", value: markingLabel(exam.marking), icon: "⚖️" },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, marginBottom: 2 }}>{stat.icon}</div>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
        }}
      >
        {renderAction()}
      </div>
    </div>
  );
}
