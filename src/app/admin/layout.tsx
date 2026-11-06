"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Building2,
  Users,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Percent,
  History,
  Lock,
  User,
} from "lucide-react";

// Client-side fetch interceptor for tab-isolated multi-admin testing
if (typeof window !== "undefined" && !(window as any).__tabFetchPatched) {
  (window as any).__tabFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const tabEmail = sessionStorage.getItem("tab_admin_email");
      // Only attach to internal API requests; never touch Next.js static asset / chunk loading
      if (tabEmail && typeof input === "string" && input.startsWith("/api/")) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has("x-admin-email")) {
          headers.set("x-admin-email", tabEmail);
        }
        init.headers = headers;
      }
    } catch (e) {
      // safe fallback
    }
    return originalFetch(input, init);
  };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "VIEW_ONLY_ADMIN" | string;
  canExport?: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.replace("/admin/login");
          return;
        }
        setCurrentUser(data.user);
        if (typeof window !== "undefined" && !sessionStorage.getItem("tab_admin_email")) {
          sessionStorage.setItem("tab_admin_email", data.user.email);
        }

        // View-only admins can only access Calendar and Bookings (Calendar is default)
        const isUserSuper = data.user.role === "SUPER_ADMIN";
        const allowedViewOnly = ["/admin/calendar", "/admin/bookings"];
        const isAllowed = allowedViewOnly.some(
          (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
        );
        if (!isUserSuper && !isAllowed) {
          router.replace("/admin/calendar");
          return;
        }
      } catch (err) {
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, isLoginPage, router]);

  const handleSwitchTabAdmin = (email: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("tab_admin_email", email);
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("tab_admin_email");
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  const isSuper = currentUser?.role === "SUPER_ADMIN";

  // Ultra-simple navigation: View-only admins ONLY see Bookings and Calendar
  const navLinks = isSuper
    ? [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/calendar", label: "Calendar", icon: Calendar },
        { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
        { href: "/admin/facilities", label: "Facilities", icon: Building2 },
        { href: "/admin/discounts", label: "Discounts & Services", icon: Percent },
        { href: "/admin/activity", label: "Activity History", icon: History },
        { href: "/admin/users", label: "Admin Accounts", icon: Users },
        { href: "/admin/settings", label: "Trust Settings", icon: Settings },
      ]
    : [
        { href: "/admin/calendar", label: "Calendar", icon: Calendar },
        { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
      ];

  const getRoleBadge = (role: string) => {
    if (role === "SUPER_ADMIN") {
      return (
        <span className="bg-red-800 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center justify-center">
          <Shield className="w-2.5 h-2.5 mr-1" />
          Trustee (Super Admin)
        </span>
      );
    }
    return (
      <span className="bg-amber-900/80 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center justify-center border border-amber-600/40">
        <Lock className="w-2.5 h-2.5 mr-1" />
        Admin (View Only)
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Admin Top Navigation */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <Link
              href={isSuper ? "/admin" : "/admin/calendar"}
              className="flex items-center space-x-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-800 to-amber-700 text-amber-300 flex items-center justify-center font-black text-sm shadow">
                SSPS
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold text-sm text-white tracking-wide block">
                  શ્રી સૌરાષ્ટ્ર પટેલ સમાજ
                </span>
                <span className="text-[10px] text-amber-400 block -mt-0.5">
                  Nikol - Naroda Private Admin System
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Tab-Isolated Admin Switcher (Allows testing multiple admins in separate tabs simultaneously) */}
            <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700/80 rounded-lg p-1">
              <span className="text-[10px] text-slate-400 font-bold px-1.5 hidden xl:inline">
                This Tab:
              </span>
              <button
                onClick={() => handleSwitchTabAdmin("superadmin@patelsamaj.com")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  currentUser?.email === "superadmin@patelsamaj.com"
                    ? "bg-red-800 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
                title="Switch this tab to Super Admin (Full Access)"
              >
                Super Admin
              </button>
              <button
                onClick={() => handleSwitchTabAdmin("admin2@patelsamaj.com")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  currentUser?.email === "admin2@patelsamaj.com"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
                title="Switch this tab to Admin 2 (View-Only)"
              >
                Admin 2
              </button>
              <button
                onClick={() => handleSwitchTabAdmin("admin3@patelsamaj.com")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  currentUser?.email === "admin3@patelsamaj.com"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
                title="Switch this tab to Admin 3 (View-Only)"
              >
                Admin 3
              </button>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-white block leading-tight">
                {currentUser?.name}
              </span>
              {currentUser && getRoleBadge(currentUser.role)}
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* View-Only Read-Only Notice Banner */}
        {!isSuper && (
          <div className="bg-amber-950/80 border-t border-amber-600/30 px-4 py-1.5 text-center text-xs text-amber-300 font-semibold flex items-center justify-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              View-Only Mode ({currentUser?.name}): You have viewing access to booking records and calendars. Data modification is restricted to the Super Admin.
            </span>
          </div>
        )}

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 px-4 pt-2 pb-4 space-y-1 bg-slate-900">
            <div className="pb-2 border-b border-slate-800 mb-2">
              <div className="text-xs font-bold text-white">{currentUser?.name}</div>
              <div className="mt-0.5">{currentUser && getRoleBadge(currentUser.role)}</div>
            </div>

            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
              <button
                onClick={handleLogout}
                className="text-xs text-red-400 font-semibold flex items-center"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Admin Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
