"use client";
import React from "react";
import { RequireAuth } from "../components/AuthProvider";

// Staff can open exam pages too, to preview them.
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["student", "teacher", "admin"]}>{children}</RequireAuth>;
}
