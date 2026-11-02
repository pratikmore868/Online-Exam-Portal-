"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Users2,
  Users,
  BookOpen,
  HelpCircle,
  FileText,
  Trophy,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  LogOut
} from "lucide-react";
import RamRajLogo from "@/app/components/RamRajLogo";
import { useAuth } from "@/app/components/AuthProvider";

interface AdminSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

export default function AdminSidebar({
  collapsed,
  setCollapsed,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Exact 7 items from new screenshots
  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutGrid,
      href: "/admin",
      isActive: (path: string) =>
        path === "/admin" ||
        path === "/admin/dashboard" ||
        path.startsWith("/admin/dashboard"),
    },
    {
      label: "Batches",
      icon: Users2,
      href: "/admin/batches",
      isActive: (path: string) => path.startsWith("/admin/batches"),
    },
    {
      label: "Students",
      icon: Users,
      href: "/admin/students",
      isActive: (path: string) => path.startsWith("/admin/students"),
    },
    {
      label: "Subjects",
      icon: BookOpen,
      href: "/admin/subjects",
      isActive: (path: string) => path.startsWith("/admin/subjects"),
    },
    {
      label: "Questions",
      icon: HelpCircle,
      href: "/admin/questions",
      isActive: (path: string) => path.startsWith("/admin/questions"),
    },
    {
      label: "Examinations",
      icon: FileText,
      href: "/admin/examinations",
      isActive: (path: string) =>
        path.startsWith("/admin/examinations") || path.startsWith("/admin/exams"),
    },
    {
      label: "Results",
      icon: Trophy,
      href: "/admin/results",
      isActive: (path: string) => path.startsWith("/admin/results"),
    },
  ];

  return (
    <aside
      suppressHydrationWarning
      className={`fixed top-0 left-0 bottom-0 z-30 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col print:hidden ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ boxShadow: "1px 0 3px rgba(0,0,0,0.03)" }}
    >
      {/* Top Header / Logo + Collapse Toggle matching screenshots */}
      <div className="h-18 px-4 flex items-center justify-between border-b border-gray-100">
        {!collapsed ? (
          <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
            <RamRajLogo size="md" variant="dark" />
          </Link>
        ) : (
          <div className="mx-auto">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#287FC1] to-[#1a5f94] flex items-center justify-center text-white font-black text-xs shadow-sm">
              RR
            </div>
          </div>
        )}

        <button
          suppressHydrationWarning
          onClick={() => setCollapsed((prev) => !prev)}
          className="w-7 h-7 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav Menu with 7 items matching screenshot */}
      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? "bg-[#287FC1] text-white shadow-xs"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4.5 h-4.5 shrink-0 ${
                  active ? "text-white" : "text-gray-500 group-hover:text-gray-800"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Profile Bar at Bottom - matches Screenshot */}
      <div className="p-3 border-t border-gray-100 relative">
        <div
          onClick={() => setShowProfileMenu((prev) => !prev)}
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {/* Avatar initial in blue circle */}
          <div className="w-9 h-9 rounded-full bg-[#287FC1] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            {user.name.charAt(0).toUpperCase()}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {user.name}
              </div>
              <div className="text-xs text-gray-500 truncate capitalize">
                {user.role}
              </div>
            </div>
          )}

          {!collapsed && (
            <button suppressHydrationWarning className="text-gray-400 hover:text-gray-600 p-1">
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Profile Dropdown Menu */}
        {showProfileMenu && (
          <div
            className={`absolute bottom-16 ${
              collapsed ? "left-20" : "left-3 right-3"
            } bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 text-sm animate-in fade-in slide-in-from-bottom-2 duration-150`}
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email || user.id}</p>
            </div>

            <button
              suppressHydrationWarning
              onClick={() => {
                setShowProfileMenu(false);
                router.push("/admin/students");
              }}
              className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-gray-500" />
              Manage Students
            </button>

            <button
              suppressHydrationWarning
              onClick={() => {
                setShowProfileMenu(false);
                router.push("/admin/subjects");
              }}
              className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-gray-500" />
              Manage Subjects
            </button>

            <div className="border-t border-gray-100 my-1" />

            <button
              suppressHydrationWarning
              onClick={logout}
              className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
