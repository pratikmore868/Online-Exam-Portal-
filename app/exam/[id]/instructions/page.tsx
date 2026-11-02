"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import RamRajLogo from "../../../components/RamRajLogo";
import { useAuth } from "../../../components/AuthProvider";
import { MAX_WARNINGS } from "@/lib/proctoring";
import { markingLabel } from "@/lib/scoring";

function ExamInstructionsContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;
  const { user } = useAuth();

  const [exam, setExam] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    fetch(`/api/exams/${examId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.exam) {
          // Students who already started don't need to see this page again.
          if (data.exam.attempt?.status === "in_progress") {
            router.replace(`/exam/${examId}`);
          } else if (data.exam.attempt?.status === "submitted") {
            router.replace(`/exam/${examId}/results`);
          }
          setExam(data.exam);
        }
      })
      .catch((err) => console.error("Error loading exam:", err))
      .finally(() => setFetching(false));
  }, [examId, router]);

  const handleStartExam = async () => {
    if (!agreed) return;
    setLoading(true);
    setStartError("");

    // Fullscreen is optional, and not awaited: in some browsers this promise never settles,
    // which would leave the student unable to start.
    document.documentElement.requestFullscreen?.().catch(() => undefined);

    // Staff previews don't create an attempt.
    if (user.role !== "student") {
      router.push(`/exam/${examId}`);
      return;
    }

    try {
      const res = await fetch(`/api/exams/${examId}/attempt`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setStartError(data.error || "Could not start the exam.");
        setLoading(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
        return;
      }
      router.push(`/exam/${examId}`);
    } catch {
      setStartError("Could not reach the server. Please check your connection and try again.");
      setLoading(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    }
  };

  if (fetching) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#287FC1", marginBottom: 8 }}>Loading Assessment...</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Preparing your examination paper</div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6", padding: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Exam not available</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            This exam doesn&apos;t exist or isn&apos;t assigned to your batch.
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "10px 20px", background: "#287FC1", color: "#ffffff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const title = exam.title;
  const duration = exam.duration;
  const totalQuestions = exam.totalQuestions ?? exam.questions?.length ?? 0;
  const totalMarks = exam.totalMarks;
  const subject = exam.subject;
  const batch = exam.batch;
  const marking = markingLabel(exam.marking);
  const hasNegativeMarking = (exam.marking?.wrong ?? 0) > 0
    || Object.values<any>(exam.marking?.subjects ?? {}).some((rule) => rule.wrong > 0);

  const instructions = [
    "This exam consists of **" + totalQuestions + " questions** worth **" + totalMarks + " marks**.",
    "You will have **" + duration + " minutes** to complete the exam. The timer starts immediately after you click 'I Am Ready to Start' and keeps running even if you close the browser.",
    "Marking scheme (correct / wrong): **" + marking + "**. " + (hasNegativeMarking ? "**Wrong answers lose marks.**" : "There is no negative marking.") + " Unanswered questions score zero.",
    "Assigned Student Batch: **" + batch + "**.",
    "Your answers are **saved automatically**. If your browser closes or your internet drops, log in again and you can continue where you stopped, but the timer does not pause.",
    "You can attempt this exam **only once**.",
    "**Stay on the exam screen.** Each time you switch tabs, minimise the browser, move to another window or exit full screen, the paper is hidden, you get a warning, and it is recorded. **On warning " + MAX_WARNINGS + ", your exam is submitted automatically.**",
    "Read each question carefully before selecting an answer. You can navigate between questions using the question palette.",
    "Use **SAVE & NEXT** to save your answer and move to the next question.",
    "Use **MARK FOR REVIEW** to flag questions you want to revisit later.",
    "A question marked as **Answered & Marked for Review** will be considered for evaluation.",
    "Once the timer expires, your exam will be **automatically submitted**.",
    "In case of a technical issue, immediately notify the exam supervisor.",
  ];

  const legendItems = [
    {
      color: "#ffffff",
      border: "#d1d5db",
      label: "Not Visited",
      desc: "You have not visited this question yet",
    },
    {
      color: "#ef4444",
      border: "#dc2626",
      label: "Not Answered",
      desc: "You visited but did not answer",
    },
    {
      color: "#22c55e",
      border: "#16a34a",
      label: "Answered",
      desc: "You have answered the question",
    },
    {
      color: "#7c3aed",
      border: "#6d28d9",
      label: "Marked for Review",
      desc: "Marked but not answered — will not be evaluated",
      round: true,
    },
    {
      color: "#7c3aed",
      border: "#6d28d9",
      label: "Answered & Marked",
      desc: "Answered and marked — WILL be evaluated",
      round: true,
      dot: true,
    },
  ];

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
        <button
          onClick={() => router.push("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 16px",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          ← Back to Dashboard
        </button>
      </header>

      {/* Exam title bar */}
      <div
        style={{
          background: "#1a5f94",
          padding: "12px 24px",
          color: "#ffffff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.8, marginTop: 2 }}>
          {subject} &bull; {duration} minutes &bull;{" "}
          {totalQuestions} questions &bull; {totalMarks} marks &bull; Batch: {batch}
        </p>
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: 1100,
          width: "100%",
          marginInline: "auto",
          padding: "28px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* Left: Instructions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* General Instructions */}
          <div className="card" style={{ padding: 24 }}>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 17,
                fontWeight: 700,
                color: "#111827",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 12,
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#287FC1",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                ℹ
              </span>
              General Instructions
            </h2>

            <ol
              style={{
                margin: 0,
                padding: "0 0 0 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {instructions.map((instr, idx) => {
                // Parse bold text
                const parts = instr.split(/\*\*(.*?)\*\*/g);
                return (
                  <li
                    key={idx}
                    style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}
                  >
                    {parts.map((part, pi) =>
                      pi % 2 === 1 ? (
                        <strong key={pi} style={{ color: "#111827" }}>
                          {part}
                        </strong>
                      ) : (
                        part
                      )
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Important Guidelines */}
          <div
            style={{
              background: "#fef9c3",
              border: "1.5px solid #fde68a",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⚠️ Important Guidelines
            </h3>
            <ul
              style={{
                margin: 0,
                padding: "0 0 0 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {[
                "Ensure a stable internet connection before starting the exam.",
                "Use of calculator, mobile phone, or any electronic device is strictly prohibited.",
                "The examination window must remain active at all times.",
                "Any attempt to copy or share questions will result in disqualification.",
                "Contact your supervisor immediately in case of any technical difficulty.",
              ].map((g, i) => (
                <li
                  key={i}
                  style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}
                >
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🔒 Exam Security Notice
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
              Malpractice, including using outside resources or sharing
              questions, may result in disqualification. The examination is
              governed by Ram Raj Institute&#39;s fair examination
              policy.
            </p>
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(220,38,38,0.08)",
                borderRadius: 6,
                fontSize: 12,
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              🛡 Fullscreen Mode Recommended
            </div>
          </div>

          {/* Declaration */}
          <div
            className="card"
            style={{
              padding: 20,
              border: agreed ? "2px solid #22c55e" : "2px solid #e5e7eb",
              transition: "border-color 0.2s",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                id="exam-declaration"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  accentColor: "#22c55e",
                  marginTop: 2,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  Declaration
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  I have read and understood all the instructions mentioned above.
                  I agree to abide by the rules and regulations of Ram Raj Online
                  Examination Portal. I understand that any violation may lead to
                  disqualification.
                </p>
              </div>
            </label>
          </div>

          {startError && (
            <div role="alert" style={{ padding: "10px 14px", background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              {startError}
            </div>
          )}

          {/* Start Button */}
          <button
            id="start-exam-btn"
            disabled={!agreed || loading}
            onClick={handleStartExam}
            style={{
              width: "100%",
              padding: "16px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 10,
              border: "none",
              cursor: agreed ? "pointer" : "not-allowed",
              background: agreed
                ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                : "#d1d5db",
              color: agreed ? "#ffffff" : "#9ca3af",
              transition: "all 0.2s",
              boxShadow: agreed
                ? "0 4px 16px rgba(22,163,74,0.35)"
                : "none",
              transform: agreed ? "translateY(0)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {loading ? (
              <>
                <span style={{ fontSize: 18 }}>⏳</span>
                Starting Exam...
              </>
            ) : (
              <>
                <span style={{ fontSize: 18 }}>✅</span>
                I Am Ready to Start the Examination
              </>
            )}
          </button>
        </div>

        {/* Right: Legend & Exam Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Exam Summary Card */}
          <div
            className="card"
            style={{
              padding: 20,
              background: "linear-gradient(135deg, #287FC1 0%, #1a5f94 100%)",
              color: "#ffffff",
              border: "none",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
              📋 Exam Summary
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Total Questions", value: totalQuestions },
                { label: "Total Marks", value: totalMarks },
                { label: "Marking (correct / wrong)", value: marking },
                { label: "Duration", value: `${exam.duration} minutes` },
                { label: "Subject", value: exam.subject },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "7px 10px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 6,
                  }}
                >
                  <span style={{ fontSize: 12, opacity: 0.85 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Status Legend */}
          <div className="card" style={{ padding: 20 }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              🎨 Question Status Legend
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {legendItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: item.round ? "50%" : 6,
                      background: item.color,
                      border: `2px solid ${item.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        item.color === "#ffffff" ? "#374151" : "#ffffff",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    1
                    {item.dot && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: -3,
                          right: -3,
                          width: 12,
                          height: 12,
                          background: "#22c55e",
                          borderRadius: "50%",
                          border: "1px solid #fff",
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.3 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h4
              style={{
                margin: "0 0 10px",
                fontSize: 12,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              ⌨️ Quick Navigation
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Save & Next", "Enter"],
                ["Previous Question", "←"],
                ["Next Question", "→"],
                ["Clear Response", "Del"],
              ].map(([action, key]) => (
                <div
                  key={action}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {action}
                  </span>
                  <kbd
                    style={{
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#374151",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamInstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: 16, color: "#287FC1" }}>Loading...</div>
      </div>
    }>
      <ExamInstructionsContent />
    </Suspense>
  );
}
