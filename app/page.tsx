"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "./components/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar";
import ExamCard from "./components/ExamCard";
import { RequireAuth, useAuth } from "./components/AuthProvider";
import { RotateCw } from "lucide-react";

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "10px",
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniScoreBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  const width = Math.max(0, Math.min(100, percentage));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 100, fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#374151" }}>{percentage}%</div>
    </div>
  );
}

const subjectColors: Record<string, string> = {
  Physics: "#287FC1",
  Chemistry: "#9333ea",
  Mathematics: "#f97316",
  Biology: "#16a34a",
};

function formatStudyTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const emptyPanelStyle: React.CSSProperties = {
  padding: "48px 24px",
  textAlign: "center",
  background: "#ffffff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
};

function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/exams").then((res) => res.json()),
      fetch("/api/student/summary").then((res) => res.json()),
    ])
      .then(([examData, summaryData]) => {
        if (!examData.success || !summaryData.success) {
          setLoadFailed(true);
          return;
        }
        setExams(examData.exams);
        setSummary(summaryData.summary);
      })
      .catch((err) => {
        console.error("Error loading dashboard:", err);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f3f4f6" }}>
      <DashboardHeader studentName={user.name} rollNumber={user.id} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <DashboardSidebar active="dashboard" />

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Welcome banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #287FC1 0%, #1a5f94 100%)",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 24,
              color: "#ffffff",
              boxShadow: "0 4px 20px rgba(40,127,193,0.35)",
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
              👋 Welcome back,
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              {user.name}
            </h1>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
              Batch: <span style={{ fontWeight: 700 }}>{user.batch}</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard
              icon="📝"
              label="Exams Completed"
              value={summary?.examsCompleted ?? "—"}
              color="#287FC1"
            />
            <StatCard
              icon="🎯"
              label="Accuracy"
              value={summary?.accuracy != null ? `${summary.accuracy}%` : "—"}
              sub="Correct out of questions answered"
              color="#16a34a"
            />
            <StatCard
              icon="📈"
              label="Average Score"
              value={summary?.averagePercentage != null ? `${summary.averagePercentage}%` : "—"}
              color="#8b5cf6"
            />
            <StatCard
              icon="⏱"
              label="Time Spent"
              value={summary ? formatStudyTime(summary.timeSeconds) : "—"}
              sub="Across all exams"
              color="#f97316"
            />
          </div>

          {/* Two-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            {/* Left: Available Exams */}
            <div>
              {/* Section Header */}
              <div style={{ marginBottom: 14 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  My Exams
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {exams.length} examination{exams.length === 1 ? "" : "s"} for {user.batch}
                </p>
              </div>

              {/* Exam Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {loading ? (
                  <div style={emptyPanelStyle}>
                    <RotateCw className="w-6 h-6 animate-spin text-[#287FC1] mx-auto mb-2" />
                    <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                      Loading your examinations...
                    </p>
                  </div>
                ) : loadFailed ? (
                  <div style={emptyPanelStyle}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#dc2626" }}>
                      Could not load your exams
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                      Please check your connection and refresh the page.
                    </p>
                  </div>
                ) : exams.length === 0 ? (
                  <div style={emptyPanelStyle}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>
                      No exams assigned yet
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                      Exams for your batch will appear here when your teacher publishes them.
                    </p>
                  </div>
                ) : (
                  exams.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} />
                  ))
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Performance overview */}
              <div className="card" style={{ padding: 20, background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <h3
                  style={{
                    margin: "0 0 16px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>📊</span> Performance by Subject
                </h3>
                {summary?.subjects?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {summary.subjects.map((s: any) => (
                      <MiniScoreBar
                        key={s.name}
                        label={s.name}
                        percentage={s.percentage}
                        color={subjectColors[s.name] ?? "#6b7280"}
                      />
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                    Your subject scores will appear here after your first exam.
                  </p>
                )}
              </div>

              {/* Recent results */}
              <div className="card" style={{ padding: 20, background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  🏁 Recent Results
                </h3>
                {summary?.recent?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {summary.recent.map((r: any) => (
                      <button
                        key={r.examId}
                        onClick={() => router.push(`/exam/${r.examId}/results`)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "8px 6px",
                          background: "none",
                          border: "none",
                          borderBottom: "1px solid #f3f4f6",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{r.examTitle}</span>
                        <span style={{ fontSize: 12, color: "#287FC1", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {r.score}/{r.maxScore}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                    No results yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth roles={["student"]}>
      <Dashboard />
    </RequireAuth>
  );
}
