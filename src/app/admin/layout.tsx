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
  const [loggingOut, setLoggingOut] = useState(false);

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

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "/admin/login";
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
      <header className="bg-slate-900/95 backdrop-blur-md text-white shadow-md sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <Link
              href={isSuper ? "/admin" : "/admin/calendar"}
              className="flex items-center space-x-2 sm:space-x-2.5 active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-red-800 to-amber-700 text-amber-300 flex items-center justify-center font-black text-xs sm:text-sm shadow border border-amber-500/30">
                SSPS
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide block truncate max-w-[170px] xs:max-w-[210px] sm:max-w-none">
                  શ્રી સૌરાષ્ટ્ર પટેલ સમાજ
                </span>
                <span className="text-[9px] sm:text-[10px] text-amber-400 block font-medium">
                  Nikol - Naroda Private Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links (Visible on Large Screens) */}
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

          {/* User Profile & Prominent Log Out Button (Desktop / Tablet) */}
          <div className="hidden md:flex items-center space-x-2.5 sm:space-x-3">
            <div className="text-right leading-tight hidden xl:block">
              <span className="text-xs font-bold text-white block truncate max-w-[170px]">
                {currentUser?.name || "Administrator"}
              </span>
              <span className="text-[10px] font-medium text-amber-400 block">
                {currentUser?.email}
              </span>
            </div>

            {currentUser && getRoleBadge(currentUser.role)}

            {/* Clear, Prominent Log Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="relative z-50 flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold text-xs shadow-md border border-red-600/50 transition cursor-pointer disabled:opacity-60"
              title="Log out and switch administrator"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-300" />
              <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
            </button>
          </div>

          {/* Mobile Quick Role Indicator & Hamburger Menu Button */}
          <div className="flex md:hidden items-center space-x-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 truncate max-w-[100px]">
              {isSuper ? "Super Admin" : "View Only"}
            </span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 rounded-xl transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* View-Only Read-Only Notice Banner */}
        {!isSuper && (
          <div className="bg-amber-950/90 border-t border-amber-600/30 px-3 py-1.5 text-center text-[11px] sm:text-xs text-amber-300 font-semibold flex items-center justify-center space-x-1.5">
            <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="truncate">
              View-Only Mode ({currentUser?.name}): Viewing only • Data changes restricted to Super Admin.
            </span>
          </div>
        )}

        {/* Mobile Dropdown & Quick Control Sheet */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 px-4 pt-3 pb-6 space-y-3 bg-slate-900/98 backdrop-blur-lg shadow-2xl animate-in slide-in-from-top-2">
            {/* User Profile Card */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{currentUser?.name}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[190px]">{currentUser?.email}</div>
              </div>
              <div>{currentUser && getRoleBadge(currentUser.role)}</div>
            </div>

            {/* Mobile Nav Links */}
            <div className="space-y-1 pt-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      isActive
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-200 hover:bg-slate-800 active:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Prominent Log Out Button */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-700 active:bg-red-900 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-md border border-red-600/50 transition min-h-[44px] cursor-pointer disabled:opacity-60"
              >
                <LogOut className="w-4 h-4 text-amber-300" />
                <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
              </button>
              <div className="text-center text-[10px] text-slate-500">
                Shree Saurashtra Leuva Patel Samaj, Nikol - Naroda
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Admin Body Content with safe-padding for mobile bottom navigation */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8">
        {children}
      </main>

      {/* Native-Style Mobile Bottom Navigation Bar (Phone & iPod & Tablet) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 pt-1.5 pb-safe flex items-center justify-around shadow-lg">
        {isSuper ? (
          <>
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname === "/admin"
                  ? "text-amber-400 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span>Overview</span>
            </Link>

            <Link
              href="/admin/calendar"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname.startsWith("/admin/calendar")
                  ? "text-amber-400 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>Calendar</span>
            </Link>

            <Link
              href="/admin/bookings"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname.startsWith("/admin/bookings")
                  ? "text-amber-400 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span>Bookings</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] text-slate-400 hover:text-slate-200"
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span>Menu</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/admin/calendar"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-xs font-bold min-h-[44px] transition ${
                pathname.startsWith("/admin/calendar")
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>Calendar View</span>
            </Link>

            <Link
              href="/admin/bookings"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-xs font-bold min-h-[44px] transition ml-2 ${
                pathname.startsWith("/admin/bookings")
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span>All Bookings</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 ml-1 text-slate-400 hover:text-white rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="More options"
            >
              <Menu className="w-5 h-5" />
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
