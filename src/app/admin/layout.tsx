"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminClientCache } from "@/lib/admin-client-cache";
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
  ChevronDown,
  Plus,
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
  const [trustMenuOpen, setTrustMenuOpen] = useState(false);

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

  // Keep open navigation predictable when a route changes, including browser back/forward.
  useEffect(() => {
    setMobileMenuOpen(false);
    setTrustMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setTrustMenuOpen(false);
      }
    };
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => document.removeEventListener("keydown", closeMenusOnEscape);
  }, []);

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    clearAdminClientCache();
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

  const isManagementRoute = [
    "/admin",
    "/admin/facilities",
    "/admin/discounts",
    "/admin/activity",
    "/admin/users",
    "/admin/settings",
  ].includes(pathname);

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
    <div className="admin-shell min-h-screen flex flex-col bg-slate-100 text-slate-800">
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

          {/* Desktop Nav Links (Promoting the 3 Primary Actions for Seniors) */}
          <nav className="hidden lg:flex items-center space-x-2">
            {/* 1. Live Calendar (કેલેન્ડર) */}
            <Link
              href="/admin/calendar"
              className={`flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                pathname.startsWith("/admin/calendar")
                  ? "bg-amber-500 text-slate-950 font-black shadow-md"
                  : "text-slate-200 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4 mr-2 text-amber-400" />
              <span>કેલેન્ડર</span>
            </Link>

            {/* 2. Bookings & Slips (બુકિંગ લિસ્ટ) */}
            <Link
              href="/admin/bookings"
              className={`flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                pathname.startsWith("/admin/bookings")
                  ? "bg-amber-500 text-slate-950 font-black shadow-md"
                  : "text-slate-200 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BookOpen className="w-4 h-4 mr-2 text-amber-400" />
              <span>બુકિંગ્સ</span>
            </Link>

            {/* 3. New Booking Button (નવું બુકિંગ) - Only for Super Admin */}
            {isSuper && (
              <Link
                href="/admin/bookings?new=true"
                className="flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-red-700 to-amber-700 hover:from-red-600 hover:to-amber-600 active:scale-95 text-white shadow-lg border border-amber-400/40 transition"
              >
                <Plus className="w-4 h-4 mr-1.5 text-amber-300 stroke-[3]" />
                <span>નવું બુકિંગ</span>
              </Link>
            )}

            {/* 4. Trust Management Dropdown (વહીવટ) - Only for Super Admin */}
            {isSuper && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTrustMenuOpen(!trustMenuOpen)}
                  aria-expanded={trustMenuOpen}
                  aria-controls="trust-management-menu"
                  className={`flex items-center px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isManagementRoute
                      ? "bg-slate-800 text-amber-300 border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span>વહીવટ</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
                </button>

                {trustMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setTrustMenuOpen(false)}
                    />
                    <div id="trust-management-menu" className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800/80 text-xs">
                      <div className="px-3.5 py-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        ટ્રસ્ટ સંચાલન (Trust Management)
                      </div>
                      <div className="py-1">
                        <Link
                          href="/admin"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">ડેશબોર્ડ (Dashboard)</div>
                            <div className="text-[10px] text-slate-400">મુખ્ય ઓવરવ્યૂ અને આંકડા</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/facilities"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <Building2 className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">હોલ અને રૂમ ભાડા (Facilities)</div>
                            <div className="text-[10px] text-slate-400">પ્લોટ, હોલ અને રૂમનું લિસ્ટ અને ભાડા</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/discounts"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <Percent className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">ડિસ્કાઉન્ટ અને સર્વિસ (Discounts)</div>
                            <div className="text-[10px] text-slate-400">ટ્રસ્ટી/દાતા ડિસ્કાઉન્ટ અને સફાઈ ચાર્જ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/activity"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <History className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">પ્રવૃત્તિ ઇતિહાસ (Audit Logs)</div>
                            <div className="text-[10px] text-slate-400">કોણે શું ફેરફાર કર્યો તેનો રેકોર્ડ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/users"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <Users className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">ટ્રસ્ટી એકાઉન્ટ્સ (Admin Accounts)</div>
                            <div className="text-[10px] text-slate-400">૩ અધિકૃત ટ્રસ્ટીઓ અને પાસવર્ડ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/settings"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <Settings className="w-4 h-4 mr-2.5 text-amber-400" />
                          <div>
                            <div className="font-bold">ટ્રસ્ટ સેટિંગ્સ (Trust Settings)</div>
                            <div className="text-[10px] text-slate-400">સામાન્ય નિયમો અને સેટિંગ્સ</div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
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
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-admin-menu"
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
              View-Only Mode ({currentUser?.name}): Updates refresh automatically every few seconds.
            </span>
          </div>
        )}

        {/* Mobile Dropdown & Quick Control Sheet */}
        {mobileMenuOpen && (
          <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
          />
          <div id="mobile-admin-menu" className="relative z-40 lg:hidden max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain border-t border-slate-800 px-4 pt-3 pb-6 space-y-3 bg-slate-900/98 backdrop-blur-lg shadow-2xl">
            {/* User Profile Card */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{currentUser?.name}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[190px]">{currentUser?.email}</div>
              </div>
              <div>{currentUser && getRoleBadge(currentUser.role)}</div>
            </div>

            {/* Mobile Nav Links */}
            <div className="space-y-1.5 pt-1">
              <Link
                href="/admin/calendar"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition min-h-[48px] ${
                  pathname === "/admin/calendar"
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Calendar className="w-5 h-5 mr-3 text-amber-400" />
                <span>કેલેન્ડર (Live Calendar)</span>
              </Link>

              <Link
                href="/admin/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition min-h-[48px] ${
                  pathname === "/admin/bookings"
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <BookOpen className="w-5 h-5 mr-3 text-amber-400" />
                <span>બુકિંગ લિસ્ટ (Bookings & Slips)</span>
              </Link>

              {isSuper && (
                <Link
                  href="/admin/bookings?new=true"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-red-700 to-amber-700 text-white shadow-md border border-amber-400/30 transition min-h-[48px]"
                >
                  <Plus className="w-5 h-5 mr-3 text-amber-300 stroke-[3]" />
                  <span>+ નવું બુકિંગ (New Booking)</span>
                </Link>
              )}

              {isSuper && (
                <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    વહીવટ અને સેટિંગ્સ (Settings)
                  </div>
                  <Link
                    href="/admin/facilities"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
                  >
                    <Building2 className="w-4 h-4 mr-3 text-amber-400" />
                    <span>હોલ અને રૂમ ભાડા (Facilities)</span>
                  </Link>
                  <Link
                    href="/admin/discounts"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
                  >
                    <Percent className="w-4 h-4 mr-3 text-amber-400" />
                    <span>ડિસ્કાઉન્ટ અને સર્વિસ (Discounts)</span>
                  </Link>
                  <Link
                    href="/admin/activity"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
                  >
                    <History className="w-4 h-4 mr-3 text-amber-400" />
                    <span>પ્રવૃત્તિ ઇતિહાસ (Audit Logs)</span>
                  </Link>
                  <Link
                    href="/admin/users"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
                  >
                    <Users className="w-4 h-4 mr-3 text-amber-400" />
                    <span>ટ્રસ્ટી એકાઉન્ટ્સ (Accounts)</span>
                  </Link>
                  <Link
                    href="/admin/settings"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
                  >
                    <Settings className="w-4 h-4 mr-3 text-amber-400" />
                    <span>ટ્રસ્ટ સેટિંગ્સ (Trust Settings)</span>
                  </Link>
                </div>
              )}
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
                Shree Saurashtra Patel Samaj, Nikol - Naroda
              </div>
            </div>
          </div>
          </>
        )}
      </header>

      {/* Admin Body Content with safe-padding for mobile bottom navigation */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8">
        {children}
      </main>

      {/* Native-Style Mobile Bottom Navigation Bar (Phone & iPod & Tablet) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 pt-1.5 pb-safe flex items-center justify-around shadow-lg">
        {isSuper ? (
          <>
            <Link
              href="/admin/calendar"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname.startsWith("/admin/calendar")
                  ? "text-amber-400 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>કેલેન્ડર</span>
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
              <span>બુકિંગ્સ</span>
            </Link>

            <Link
              href="/admin/bookings?new=true"
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-black text-amber-300 bg-red-900/80 border border-amber-500/40 min-w-[54px] min-h-[44px]"
            >
              <Plus className="w-5 h-5 mb-0.5 text-amber-300 stroke-[3]" />
              <span>+ નવું બુકિંગ</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-admin-menu"
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] text-slate-400 hover:text-slate-200"
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span>મેનુ</span>
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
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 ml-1 text-slate-400 hover:text-white rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="More options"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-admin-menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
