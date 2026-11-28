"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminClientCache, getAdminCachedData, setAdminCachedData } from "@/lib/admin-client-cache";
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
  CreditCard,
  MessageSquarePlus,
  BarChart3,
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
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    return getAdminCachedData<any>("/api/auth/me")?.user || null;
  });
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [trustMenuOpen, setTrustMenuOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  const handleNewBookingClick = () => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/bookings")) {
      window.dispatchEvent(new CustomEvent("open-new-booking-modal"));
    }
  };

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
        setAdminCachedData("/api/auth/me", data);

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
    "/admin/payments",
    "/admin/facilities",
    "/admin/discounts",
    "/admin/activity",
    "/admin/users",
    "/admin/settings",
    "/admin/feedback",
  ].includes(pathname);

  const getRoleBadge = (role: string) => {
    if (role === "SUPER_ADMIN") {
      return (
        <span className="bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow-2xs flex items-center">
          <Shield className="w-2.5 h-2.5 mr-1 text-amber-700 stroke-[2.2]" />
          Trustee (Super Admin)
        </span>
      );
    }
    return (
      <span className="bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow-2xs flex items-center">
        <Lock className="w-2.5 h-2.5 mr-1 text-slate-500 stroke-[2.2]" />
        Admin (View Only)
      </span>
    );
  };

  return (
    <div className="admin-shell min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Admin Top Navigation - Sleek Transparent Floating Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/90 shadow-2xs transition-all text-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <Link
              href={isSuper ? "/admin" : "/admin/calendar"}
              className="flex items-center space-x-2 sm:space-x-2.5 active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 p-0.5">
                <Image
                  src="/images/logo.png"
                  alt="Shree Saurashtra Patel Samaj Trust Logo"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-wide block truncate max-w-[170px] xs:max-w-[210px] sm:max-w-none">
                  શ્રી સૌરાષ્ટ્ર પટેલ સમાજ
                </span>
                <span className="text-[9px] sm:text-[10px] text-blue-700 block font-bold">
                  Nikol - Naroda Private Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links (Promoting the 3 Primary Actions for Seniors) */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            {/* 1. Live Calendar (કેલેન્ડર) */}
            <Link
              href="/admin/calendar"
              className={`flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                pathname.startsWith("/admin/calendar")
                  ? "bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Calendar className={`w-4 h-4 mr-2 ${pathname.startsWith("/admin/calendar") ? "text-blue-600" : "text-slate-400"}`} />
              <span>કેલેન્ડર</span>
            </Link>

            {/* 2. Bookings & Slips (બુકિંગ લિસ્ટ) */}
            <Link
              href="/admin/bookings"
              className={`flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                pathname.startsWith("/admin/bookings")
                  ? "bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <BookOpen className={`w-4 h-4 mr-2 ${pathname.startsWith("/admin/bookings") ? "text-blue-600" : "text-slate-400"}`} />
              <span>બુકિંગ્સ</span>
            </Link>

            {/* 3. Payment Status (પેમેન્ટ સ્થિતિ) - Only for Super Admin */}
            {isSuper && (
              <Link
                href="/admin/payments"
                className={`flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  pathname.startsWith("/admin/payments")
                    ? "bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs font-black"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <CreditCard className={`w-4 h-4 mr-2 ${pathname.startsWith("/admin/payments") ? "text-blue-600" : "text-slate-400"}`} />
                <span>પેમેન્ટ સ્થિતિ</span>
              </Link>
            )}

            {/* 4. New Booking Button (નવું બુકિંગ) - Only for Super Admin */}
            {isSuper && (
              <Link
                href="/admin/bookings?new=true"
                onClick={handleNewBookingClick}
                className="group flex items-center px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white shadow-sm hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/30 transition-all duration-200"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center mr-2 shadow-2xs transition-all duration-200">
                  <Plus className="w-3.5 h-3.5 text-white stroke-[3]" />
                </span>
                <span>+ નવું બુકિંગ</span>
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
                  className={`flex items-center px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isManagementRoute
                      ? "bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
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
                    <div id="trust-management-menu" className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ટ્રસ્ટ સંચાલન (Trust Management)
                      </div>
                      <div className="py-1">
                        <Link
                          href="/admin"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">ડેશબોર્ડ (Dashboard)</div>
                            <div className="text-[10px] text-slate-400">મુખ્ય ઓવરવ્યૂ અને આંકડા</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/payments"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <CreditCard className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">પેમેન્ટ સ્થિતિ (Payment Status)</div>
                            <div className="text-[10px] text-slate-400">સંપૂર્ણ અને બાકી ચુકવણી ટ્રેકિંગ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/reports"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <BarChart3 className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">ઓડિટ અને એનાલિટિક્સ (Audit Reports)</div>
                            <div className="text-[10px] text-slate-400">CA Audit, Tally CSV અને આવક ચાર્ટ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/facilities"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <Building2 className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">હોલ અને રૂમ ભાડા (Facilities)</div>
                            <div className="text-[10px] text-slate-400">પ્લોટ, હોલ અને રૂમનું લિસ્ટ અને ભાડા</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/discounts"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <Percent className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">ડિસ્કાઉન્ટ અને સર્વિસ (Discounts)</div>
                            <div className="text-[10px] text-slate-400">ટ્રસ્ટી/દાતા ડિસ્કાઉન્ટ અને સફાઈ ચાર્જ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/activity"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <History className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">પ્રવૃત્તિ ઇતિહાસ (Audit Logs)</div>
                            <div className="text-[10px] text-slate-400">કોણે શું ફેરફાર કર્યો તેનો રેકોર્ડ</div>
                          </div>
                        </Link>
                        {isSuper && (
                          <Link
                            href="/admin/users"
                            onClick={() => setTrustMenuOpen(false)}
                            className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                          >
                            <Users className="w-4 h-4 mr-2.5 text-blue-600" />
                            <div>
                              <div className="font-bold">ટ્રસ્ટી એકાઉન્ટ્સ (Admin Accounts)</div>
                              <div className="text-[10px] text-slate-400">અધિકૃત એડમિન અને પાસવર્ડ નિયંત્રણ</div>
                            </div>
                          </Link>
                        )}
                        <Link
                          href="/admin/settings"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <Settings className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">ટ્રસ્ટ સેટિંગ્સ (Trust Settings)</div>
                            <div className="text-[10px] text-slate-400">સામાન્ય નિયમો અને સેટિંગ્સ</div>
                          </div>
                        </Link>
                        <Link
                          href="/admin/feedback"
                          onClick={() => setTrustMenuOpen(false)}
                          className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition"
                        >
                          <MessageSquarePlus className="w-4 h-4 mr-2.5 text-blue-600" />
                          <div>
                            <div className="font-bold">ફીડબેક અને સૂચનો (Feedback & Ideas)</div>
                            <div className="text-[10px] text-slate-400">એપ સુધારો અને નવા ફીચર માટે સૂચન</div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* User Profile & Sleek Ghost Log Out Button (Desktop / Tablet) */}
          <div className="hidden md:flex items-center space-x-2.5 sm:space-x-3">
            <div className="text-right leading-tight hidden xl:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[170px]">
                {currentUser?.name || "Administrator"}
              </span>
              <span className="text-[10px] font-medium text-slate-500 block">
                {currentUser?.email}
              </span>
            </div>

            {currentUser && getRoleBadge(currentUser.role)}

            {/* Sleek Ghost / Outline Log Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="group flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              title="Log out and switch administrator"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 transition-colors" />
              <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
            </button>
          </div>

          {/* Mobile Quick Role Indicator & Hamburger Menu Button */}
          <div className="flex md:hidden items-center space-x-1.5">
            {currentUser && getRoleBadge(currentUser.role)}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-admin-menu"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* View-Only Read-Only Notice Banner */}
        {!isSuper && (
          <div className="bg-amber-50 border-t border-amber-200 px-3 py-1.5 text-center text-[11px] sm:text-xs text-amber-800 font-semibold flex items-center justify-center space-x-1.5">
            <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />
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
          <div id="mobile-admin-menu" className="relative z-40 lg:hidden max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain border-t border-slate-200 px-4 pt-3 pb-6 space-y-3 bg-white/98 backdrop-blur-lg shadow-2xl">
            {/* User Profile Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">{currentUser?.name}</div>
                <div className="text-[10px] text-slate-500 truncate max-w-[190px]">{currentUser?.email}</div>
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
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-black"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Calendar className="w-5 h-5 mr-3 text-blue-600" />
                <span>કેલેન્ડર (Live Calendar)</span>
              </Link>

              <Link
                href="/admin/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition min-h-[48px] ${
                  pathname === "/admin/bookings"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-black"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <BookOpen className="w-5 h-5 mr-3 text-blue-600" />
                <span>બુકિંગ લિસ્ટ (Bookings & Slips)</span>
              </Link>

              {isSuper && (
                <Link
                  href="/admin/payments"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition min-h-[48px] ${
                    pathname === "/admin/payments"
                      ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-black"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-5 h-5 mr-3 text-blue-600" />
                  <span>પેમેન્ટ સ્થિતિ (Payment Status)</span>
                </Link>
              )}

              {isSuper && (
                <Link
                  href="/admin/bookings?new=true"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNewBookingClick();
                  }}
                  className="group flex items-center px-3.5 py-3 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white shadow-sm hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/30 transition-all duration-200 min-h-[48px]"
                >
                  <span className="w-6 h-6 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center mr-3 shadow-2xs transition-all duration-200">
                    <Plus className="w-4 h-4 text-white stroke-[3]" />
                  </span>
                  <span>+ નવું બુકિંગ (New Booking)</span>
                </Link>
              )}

              {isSuper && (
                <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    વહીવટ અને સેટિંગ્સ (Settings)
                  </div>
                  <Link
                    href="/admin/reports"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <BarChart3 className="w-4 h-4 mr-3 text-blue-600" />
                    <span>ઓડિટ અને એનાલિટિક્સ (Audit Reports)</span>
                  </Link>
                  <Link
                    href="/admin/facilities"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <Building2 className="w-4 h-4 mr-3 text-blue-600" />
                    <span>હોલ અને રૂમ ભાડા (Facilities)</span>
                  </Link>
                  <Link
                    href="/admin/discounts"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <Percent className="w-4 h-4 mr-3 text-blue-600" />
                    <span>ડિસ્કાઉન્ટ અને સર્વિસ (Discounts)</span>
                  </Link>
                  <Link
                    href="/admin/activity"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <History className="w-4 h-4 mr-3 text-blue-600" />
                    <span>પ્રવૃત્તિ ઇતિહાસ (Audit Logs)</span>
                  </Link>
                  {isSuper && (
                    <Link
                      href="/admin/users"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                    >
                      <Users className="w-4 h-4 mr-3 text-blue-600" />
                      <span>ટ્રસ્ટી એકાઉન્ટ્સ (Accounts)</span>
                    </Link>
                  )}
                  <Link
                    href="/admin/settings"
                    onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <Settings className="w-4 h-4 mr-3 text-blue-600" />
                    <span>ટ્રસ્ટ સેટિંગ્સ (Trust Settings)</span>
                  </Link>
                  <Link
                    href="/admin/feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3.5 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-100 min-h-[44px]"
                  >
                    <MessageSquarePlus className="w-4 h-4 mr-3 text-blue-600" />
                    <span>ફીડબેક અને સૂચનો (Feedback & Ideas)</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Prominent Log Out Button */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-2 shadow-2xs border border-rose-200 transition min-h-[44px] cursor-pointer disabled:opacity-60"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-1.5 pb-safe flex items-center justify-around shadow-lg">
        {isSuper ? (
          <>
            <Link
              href="/admin/calendar"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname.startsWith("/admin/calendar")
                  ? "text-blue-700 font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>કેલેન્ડર</span>
            </Link>

            <Link
              href="/admin/bookings"
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] transition ${
                pathname.startsWith("/admin/bookings")
                  ? "text-blue-700 font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span>બુકિંગ્સ</span>
            </Link>

            <Link
              href="/admin/bookings?new=true"
              onClick={handleNewBookingClick}
              className="group flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-black text-white bg-gradient-to-b from-blue-600 to-indigo-700 shadow-sm hover:shadow-md hover:shadow-blue-500/20 active:scale-[0.98] border border-blue-400/30 min-w-[54px] min-h-[44px] transition-all"
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
                <Plus className="w-3 h-3 text-white stroke-[3]" />
              </span>
              <span>નવું બુકિંગ</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-admin-menu"
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-bold min-w-[54px] min-h-[44px] text-slate-500 hover:text-slate-900"
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
                  ? "bg-blue-50 text-blue-700 font-black border border-blue-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>કેલેન્ડર (Calendar)</span>
            </Link>

            <Link
              href="/admin/bookings"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-xs font-bold min-h-[44px] transition ml-2 ${
                pathname.startsWith("/admin/bookings")
                  ? "bg-blue-50 text-blue-700 font-black border border-blue-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span>બુકિંગ્સ (Bookings)</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 ml-1 text-rose-600 hover:bg-rose-50 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
