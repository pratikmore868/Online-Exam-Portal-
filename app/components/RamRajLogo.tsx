"use client";

import React from "react";

interface RamRajLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

export default function RamRajLogo({
  size = "md",
  variant = "dark",
}: RamRajLogoProps) {
  const sizes = {
    sm: { outer: 32, inner: 22, fontSize: 7 },
    md: { outer: 42, inner: 30, fontSize: 9 },
    lg: { outer: 52, inner: 36, fontSize: 11 },
  };

  const s = sizes[size];
  const textColor = variant === "light" ? "#ffffff" : "#287FC1";
  const subTextColor = variant === "light" ? "rgba(255,255,255,0.85)" : "#64748b";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {/* Circular logo icon */}
      <div
        style={{
          width: s.outer,
          height: s.outer,
          borderRadius: "50%",
          background:
            variant === "light"
              ? "rgba(255,255,255,0.2)"
              : "linear-gradient(135deg, #287FC1 0%, #1a5f94 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            variant === "light"
              ? "0 0 0 2px rgba(255,255,255,0.4)"
              : "0 2px 8px rgba(40,127,193,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Circular pattern segments */}
        <svg
          width={s.outer}
          height={s.outer}
          viewBox="0 0 52 52"
          style={{ position: "absolute" }}
        >
          <circle cx="26" cy="26" r="25" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <path d="M26,1 A25,25 0 0,1 51,26" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
          <path d="M51,26 A25,25 0 0,1 26,51" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <path d="M26,51 A25,25 0 0,1 1,26" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
          <path d="M1,26 A25,25 0 0,1 26,1" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          {/* Inner circle */}
          <circle
            cx="26"
            cy="26"
            r={s.inner / 2 + 2}
            fill="rgba(255,255,255,0.15)"
          />
        </svg>
        <span
          style={{
            fontSize: s.fontSize + 2,
            fontWeight: "900",
            color: "#ffffff",
            letterSpacing: "0.5px",
            zIndex: 1,
            textShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          RR
        </span>
      </div>

      {/* Text */}
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontSize: size === "sm" ? 15 : size === "md" ? 18 : 22,
            fontWeight: "800",
            color: textColor,
            letterSpacing: "-0.3px",
          }}
        >
          RAM RAJ
        </div>
        <div
          style={{
            fontSize: size === "sm" ? 9 : size === "md" ? 10 : 12,
            color: subTextColor,
            fontWeight: "500",
            marginTop: "1px",
            letterSpacing: "0.5px",
          }}
        >
          IIT | MEDICAL | MHT-CET
        </div>
      </div>
    </div>
  );
}
