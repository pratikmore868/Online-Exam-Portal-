"use client";

import React, { useState } from "react";
import AdminSidebar from "./components/AdminSidebar";
import { RequireAuth } from "@/app/components/AuthProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <RequireAuth roles={["admin", "teacher"]}>
      <div className="min-h-screen bg-[#f8fafc] flex" suppressHydrationWarning>
        {/* Sidebar */}
        <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        {/* Main Content Area */}
        <main
          className={`flex-1 transition-all duration-300 min-h-screen flex flex-col ${
            collapsed ? "ml-20" : "ml-64"
          }`}
        >
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}
