"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Building, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailQuery = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailQuery);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (emailQuery) {
      setEmail(emailQuery);
      setPassword("");
    }
  }, [emailQuery]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user?.role === "VIEW_ONLY_ADMIN") {
        router.push("/admin/calendar");
      } else {
        router.push("/admin");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  const getAccountTitle = (emailVal: string) => {
    const lower = emailVal.toLowerCase().trim();
    if (lower.includes("jnpatel") || lower.includes("superadmin")) return "J N Patel (Super Admin)";
    if (lower.includes("haresh") || lower.includes("admin2")) return "Hareshbhai Ramani (Admin 2)";
    if (lower.includes("shailesh") || lower.includes("admin3")) return "Shaileshbhai Kathriya (Admin 3)";
    return null;
  };

  const accountTitle = getAccountTitle(email);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-red-900 to-amber-700 text-amber-300 rounded-2xl flex items-center justify-center mx-auto shadow-2xl border border-amber-500/30">
          <Building className="w-8 h-8 sm:w-9 sm:h-9" />
        </div>

        <p className="mt-2.5 sm:mt-3 text-amber-400 font-bold text-[10px] sm:text-xs tracking-wider uppercase">
          ॥ ૐ નમઃ શિવાય ॥ ॥ જય શ્રી ખોડિયાર માં ॥
        </p>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 sm:mt-1">
          શ્રી સૌરાષ્ટ્ર લેઉવા પટેલ સમાજ
        </h1>
        <p className="text-[11px] sm:text-xs text-amber-200/80 font-medium mt-0.5">
          Nikol - Naroda, Ahmedabad • Internal Booking Management
        </p>
      </div>

      <div className="mt-4 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/95 backdrop-blur-md py-6 sm:py-8 px-4 sm:px-10 shadow-2xl rounded-2xl border border-slate-800">
          <div className="mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-800">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-amber-400" />
              Private Administrator Sign-In
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
              Internal system restricted to designated Trust Administrators.
            </p>
          </div>

          {emailQuery && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3.5 py-2.5 rounded-xl text-xs flex items-start space-x-2">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Switching to <strong>{accountTitle || emailQuery}</strong>. Please enter the administrator password.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-950/80 border border-red-700/60 text-red-200 px-3.5 py-2.5 rounded-xl text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-3.5 sm:space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1">
                Administrator Email / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jnpatel@patelsamaj.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus={Boolean(emailQuery)}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="block w-full pl-9 pr-10 py-2.5 text-xs bg-slate-950/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-md text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                "Sign In to Management Console"
              )}
            </button>
          </form>

          {/* Quick Account Email Selectors */}
          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold block text-center">
              Select Administrator Account (Password Required):
            </span>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("jnpatel@patelsamaj.com");
                  setPassword("");
                }}
                className="py-2 px-1 rounded-xl bg-red-950/60 hover:bg-red-900/60 active:bg-red-800 text-red-200 border border-red-800/60 text-[10px] sm:text-[11px] font-bold text-center transition min-h-[42px] flex flex-col items-center justify-center leading-tight"
              >
                <span>J N Patel</span>
                <span className="text-[9px] text-red-300/80 font-normal mt-0.5">Super Admin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("hareshbhai@patelsamaj.com");
                  setPassword("");
                }}
                className="py-2 px-1 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 active:bg-amber-800 text-amber-200 border border-amber-800/60 text-[10px] sm:text-[11px] font-bold text-center transition min-h-[42px] flex flex-col items-center justify-center leading-tight"
              >
                <span>Hareshbhai</span>
                <span className="text-[9px] text-amber-300/80 font-normal mt-0.5">Ramani</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("shaileshbhai@patelsamaj.com");
                  setPassword("");
                }}
                className="py-2 px-1 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 active:bg-blue-800 text-blue-200 border border-blue-800/60 text-[10px] sm:text-[11px] font-bold text-center transition min-h-[42px] flex flex-col items-center justify-center leading-tight"
              >
                <span>Shaileshbhai</span>
                <span className="text-[9px] text-blue-300/80 font-normal mt-0.5">Kathriya</span>
              </button>
            </div>
          </div>

          {/* Secure Access Notice */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400">
              Only designated Trust trustees (J N Patel, Hareshbhai Ramani, Shaileshbhai Kathriya) can access this system.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              All administrative access and modifications are audit-logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-xs">
          Loading sign-in...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
