"use client";
import React from "react";
import RamRajLogo from "./RamRajLogo";

interface DashboardHeaderProps {
  studentName: string;
  rollNumber: string;
}

export default function DashboardHeader({
  studentName,
  rollNumber,
}: DashboardHeaderProps) {
  const initials = studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 24px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <RamRajLogo size="md" variant="dark" />

      {/* Profile */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 12px 6px 6px",
          border: "1px solid #e5e7eb",
          borderRadius: "40px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #287FC1 0%, #1a5f94 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: "700",
            fontSize: 13,
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.2 }}
          >
            {studentName}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{rollNumber}</div>
        </div>
      </div>
    </header>
  );
}
