"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import RamRajLogo from "../../components/RamRajLogo";
import { useAuth } from "../../components/AuthProvider";
import { MAX_WARNINGS } from "@/lib/proctoring";
import { CameraAlert, CameraBlockedOverlay, CameraPreview, LongAbsenceDialog, useCameraProctor } from "./CameraProctor";

// ── Types ────────────────────────────────────────────────────────────────────
type QuestionStatus =
  | "not-visited"
  | "not-answered"
  | "answered"
  | "marked-review"
  | "answered-marked";

type SaveStatus = "saved" | "saving" | "offline" | "logged-out";

interface ExamState {
  answers: Record<string | number, number>; // questionId -> optionIndex
  statuses: Record<string | number, QuestionStatus>;
  currentIndex: number;
  timeLeft: number; // seconds
  submitted: boolean;
}

// ── Timer Component ───────────────────────────────────────────────────────────
function ExamTimer({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const cls =
    seconds < 60
      ? "timer-danger"
      : seconds < 300
      ? "timer-warning"
      : "timer-normal";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 8,
        padding: "6px 14px",
      }}
    >
      <span style={{ fontSize: 14, opacity: 0.9 }}>⏱</span>
      <div>
        <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 1 }}>
          Remaining Time
        </div>
        <div
          className={cls}
          style={{
            fontSize: 18,
            fontWeight: 800,
            fontFamily: "monospace",
            letterSpacing: "1px",
            color: seconds < 60 ? "#fca5a5" : seconds < 300 ? "#fcd34d" : "#ffffff",
          }}
        >
          {timeStr}
        </div>
      </div>
    </div>
  );
}

// ── Question Palette Button ───────────────────────────────────────────────────
function PaletteBtn({
  num,
  status,
  active,
  onClick,
}: {
  num: number;
  status: QuestionStatus;
  active: boolean;
  onClick: () => void;
}) {
  const statusClass: Record<QuestionStatus, string> = {
    "not-visited": "q-not-visited",
    "not-answered": "q-not-answered",
    answered: "q-answered",
    "marked-review": "q-marked-review",
    "answered-marked": "q-answered-marked",
  };

  return (
    <button
      onClick={onClick}
      className={`q-btn ${statusClass[status]}`}
      style={{
        outline: active ? "3px solid #1a5f94" : "none",
        outlineOffset: 2,
        transform: active ? "scale(1.1)" : "scale(1)",
        fontWeight: active ? 800 : 600,
      }}
    >
      {num}
    </button>
  );
}

// ── Submit Dialog ─────────────────────────────────────────────────────────────
function SubmitDialog({
  statuses,
  totalQuestions,
  onConfirm,
  onCancel,
  autoSubmit,
  submitting,
  error,
}: {
  statuses: Record<string | number, QuestionStatus>;
  totalQuestions: number;
  onConfirm: () => void;
  onCancel: () => void;
  autoSubmit?: boolean;
  submitting?: boolean;
  error?: string;
}) {
  const counts = {
    answered: Object.values(statuses).filter((s) => s === "answered").length,
    notAnswered: Object.values(statuses).filter((s) => s === "not-answered").length,
    notVisited: Object.values(statuses).filter((s) => s === "not-visited").length,
    markedReview: Object.values(statuses).filter((s) => s === "marked-review").length,
    answeredMarked: Object.values(statuses).filter(
      (s) => s === "answered-marked"
    ).length,
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div
          style={{
            padding: "20px 24px 0",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {autoSubmit ? (
              <>⏰ Time&apos;s Up! Auto-submitting...</>
            ) : (
              <>📋 Submit Exam Confirmation</>
            )}
          </h2>
          {!autoSubmit && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
              Please review your progress before submitting.
            </p>
          )}
        </div>

        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: "Total Questions",
                value: totalQuestions,
                color: "#287FC1",
                bg: "#e8f4fd",
                icon: "📝",
              },
              {
                label: "Answered",
                value: counts.answered + counts.answeredMarked,
                color: "#16a34a",
                bg: "#dcfce7",
                icon: "✅",
              },
              {
                label: "Not Answered",
                value: counts.notAnswered,
                color: "#dc2626",
                bg: "#fee2e2",
                icon: "❌",
              },
              {
                label: "Not Visited",
                value: counts.notVisited,
                color: "#6b7280",
                bg: "#f3f4f6",
                icon: "👁",
              },
              {
                label: "Marked for Review",
                value: counts.markedReview,
                color: "#7c3aed",
                bg: "#ede9fe",
                icon: "🔖",
              },
              {
                label: "Ans. + Marked",
                value: counts.answeredMarked,
                color: "#7c3aed",
                bg: "#ede9fe",
                icon: "✓🔖",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px",
                  background: item.bg,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: item.color,
                      lineHeight: 1,
                    }}
                  >
                    {item.value}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {counts.notAnswered > 0 && !autoSubmit && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: 8,
                fontSize: 13,
                color: "#92400e",
                marginBottom: 16,
              }}
            >
              ⚠️ You have <strong>{counts.notAnswered}</strong> unanswered
              question(s). Submitting now will leave them blank.
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                background: "#fee2e2",
                borderRadius: 8,
                fontSize: 13,
                color: "#991b1b",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          {!autoSubmit && (
            <button
              suppressHydrationWarning
              onClick={onCancel}
              style={{
                padding: "10px 20px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#ffffff",
                color: "#374151",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue Exam
            </button>
          )}
          <button
            suppressHydrationWarning
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: "10px 24px",
              border: "none",
              borderRadius: 8,
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(22,163,74,0.35)",
            }}
          >
            {submitting ? "Submitting..." : error ? "Try Again" : "Submit Exam →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shown over the blurred paper while the student is away ────────────────────
function AwayOverlay({ finalWarning, isPreview }: { finalWarning: boolean; isPreview: boolean }) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(17,24,39,0.75)",
        color: "#ffffff",
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          {finalWarning ? `Warning ${MAX_WARNINGS} of ${MAX_WARNINGS}: submitting your exam` : "Exam paper hidden"}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.9 }}>
          {isPreview
            ? "Preview: students see this when they leave the exam. Nothing is recorded."
            : finalWarning
            ? "You left the exam too many times, so it is being submitted automatically."
            : "You left the exam screen and this has been recorded. Return to this window to continue."}
        </p>
      </div>
    </div>
  );
}

// ── Shown when the student returns ────────────────────────────────────────────
function WarningDialog({ count, onClose }: { count: number; onClose: () => void }) {
  const remaining = MAX_WARNINGS - count;
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;
  return (
    <div className="modal-overlay" style={{ zIndex: 1900 }}>
      <div className="modal-box" role="alertdialog" aria-labelledby="exam-warning-title">
        <div style={{ padding: "22px 24px" }}>
          <h2 id="exam-warning-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#991b1b" }}>
            ⚠️ Warning {count} of {MAX_WARNINGS}: this has been recorded
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
            You left the exam screen or full screen. The timer keeps running.{" "}
            <strong>
              {remaining === 1
                ? "If you leave once more, your exam will be submitted automatically."
                : `Your exam will be submitted automatically if you leave ${remaining} more times.`}
            </strong>
          </p>
        </div>
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            autoFocus
            onClick={onClose}
            style={{
              padding: "10px 22px",
              border: "none",
              borderRadius: 8,
              background: "#287FC1",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {canFullscreen ? "Return to Full Screen & Continue" : "I Understand, Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shown when the exam opens outside full screen, such as after a refresh ────
function FullscreenPrompt({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1900 }}>
      <div className="modal-box" role="dialog" aria-labelledby="exam-fullscreen-title">
        <div style={{ padding: "22px 24px" }}>
          <h2 id="exam-fullscreen-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
            Continue in full screen
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
            This exam runs in full screen. Your answers are saved and this is not a warning. The timer keeps running.
          </p>
        </div>
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            autoFocus
            onClick={onContinue}
            style={{
              padding: "10px 22px",
              border: "none",
              borderRadius: 8,
              background: "#287FC1",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Enter Full Screen
          </button>
        </div>
      </div>
    </div>
  );
}

// Browsers only allow this from a click or key press, so it can't happen without the button.
// It isn't awaited: this promise never settles in some browsers, and the student must not get stuck.
function enterFullscreen() {
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}

// ── Main Exam Page ────────────────────────────────────────────────────────────
function ExamPageContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;
  const { user } = useAuth();
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [state, setState] = useState<ExamState>({
    answers: {},
    statuses: {},
    currentIndex: 0,
    timeLeft: 0,
    submitted: false,
  });

  const [showSubmit, setShowSubmit] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [away, setAway] = useState(false);
  const [warningToShow, setWarningToShow] = useState<number | null>(null);
  const [finalWarning, setFinalWarning] = useState(false);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);

  // The deadline comes from the server, and the offset corrects for a wrong clock
  // on the student's computer, so neither refreshing nor changing the clock adds time.
  const endsAtRef = useRef(0);
  const clockOffsetRef = useRef(0);
  const attemptIdRef = useRef<string | null>(null);
  const timeSpentRef = useRef<Record<string, number>>({});
  const questionIdsRef = useRef<string[]>([]);
  const warningCountRef = useRef(0);
  // The warning being handled. It stays set until the student acknowledges it, so one
  // incident that fires several browser events can't use up more than one warning.
  const currentEventRef = useRef<string | null>(null);
  const isPreview = exam?.preview === true;
  const cameraEnabled = !!exam?.cameraRequired && !isPreview && !state.submitted;
  const camera = useCameraProctor(exam?.id ?? null, cameraEnabled);

  const stateRef = useRef(state);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<void> | null>(null);
  const submittingRef = useRef(false);
  const readyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remainingSeconds = useCallback(
    () => Math.max(0, Math.ceil((endsAtRef.current - (Date.now() + clockOffsetRef.current)) / 1000)),
    []
  );

  useEffect(() => {
    fetch(`/api/exams/${examId}/attempt`)
      .then(async (res) => {
        const data = await res.json();
        if (!data.success) {
          setLoadError(data.error || "This exam could not be loaded.");
          return;
        }
        const attempt = data.attempt;
        if (!attempt) {
          router.replace(`/exam/${examId}/instructions`);
          return;
        }
        if (attempt.status === "submitted") {
          router.replace(`/exam/${examId}/results`);
          return;
        }

        attemptIdRef.current = attempt.id;
        endsAtRef.current = new Date(attempt.endsAt).getTime();
        clockOffsetRef.current = new Date(attempt.serverNow).getTime() - Date.now();
        timeSpentRef.current = attempt.timeSpent ?? {};
        warningCountRef.current = attempt.violationCount ?? 0;
        if (!attempt.preview && document.fullscreenEnabled && !document.fullscreenElement) {
          setNeedsFullscreen(true);
        }
        questionIdsRef.current = attempt.questions.map((q: any) => q.id);

        setExam(attempt);
        setQuestions(attempt.questions);

        const statuses: Record<string | number, QuestionStatus> = {};
        attempt.questions.forEach((q: any) => {
          statuses[q.id] = attempt.statuses?.[q.id] ?? "not-visited";
        });
        const startIndex = Math.min(attempt.currentIndex ?? 0, Math.max(0, attempt.questions.length - 1));
        const startQuestion = attempt.questions[startIndex];
        if (startQuestion && statuses[startQuestion.id] === "not-visited") {
          statuses[startQuestion.id] = "not-answered";
        }

        setState({
          answers: attempt.answers ?? {},
          statuses,
          currentIndex: startIndex,
          timeLeft: remainingSeconds(),
          submitted: false,
        });
      })
      .catch((err) => {
        console.error("Error loading exam:", err);
        setLoadError("Could not reach the server. Please check your connection and refresh.");
      })
      .finally(() => setFetching(false));
  }, [examId, router, remainingSeconds]);

  // Sends the latest answers. Only one save runs at a time, so an older save can't overwrite a newer one.
  const flushSave = useCallback((): Promise<void> => {
    if (savingRef.current) return savingRef.current;
    if (!dirtyRef.current || !attemptIdRef.current || stateRef.current.submitted) {
      return Promise.resolve();
    }

    dirtyRef.current = false;
    setSaveStatus("saving");
    const { answers, statuses, currentIndex } = stateRef.current;

    const save = fetch(`/api/attempts/${attemptIdRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, statuses, currentIndex, timeSpent: timeSpentRef.current }),
    })
      .then(async (res) => {
        if (res.status === 401) {
          dirtyRef.current = true;
          setSaveStatus("logged-out");
          return;
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        clockOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();

        // Already submitted elsewhere, e.g. in another tab or by the deadline.
        if (data.status === "submitted") {
          if (!submittingRef.current) router.replace(`/exam/${examId}/results`);
          return;
        }
        setSaveStatus(dirtyRef.current ? "saving" : "saved");
      })
      .catch(() => {
        dirtyRef.current = true;
        setSaveStatus("offline");
      })
      .finally(() => {
        savingRef.current = null;
        if (dirtyRef.current && !submittingRef.current) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => flushSave(), 3000);
        }
      });

    savingRef.current = save;
    return save;
  }, [examId, router]);

  // Autosave shortly after any change
  useEffect(() => {
    stateRef.current = state;
    if (fetching || isPreview || !attemptIdRef.current) return;
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(), 800);
    // timeLeft is left out on purpose: it changes every second and doesn't need saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.answers, state.statuses, state.currentIndex, fetching, isPreview, flushSave]);

  // Retry as soon as the connection returns, and try once more if the page is being closed.
  useEffect(() => {
    const handleOnline = () => flushSave();
    const handlePageHide = () => {
      if (!dirtyRef.current || !attemptIdRef.current) return;
      const { answers, statuses, currentIndex } = stateRef.current;
      fetch(`/api/attempts/${attemptIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, statuses, currentIndex, timeSpent: timeSpentRef.current }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushSave]);

  // Timer
  useEffect(() => {
    if (state.submitted || fetching || !attemptIdRef.current) return;
    const timer = setInterval(() => {
      const left = remainingSeconds();
      setState((prev) => (prev.timeLeft === left ? prev : { ...prev, timeLeft: left }));

      // Seconds on the question currently on screen, for the admin Time Analysis tab.
      const onScreen = questionIdsRef.current[stateRef.current.currentIndex];
      if (onScreen) timeSpentRef.current[onScreen] = (timeSpentRef.current[onScreen] ?? 0) + 1;
      if (left <= 0) {
        setAutoSubmit(true);
        setShowSubmit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [state.submitted, fetching, remainingSeconds]);

  const currentQ = questions[state.currentIndex] || questions[0];

  // Navigate to a question
  const goToQuestion = useCallback(
    (index: number) => {
      if (!questions[index]) return;
      const targetQ = questions[index];
      setState((prev) => {
        const newStatuses = { ...prev.statuses };
        // Mark target as not-answered if not-visited
        if (newStatuses[targetQ.id] === "not-visited") {
          newStatuses[targetQ.id] = "not-answered";
        }
        return { ...prev, currentIndex: index, statuses: newStatuses };
      });
    },
    [questions]
  );

  // Select an answer
  const selectAnswer = (optionIdx: number) => {
    const qId = currentQ.id;
    setState((prev) => {
      const newStatuses = { ...prev.statuses };
      // If currently marked-review + now answering -> answered-marked
      if (newStatuses[qId] === "marked-review") {
        newStatuses[qId] = "answered-marked";
      } else if (
        newStatuses[qId] !== "answered-marked"
      ) {
        newStatuses[qId] = "answered";
      }
      return {
        ...prev,
        answers: { ...prev.answers, [qId]: optionIdx },
        statuses: newStatuses,
      };
    });
  };

  // Save & Next
  const saveAndNext = () => {
    const qId = currentQ.id;
    setState((prev) => {
      const newStatuses = { ...prev.statuses };
      if (prev.answers[qId] !== undefined) {
        newStatuses[qId] =
          newStatuses[qId] === "marked-review" ? "answered-marked" : "answered";
      } else {
        newStatuses[qId] = "not-answered";
      }
      const nextIdx = Math.min(state.currentIndex + 1, questions.length - 1);
      const nextQId = questions[nextIdx].id;
      if (newStatuses[nextQId] === "not-visited") {
        newStatuses[nextQId] = "not-answered";
      }
      return { ...prev, statuses: newStatuses, currentIndex: nextIdx };
    });
  };

  // Save & Mark for Review
  const saveAndMark = () => {
    const qId = currentQ.id;
    setState((prev) => {
      const newStatuses = { ...prev.statuses };
      if (prev.answers[qId] !== undefined) {
        newStatuses[qId] = "answered-marked";
      } else {
        newStatuses[qId] = "marked-review";
      }
      const nextIdx = Math.min(state.currentIndex + 1, questions.length - 1);
      const nextQId = questions[nextIdx].id;
      if (newStatuses[nextQId] === "not-visited") {
        newStatuses[nextQId] = "not-answered";
      }
      return { ...prev, statuses: newStatuses, currentIndex: nextIdx };
    });
  };

  // Mark for Review & Next. A selected answer stays selected and is still marked by the server,
  // so the status must say so: "marked-review" here would show an evaluated answer as unanswered.
  const markAndNext = () => {
    const qId = currentQ.id;
    setState((prev) => {
      const newStatuses = { ...prev.statuses };
      newStatuses[qId] = prev.answers[qId] !== undefined ? "answered-marked" : "marked-review";
      const nextIdx = Math.min(state.currentIndex + 1, questions.length - 1);
      const nextQId = questions[nextIdx].id;
      if (newStatuses[nextQId] === "not-visited") {
        newStatuses[nextQId] = "not-answered";
      }
      return { ...prev, statuses: newStatuses, currentIndex: nextIdx };
    });
  };

  // Clear response
  const clearResponse = () => {
    const qId = currentQ.id;
    setState((prev) => {
      const newAnswers = { ...prev.answers };
      delete newAnswers[qId];
      const newStatuses = { ...prev.statuses };
      newStatuses[qId] = "not-answered";
      return { ...prev, answers: newAnswers, statuses: newStatuses };
    });
  };

  // Navigate back
  const goBack = () => {
    if (state.currentIndex > 0) goToQuestion(state.currentIndex - 1);
  };

  // Navigate next
  const goNext = () => {
    if (state.currentIndex < questions.length - 1)
      goToQuestion(state.currentIndex + 1);
  };

  // Submit. The server works out the score from the saved answers.
  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;

    const leaveFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };

    if (isPreview) {
      leaveFullscreen();
      router.push(`/admin/exams/${examId}`);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    try {
      // Let any running save finish first so it can't land after the final answers.
      if (savingRef.current) await savingRef.current;

      const { answers, statuses, currentIndex } = stateRef.current;
      const res = await fetch(`/api/attempts/${attemptIdRef.current}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, statuses, currentIndex, timeSpent: timeSpentRef.current }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      dirtyRef.current = false;
      setState((prev) => ({ ...prev, submitted: true }));
      leaveFullscreen();
      router.replace(`/exam/${examId}/results`);
    } catch {
      // Answers already saved are safe. If the student never gets back online, the server
      // submits them at the deadline anyway.
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError("Could not submit: please check your internet connection. Your saved answers are safe.");
    }
  }, [examId, isPreview, router]);

  // When time runs out, submit without waiting for a click, and keep retrying if the network is down.
  useEffect(() => {
    if (!autoSubmit || isPreview || state.submitted) return;
    handleSubmit();
    const retry = setInterval(() => {
      if (!submittingRef.current) handleSubmit();
    }, 5000);
    return () => clearInterval(retry);
  }, [autoSubmit, isPreview, state.submitted, handleSubmit]);

  // Leaving the exam: hide the paper at once, record it, and warn when the student returns.
  useEffect(() => {
    if (fetching || !attemptIdRef.current || state.submitted) return;

    let stopped = false;
    let isAway = false;
    let unloading = false;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    const retryTimers = new Set<ReturnType<typeof setTimeout>>();

    // Keeps retrying through a dropped connection, because the warning must still reach the server.
    const send = (body: Record<string, unknown>) => {
      fetch(`/api/attempts/${attemptIdRef.current}/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403 || res.status === 404) return;
          const data = await res.json();
          if (!data.success) throw new Error(data.error);
          if (data.status === "submitted") {
            submittingRef.current = true;
            if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
            router.replace(`/exam/${examId}/results`);
          } else if (typeof data.violationCount === "number") {
            warningCountRef.current = data.violationCount;
          }
        })
        .catch(() => {
          if (stopped) return;
          const timer = setTimeout(() => {
            retryTimers.delete(timer);
            send(body);
          }, 3000);
          retryTimers.add(timer);
        });
    };

    const recordLeave = (type: string) => {
      if (currentEventRef.current) return;
      currentEventRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      warningCountRef.current += 1;
      if (warningCountRef.current >= MAX_WARNINGS) {
        // The server submits on this report, so stop autosaving now.
        submittingRef.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setFinalWarning(true);
      }
      const { answers, statuses, currentIndex } = stateRef.current;
      send({ eventId: currentEventRef.current, type, answers, statuses, currentIndex, timeSpent: timeSpentRef.current });
    };

    const onLeave = (type: string) => {
      if (unloading || submittingRef.current) return;
      if (!isAway) {
        isAway = true;
        setAway(true);
      }
      if (isPreview) return;

      if (type === "tab-hidden") {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = null;
        recordLeave(type);
      } else if (!blurTimer && !currentEventRef.current) {
        // Losing focus for a moment can be accidental, such as a notification, so give it a second.
        blurTimer = setTimeout(() => {
          blurTimer = null;
          if (isAway) recordLeave(type);
        }, 1000);
      }
    };

    const onReturn = () => {
      if (!isAway || document.hidden) return;
      isAway = false;
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = null;

      // On the final warning the paper stays hidden until the results page opens.
      if (warningCountRef.current >= MAX_WARNINGS && !isPreview) return;
      setAway(false);

      if (currentEventRef.current) {
        send({ eventId: currentEventRef.current, returned: true });
        setWarningToShow(warningCountRef.current);
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setNeedsFullscreen(false);
        return;
      }
      if (unloading || submittingRef.current || isPreview || currentEventRef.current) return;
      recordLeave("fullscreen-exit");
      if (warningCountRef.current < MAX_WARNINGS) setWarningToShow(warningCountRef.current);
    };

    // Fullscreen may have finished entering while the exam was still loading.
    if (document.fullscreenElement) setNeedsFullscreen(false);

    const handleVisibility = () => (document.hidden ? onLeave("tab-hidden") : onReturn());
    const handleBlur = () => onLeave("window-blur");
    // A refresh or closing the tab also hides the page, but isn't switching away.
    const handleUnload = () => {
      unloading = true;
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = null;
    };
    const handlePageShow = () => {
      unloading = false;
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", onReturn);
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      stopped = true;
      if (blurTimer) clearTimeout(blurTimer);
      retryTimers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [fetching, isPreview, state.submitted, examId, router]);

  // The click on this button is what the browser requires to go back into full screen.
  const acknowledgeWarning = () => {
    const eventId = currentEventRef.current;
    currentEventRef.current = null;
    setWarningToShow(null);
    enterFullscreen();
    if (eventId && attemptIdRef.current) {
      fetch(`/api/attempts/${attemptIdRef.current}/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, returned: true }),
      }).catch(() => undefined);
    }
  };

  // Palette summary counts
  const statusCounts = {
    notVisited: Object.values(state.statuses).filter(
      (s) => s === "not-visited"
    ).length,
    notAnswered: Object.values(state.statuses).filter(
      (s) => s === "not-answered"
    ).length,
    answered: Object.values(state.statuses).filter(
      (s) => s === "answered"
    ).length,
    markedReview: Object.values(state.statuses).filter(
      (s) => s === "marked-review"
    ).length,
    answeredMarked: Object.values(state.statuses).filter(
      (s) => s === "answered-marked"
    ).length,
  };

  const selectedAnswer = state.answers[currentQ?.id];

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Enter on a focused button must only press that button, and the keys do nothing behind the dialog.
      if (showSubmit || away || needsFullscreen || camera.longAbsence || warningToShow !== null || (e.target as HTMLElement)?.tagName === "BUTTON") return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "Enter") saveAndNext();
      if (e.key === "Delete") clearResponse();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentIndex, state.answers, state.statuses, showSubmit, away, warningToShow, needsFullscreen, camera.longAbsence]);

  if (!fetching && (loadError || (exam && questions.length === 0))) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6", padding: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
            Exam not available
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            {loadError || "This exam has no questions yet."}
          </div>
          <button
            onClick={() => router.push(user.role === "student" ? "/" : `/admin/exams/${examId}`)}
            style={{ padding: "10px 20px", background: "#287FC1", color: "#ffffff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (fetching || questions.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#287FC1", marginBottom: 8 }}>
            Loading Examination Questions...
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Please wait while the question paper is securely fetched from the database
          </div>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  const sections: { name: string; questionIds: string[] }[] = exam?.sections ?? [];
  const currentSection = sections.find((s) => s.questionIds.includes(currentQ.id));

  return (
    <>
    {/* These sit outside the blurred page so they stay sharp and cover the whole screen. */}
    {(away || finalWarning) && <AwayOverlay finalWarning={finalWarning} isPreview={isPreview} />}
    {warningToShow !== null && !away && !finalWarning && (
      <WarningDialog count={warningToShow} onClose={acknowledgeWarning} />
    )}
    {cameraEnabled && <CameraAlert types={camera.activeTypes} />}
    {cameraEnabled && camera.longAbsence && !away && !finalWarning && warningToShow === null && !camera.blocked && !needsFullscreen && (
      <LongAbsenceDialog onClose={camera.dismissLongAbsence} />
    )}
    {camera.blocked && !away && !finalWarning && warningToShow === null && !needsFullscreen && (
      <CameraBlockedOverlay
        error={camera.cameraError}
        canContinue={camera.canContinueWithoutCamera}
        onRetry={camera.retryCamera}
        onContinue={camera.continueWithoutCamera}
      />
    )}
    {needsFullscreen && warningToShow === null && !away && !finalWarning && (
      <FullscreenPrompt
        onContinue={() => {
          setNeedsFullscreen(false);
          enterFullscreen();
        }}
      />
    )}
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f0f2f5",
        overflow: "hidden",
        // The paper stays hidden until a warning is acknowledged.
        filter: away || finalWarning || needsFullscreen || camera.blocked || (cameraEnabled && camera.longAbsence) || warningToShow !== null ? "blur(18px)" : undefined,
      }}
    >
      {/* ── Exam Header ── */}
      <div className="exam-header">
        <RamRajLogo size="sm" variant="light" />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Student info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "5px 12px",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffff" }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
                {user.id}
              </div>
            </div>
          </div>

          {/* Autosave status */}
          <div
            aria-live="polite"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: saveStatus === "offline" || saveStatus === "logged-out" ? "#fecaca" : "rgba(255,255,255,0.85)",
            }}
          >
            {isPreview
              ? "Preview: nothing is saved"
              : saveStatus === "saved"
              ? "✓ All answers saved"
              : saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "offline"
              ? "⚠ Offline: retrying save..."
              : "⚠ Logged out: log in again in a new tab"}
          </div>

          <ExamTimer seconds={state.timeLeft} />
        </div>
      </div>

      {/* ── Exam Sub-header (Exam title) ── */}
      <div className="exam-subheader">
        <span>{exam?.examTitle || "CBT Examination"}</span>
        {exam?.batch && (
          <span style={{ fontSize: 11, opacity: 0.85, marginLeft: 10 }}>
            Batch: {exam.batch}
          </span>
        )}
      </div>

      {/* ── Section tabs ── */}
      <div
        role="tablist"
        aria-label="Exam sections"
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {sections.map((section) => {
          const isActive = section === currentSection;
          const answered = section.questionIds.filter((id) => state.answers[id] !== undefined).length;
          return (
            <button
              key={section.name}
              role="tab"
              aria-selected={isActive}
              onClick={() => goToQuestion(questions.findIndex((q) => q.id === section.questionIds[0]))}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: isActive ? "1px solid #287FC1" : "1px solid #d1d5db",
                background: isActive ? "#287FC1" : "#ffffff",
                color: isActive ? "#ffffff" : "#374151",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {section.name}{" "}
              <span style={{ fontWeight: 500, opacity: 0.85 }}>
                ({answered}/{section.questionIds.length})
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Content ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* ── Question Area (Left) ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Question content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              background: "#ffffff",
            }}
          >
            {/* Question number */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  background: "#287FC1",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Q{state.currentIndex + 1}
              </span>
              <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 12 }}>
                of {questions.length}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  background:
                    currentQ.subject === "Physics"
                      ? "#e8f4fd"
                      : currentQ.subject === "Chemistry"
                      ? "#fdf4ff"
                      : "#fff7ed",
                  color:
                    currentQ.subject === "Physics"
                      ? "#287FC1"
                      : currentQ.subject === "Chemistry"
                      ? "#9333ea"
                      : "#ea580c",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontWeight: 600,
                }}
              >
                {currentQ.subject}
              </span>
            </div>

            {/* Question text */}
            <div
              style={{
                fontSize: 15,
                color: "#111827",
                lineHeight: 1.7,
                marginBottom: 24,
                fontWeight: 500,
                padding: "0 4px",
              }}
            >
              {currentQ.text}
            </div>

            {/* Options */}
            <div style={{ maxWidth: 680 }}>
              {currentQ.options.map((option: string, idx: number) => (
                <div
                  key={idx}
                  className={`exam-option ${selectedAnswer === idx ? "selected" : ""}`}
                  onClick={() => selectAnswer(idx)}
                  id={`option-${idx}`}
                >
                  <input
                    type="radio"
                    name={`q-${currentQ.id}`}
                    checked={selectedAnswer === idx}
                    onChange={() => selectAnswer(idx)}
                    id={`radio-${idx}`}
                  />
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background:
                        selectedAnswer === idx ? "#287FC1" : "#e5e7eb",
                      color: selectedAnswer === idx ? "#ffffff" : "#374151",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <label
                    htmlFor={`radio-${idx}`}
                    style={{
                      fontSize: 14,
                      color: selectedAnswer === idx ? "#1a5f94" : "#374151",
                      fontWeight: selectedAnswer === idx ? 600 : 400,
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── Exam Controls ── */}
          <div className="exam-controls">
            <button className="ctrl-btn ctrl-save-next" onClick={saveAndNext}>
              SAVE &amp; NEXT
            </button>
            <button className="ctrl-btn ctrl-save-mark" onClick={saveAndMark}>
              SAVE &amp; MARK FOR REVIEW
            </button>
            <button className="ctrl-btn ctrl-clear" onClick={clearResponse}>
              CLEAR RESPONSE
            </button>
            <button className="ctrl-btn ctrl-mark-next" onClick={markAndNext}>
              MARK FOR REVIEW &amp; NEXT
            </button>

            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <button
                className="ctrl-btn ctrl-nav"
                onClick={goBack}
                disabled={state.currentIndex === 0}
                style={{
                  opacity: state.currentIndex === 0 ? 0.4 : 1,
                  cursor: state.currentIndex === 0 ? "not-allowed" : "pointer",
                }}
              >
                ◀ BACK
              </button>
              <button
                className="ctrl-btn ctrl-nav"
                onClick={goNext}
                disabled={state.currentIndex === questions.length - 1}
                style={{
                  opacity:
                    state.currentIndex === questions.length - 1 ? 0.4 : 1,
                  cursor:
                    state.currentIndex === questions.length - 1
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                NEXT ▶
              </button>
              <button
                className="ctrl-btn ctrl-submit"
                id="submit-exam-btn"
                onClick={() => {
                  setAutoSubmit(false);
                  setShowSubmit(true);
                }}
                style={{ marginLeft: 8 }}
              >
                SUBMIT
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar (Palette) ── */}
        <div
          style={{
            width: 300,
            background: "#ffffff",
            borderLeft: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Palette header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#374151",
                marginBottom: 10,
              }}
            >
              Question Summary
            </div>
            {/* Status legend mini */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                {
                  count: statusCounts.notVisited,
                  label: "Not Visited",
                  color: "#ffffff",
                  border: "#d1d5db",
                  textColor: "#374151",
                  round: false,
                },
                {
                  count: statusCounts.notAnswered,
                  label: "Not Answered",
                  color: "#ef4444",
                  border: "#dc2626",
                  textColor: "#fff",
                  round: false,
                },
                {
                  count: statusCounts.answered,
                  label: "Answered",
                  color: "#22c55e",
                  border: "#16a34a",
                  textColor: "#fff",
                  round: false,
                },
                {
                  count: statusCounts.markedReview,
                  label: "Marked for Review",
                  color: "#7c3aed",
                  border: "#6d28d9",
                  textColor: "#fff",
                  round: true,
                },
                {
                  count: statusCounts.answeredMarked,
                  label: "Answered & Marked",
                  color: "#7c3aed",
                  border: "#6d28d9",
                  textColor: "#fff",
                  round: true,
                  dot: true,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: item.round ? "50%" : 5,
                      background: item.color,
                      border: `1.5px solid ${item.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: item.textColor,
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {item.count}
                    {item.dot && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: -3,
                          right: -3,
                          width: 10,
                          height: 10,
                          background: "#22c55e",
                          borderRadius: "50%",
                          border: "1px solid #fff",
                        }}
                      />
                    )}
                  </div>
                  <span style={{ fontSize: 11.5, color: "#374151" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Question palette grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {currentSection ? `${currentSection.name} Questions` : "Navigate Questions"}
            </div>
            <div className="palette-grid">
              {questions.map((q, idx) => currentSection && !currentSection.questionIds.includes(q.id) ? null : (
                <PaletteBtn
                  key={q.id}
                  num={idx + 1}
                  status={state.statuses[q.id] || "not-visited"}
                  active={idx === state.currentIndex}
                  onClick={() => goToQuestion(idx)}
                />
              ))}
            </div>
          </div>

          {cameraEnabled && <CameraPreview videoCallback={camera.videoCallback} />}

          {/* Submit button in sidebar */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={() => {
                setAutoSubmit(false);
                setShowSubmit(true);
              }}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
              }}
            >
              SUBMIT EXAM
            </button>
          </div>
        </div>
      </div>

      {/* ── Submit Dialog ── */}
      {showSubmit && (
        <SubmitDialog
          statuses={state.statuses}
          totalQuestions={questions.length}
          onConfirm={handleSubmit}
          onCancel={() => setShowSubmit(false)}
          autoSubmit={autoSubmit}
          submitting={submitting}
          error={submitError}
        />
      )}
    </div>
    </>
  );
}

import { Suspense } from "react";
export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#f0f2f5",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, color: "#287FC1", fontWeight: 600 }}>
              Loading Exam...
            </div>
          </div>
        </div>
      }
    >
      <ExamPageContent />
    </Suspense>
  );
}
