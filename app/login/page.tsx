"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import RamRajLogo from "../components/RamRajLogo";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  fontSize: 14,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not log in.");
        return;
      }

      // Only follow same-site paths, so a crafted login link can't send someone to another website.
      const next = searchParams.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      const home = data.user.role === "student" ? "/" : "/admin";

      // A full page load, so the new session cookie applies to every request that follows.
      window.location.href = data.user.mustChangePassword ? "/change-password" : safeNext || home;
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label htmlFor="identifier" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Student ID or staff username
        </label>
        <input
          id="identifier"
          autoComplete="username"
          required
          autoFocus
          placeholder="e.g. RR20268084"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error && (
        <div role="alert" style={{ padding: "10px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "12px",
          background: "#287FC1",
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Logging in..." : "Log In"}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
        Forgot your password? Ask your teacher or the institute office to reset it.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <RamRajLogo size="md" variant="dark" />
        </div>
        <h1 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#111827", textAlign: "center" }}>
          Log in to the Exam Portal
        </h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
