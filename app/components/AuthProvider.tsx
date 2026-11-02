"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Role = "student" | "teacher" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  batch?: string;
  email?: string;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within RequireAuth");
  return context;
}

export const homeFor = (role: Role) => (role === "student" ? "/" : "/admin");

// Controls which screens are shown. The data itself is protected by the API routes.
export function RequireAuth({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [failed, setFailed] = useState(false);
  const rolesKey = roles.join(",");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          const { pathname, search } = window.location;
          const next = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
          router.replace(`/login${next}`);
          return;
        }
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const me: AuthUser = (await res.json()).user;
        if (me.mustChangePassword) {
          router.replace("/change-password");
        } else if (!rolesKey.split(",").includes(me.role)) {
          router.replace(homeFor(me.role));
        } else {
          setUser(me);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router, rolesKey]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }, []);

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f3f4f6" }}>
        <div style={{ fontSize: 14, color: failed ? "#dc2626" : "#287FC1", fontWeight: 600 }}>
          {failed ? "Could not reach the server. Please check your connection and refresh." : "Loading..."}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
