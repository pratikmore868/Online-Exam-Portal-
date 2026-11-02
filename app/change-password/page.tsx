"use client";
import React, { useState } from "react";
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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!data.success) {
        setError(data.error || "Could not change the password.");
        return;
      }
      // The root page sends staff on to the admin panel.
      window.location.href = "/";
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <RamRajLogo size="md" variant="dark" />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827", textAlign: "center" }}>
          Set Your Password
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>
          Choose a new password of at least 8 characters to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="current" style={labelStyle}>Current or temporary password</label>
            <input id="current" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="new" style={labelStyle}>New password</label>
            <input id="new" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="confirm" style={labelStyle}>Confirm new password</label>
            <input id="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
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
            {submitting ? "Saving..." : "Save Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
