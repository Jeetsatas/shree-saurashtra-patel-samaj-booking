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
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

export const ADMIN_ACCOUNTS = [
  {
    name: "Trustee Office (Super Admin)",
    shortName: "Super Admin",
    email: "superadmin@patelsamaj.com",
    role: "SUPER_ADMIN",
    badgeColor: "bg-red-800 text-white",
    desc: "Full System Control & Settings",
  },
  {
    name: "Admin 2 (View Only)",
    shortName: "Admin 2",
    email: "admin2@patelsamaj.com",
    role: "VIEW_ONLY_ADMIN",
    badgeColor: "bg-amber-600 text-white",
    desc: "Interactive Calendar & Booking Slips",
  },
  {
    name: "Admin 3 (View Only)",
    shortName: "Admin 3",
    email: "admin3@patelsamaj.com",
    role: "VIEW_ONLY_ADMIN",
    badgeColor: "bg-blue-600 text-white",
    desc: "Interactive Calendar & Booking Slips",
  },
];

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

  // Strict Account Switch Login Modal
  const [switchTarget, setSwitchTarget] = useState<typeof ADMIN_ACCOUNTS[0] | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [showSwitchPassword, setShowSwitchPassword] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);

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

  const handleAdminAccountClick = (target: typeof ADMIN_ACCOUNTS[0]) => {
    // If user is already on this account, do nothing
    if (currentUser?.email === target.email) {
      return;
    }
    setSwitchTarget(target);
    setSwitchPassword("");
    setSwitchError("");
    setShowSwitchPassword(false);
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const handleSwitchLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchTarget) return;

    if (!switchPassword) {
      setSwitchError("Password is required to authenticate.");
      return;
    }

    setSwitchLoading(true);
    setSwitchError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: switchTarget.email,
          password: switchPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid password for this administrator account.");
      }

      const targetRole = data.user?.role;
      setSwitchTarget(null);
      setSwitchPassword("");

      // Redirect cleanly according to authorized role
      if (targetRole === "SUPER_ADMIN") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/admin/calendar";
      }
    } catch (err: any) {
      setSwitchError(err.message || "Invalid password. Access denied.");
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
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

          {/* User Profile & Actions (Desktop / Tablet) */}
          <div className="hidden md:flex items-center space-x-2.5 sm:space-x-3">
            {/* Administrator Account Switcher (Strict Password Required) */}
            <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700/80 rounded-lg p-1">
              <span className="text-[10px] text-slate-400 font-bold px-1 hidden xl:inline">
                Admin:
              </span>
              {ADMIN_ACCOUNTS.map((acc) => {
                const isCurrent = currentUser?.email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleAdminAccountClick(acc)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center space-x-1 ${
                      isCurrent
                        ? `${acc.badgeColor} shadow-xs ring-1 ring-white/30 cursor-default`
                        : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                    }`}
                    title={
                      isCurrent
                        ? `Currently active: ${acc.name}`
                        : `Switch to ${acc.name} (Strict Login Required)`
                    }
                  >
                    <span>{acc.shortName}</span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  </button>
                );
              })}
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

            {/* Mobile Administrator Account Switcher */}
            <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/50 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Switch Admin Account (Password Required):
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {ADMIN_ACCOUNTS.map((acc) => {
                  const isCurrent = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleAdminAccountClick(acc)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition text-center ${
                        isCurrent
                          ? `${acc.badgeColor} shadow-sm ring-1 ring-amber-400 font-black`
                          : "bg-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      {acc.shortName}
                    </button>
                  );
                })}
              </div>
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

            {/* Mobile Sign Out */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">SSPS Nikol - Naroda</span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-xs text-red-400 hover:text-red-300 font-bold flex items-center bg-red-950/40 rounded-lg border border-red-900/50"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </button>
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

      {/* Strict Administrator Authentication Modal */}
      {switchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-white">
            {/* Modal Header */}
            <div className="bg-slate-950/90 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Administrator Login Required</h3>
                  <p className="text-[11px] text-slate-400">Strict password verification required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSwitchTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSwitchLogin} className="p-5 space-y-4">
              {/* Target Account Info */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Target Administrator
                  </span>
                  <div className="text-xs font-bold text-white mt-0.5">{switchTarget.name}</div>
                  <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">{switchTarget.email}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {switchTarget.role === "SUPER_ADMIN" ? "Super Admin" : "View Only"}
                </span>
              </div>

              {switchError && (
                <div className="bg-red-950/80 border border-red-700/60 text-red-200 px-3.5 py-2.5 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{switchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Enter Password for {switchTarget.shortName}
                </label>
                <div className="relative">
                  <input
                    type={showSwitchPassword ? "text" : "password"}
                    required
                    autoFocus
                    value={switchPassword}
                    onChange={(e) => setSwitchPassword(e.target.value)}
                    placeholder="Enter administrator password..."
                    className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSwitchPassword(!showSwitchPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showSwitchPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
                <span className="font-semibold text-amber-300">Strict Authentication: </span>
                Switching accounts strictly requires entering the designated administrator password. Unauthorized access is blocked.
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSwitchTarget(null)}
                  disabled={switchLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={switchLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {switchLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Log In & Switch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
