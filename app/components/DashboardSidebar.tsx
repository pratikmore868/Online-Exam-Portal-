"use client";
import React from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

interface SidebarProps {
  active: string;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "🏠", href: "/" },
];

export default function DashboardSidebar({ active }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: "4px",
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`sidebar-item ${active === item.id ? "active" : ""}`}
        >
          <span style={{ fontSize: 17 }}>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "#e5e7eb",
          margin: "12px 0",
        }}
      />

      {/* Logout */}
      <button
        onClick={logout}
        className="sidebar-item"
        style={{
          background: "none",
          border: "none",
          width: "100%",
          textAlign: "left",
          color: "#ef4444",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 17 }}>🚪</span>
        <span style={{ color: "#ef4444" }}>Logout</span>
      </button>
    </aside>
  );
}
