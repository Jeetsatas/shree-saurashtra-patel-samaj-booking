"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CreditCard,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageSquare,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Check,
  X,
  Building,
  Shield,
  Edit3,
  Save,
  Lock,
  Layers,
  ArrowRight,
  Receipt,
  Banknote,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { fetchAdminJson, getAdminCachedData } from "@/lib/admin-client-cache";
import { isFullDaySlot, formatSlotLabel } from "@/lib/slotUtils";

// Helper: Check if a booking is considered fully paid
function isBookingFullyPaid(b: any): boolean {
  if (!b) return false;
  const status = (b.paymentStatus || "").toUpperCase().trim();
  return (
    status === "PAID" ||
    status === "PAID_FULL" ||
    status === "PAID_CASH" ||
    status === "PAID_ONLINE" ||
    status === "COMPLETED"
  );
}

// Helper: Payment status label & badge
function getPaymentBadge(status: string) {
  const s = (status || "").toUpperCase().trim();
  if (
    s === "PAID" ||
    s === "PAID_FULL" ||
    s === "PAID_CASH" ||
    s === "PAID_ONLINE" ||
    s === "COMPLETED"
  ) {
    return {
      label: "🟢 પૂર્ણ ચુકવણી (Full Paid)",
      shortLabel: "પૂર્ણ",
      badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
      dotColor: "#10b981",
      isPaid: true,
    };
  }
  if (s === "PARTIAL") {
    return {
      label: "🟡 આંશિક ચુકવણી (Partial)",
      shortLabel: "આંશિક",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#f59e0b",
      isPaid: false,
    };
  }
  return {
    label: "🟡 ચુકવણી બાકી (Pending)",
    shortLabel: "બાકી",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    dotColor: "#f59e0b",
    isPaid: false,
  };
}

export default function AdminPaymentStatusPage() {
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    return getAdminCachedData<any>("/api/auth/me")?.user || null;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    return !getAdminCachedData<any>("/api/auth/me")?.user;
  });
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"CALENDAR" | "PENDING_LIST">("CALENDAR");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");

  // Edit Payment Modal State
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>("PAID");
  const [editMethod, setEditMethod] = useState<string>("CASH_AT_OFFICE");
  const [editRefNo, setEditRefNo] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string>("");

  const bookingsRefresh = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const url = `/api/bookings?month=${m}&year=${y}`;
    const cachedBookings = getAdminCachedData<any>(url) || getAdminCachedData<any>("/api/bookings");
    const cachedFacilities = getAdminCachedData<any>("/api/facilities");
    const cachedUser = getAdminCachedData<any>("/api/auth/me")?.user;
    if (cachedBookings?.bookings) setBookings(cachedBookings.bookings);
    if (cachedFacilities?.facilities) setFacilities(cachedFacilities.facilities);
    if (cachedUser) {
      setCurrentUser(cachedUser);
      setAuthLoading(false);
    }
    if (cachedBookings || cachedFacilities) setLoading(false);

    fetchInitialData();

    let lastRefreshTime = 0;
    const refreshWhileVisible = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        // Smart Focus Revalidation: throttle to at most once every 10 seconds on tab focus
        if (now - lastRefreshTime > 10000) {
          lastRefreshTime = now;
          refreshBookings();
        }
      }
    };
    // Relax idle background polling to 45s
    const timer = window.setInterval(refreshWhileVisible, 45000);
    window.addEventListener("focus", refreshWhileVisible);
    document.addEventListener("visibilitychange", refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhileVisible);
      document.removeEventListener("visibilitychange", refreshWhileVisible);
    };
  }, []);

  // When calendar month changes, load scoped bookings for that month
  useEffect(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const url = `/api/bookings?month=${m}&year=${y}`;
    const cached = getAdminCachedData<any>(url);
    if (cached?.bookings) {
      setBookings(cached.bookings);
    }
    refreshBookings(y, m);
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const fetchInitialData = async () => {
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const url = `/api/bookings?month=${m}&year=${y}`;
      if (!getAdminCachedData(url) && !getAdminCachedData("/api/bookings")) {
        setLoading(true);
      }
      const [facData, bookData, userData] = await Promise.all([
        fetchAdminJson<any>("/api/facilities"),
        fetchAdminJson<any>(url),
        fetchAdminJson<any>("/api/auth/me"),
      ]);

      if (facData?.facilities) setFacilities(facData.facilities);
      if (bookData?.bookings) setBookings(bookData.bookings);
      if (userData?.user) setCurrentUser(userData.user);
    } catch (err) {
      console.error("Payment status load error:", err);
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const refreshBookings = async (targetYear = currentDate.getFullYear(), targetMonth = currentDate.getMonth() + 1) => {
    const url = `/api/bookings?month=${targetMonth}&year=${targetYear}`;
    if (bookingsRefresh.current) return bookingsRefresh.current;
    bookingsRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>(url);
        if (data?.bookings) setBookings(data.bookings);
      } catch (err) {
        console.error("Booking refresh error:", err);
      } finally {
        bookingsRefresh.current = null;
      }
    })();
    return bookingsRefresh.current;
  };

  const isSuper = currentUser?.role === "SUPER_ADMIN";

  // Date Navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthNames = [
    "January (જાન્યુઆરી)",
    "February (ફેબ્રુઆરી)",
    "March (માર્ચ)",
    "April (એપ્રિલ)",
    "May (મે)",
    "June (જૂન)",
    "July (જુલાઈ)",
    "August (ઓગસ્ટ)",
    "September (સપ્ટેમ્બર)",
    "October (ઓક્ટોબર)",
    "November (નવેમ્બર)",
    "December (ડિસેમ્બર)",
  ];

  // Get active bookings for a specific date
  const getBookingsForDate = (dateObj: Date) => {
    const targetStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    return bookings.filter((b) => {
      if (selectedFacilityId !== "ALL") {
        if (b.facilityId !== selectedFacilityId) return false;
      }
      const start = new Date(b.startDate);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const end = new Date(b.endDate || b.startDate);
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

      const isFull = isFullDaySlot(b.slot);
      const matches =
        targetStr === startStr ||
        (targetStr > startStr && (isFull ? targetStr < endStr : targetStr <= endStr));
      return matches && b.status !== "CANCELLED";
    });
  };

  const getBookingsForDay = (dayNum: number) => {
    return getBookingsForDate(new Date(year, month, dayNum));
  };

  // Day Payment Status Evaluation
  // White: Blank day (0 bookings)
  // Green: Full payment (all bookings on this day are paid)
  // Yellow: Pending payment (at least 1 booking is pending or partial)
  const getDayPaymentEvaluation = (dayNum: number) => {
    const dayBookings = getBookingsForDay(dayNum);
    if (dayBookings.length === 0) {
      return {
        type: "BLANK" as const,
        bookings: [],
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        pendingCount: 0,
      };
    }

    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;

    for (const b of dayBookings) {
      const bTotal = Number(b.totalAmount || 0);
      totalAmount += bTotal;
      if (isBookingFullyPaid(b)) {
        paidAmount += bTotal;
      } else {
        pendingAmount += bTotal;
        pendingCount += 1;
      }
    }

    if (pendingCount === 0) {
      return {
        type: "FULL_PAID" as const,
        bookings: dayBookings,
        totalAmount,
        paidAmount,
        pendingAmount,
        pendingCount: 0,
      };
    }

    return {
      type: "PENDING" as const,
      bookings: dayBookings,
      totalAmount,
      paidAmount,
      pendingAmount,
      pendingCount,
    };
  };

  // Selected Day Details
  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];
  const selectedDayEval = (() => {
    if (!selectedDate || selectedDayBookings.length === 0) {
      return { type: "BLANK" as const, total: 0, paid: 0, pending: 0, pendingCount: 0 };
    }
    let total = 0;
    let paid = 0;
    let pending = 0;
    let pendingCount = 0;
    for (const b of selectedDayBookings) {
      const amt = Number(b.totalAmount || 0);
      total += amt;
      if (isBookingFullyPaid(b)) {
        paid += amt;
      } else {
        pending += amt;
        pendingCount += 1;
      }
    }
    return {
      type: pendingCount === 0 ? ("FULL_PAID" as const) : ("PENDING" as const),
      total,
      paid,
      pending,
      pendingCount,
    };
  })();

  // Month Overview Stats
  const monthStats = (() => {
    let monthTotal = 0;
    let monthPaid = 0;
    let monthPending = 0;
    let totalBookings = 0;
    let pendingBookings = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayBookings = getBookingsForDay(d);
      for (const b of dayBookings) {
        totalBookings += 1;
        const amt = Number(b.totalAmount || 0);
        monthTotal += amt;
        if (isBookingFullyPaid(b)) {
          monthPaid += amt;
        } else {
          monthPending += amt;
          pendingBookings += 1;
        }
      }
    }

    return {
      monthTotal,
      monthPaid,
      monthPending,
      totalBookings,
      pendingBookings,
    };
  })();

  // All Pending Bookings across the entire system
  const allPendingBookings = bookings
    .filter((b) => b.status !== "CANCELLED" && !isBookingFullyPaid(b))
    .filter((b) => {
      if (!pendingSearchQuery.trim()) return true;
      const q = pendingSearchQuery.toLowerCase();
      return (
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q) ||
        b.customerPhone?.toLowerCase().includes(q) ||
        b.facility?.name?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Handle Edit Payment Click
  const handleOpenEditModal = (b: any) => {
    setEditingBooking(b);
    setEditStatus(isBookingFullyPaid(b) ? "PAID" : b.paymentStatus || "PENDING");
    setEditMethod(b.paymentMethod || "CASH_AT_OFFICE");
    setEditRefNo(b.paymentRefNo || "");
    setEditNotes(b.notes || "");
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
  };

  // Handle Save Payment with Instant Optimistic UI Update
  const handleSavePayment = async () => {
    if (!editingBooking) return;
    setSavingPayment(true);
    setSaveErrorMsg("");
    setSaveSuccessMsg("");

    const previousBookings = [...bookings];
    // Optimistic instant local update in 0ms:
    setBookings((prev) =>
      prev.map((item) =>
        item.id === editingBooking.id
          ? {
              ...item,
              paymentStatus: editStatus,
              paymentMethod: editMethod,
              paymentRefNo: editRefNo,
              notes: editNotes,
            }
          : item
      )
    );

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBooking.id,
          paymentStatus: editStatus,
          paymentMethod: editMethod,
          paymentRefNo: editRefNo,
          notes: editNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Revert on error
        setBookings(previousBookings);
        throw new Error(data.error || "Failed to update payment status");
      }

      setSaveSuccessMsg("✓ પેમેન્ટ સ્થિતિ સફળતાપૂર્વક અપડેટ થઈ ગઈ!");
      setTimeout(() => {
        setEditingBooking(null);
        setSaveSuccessMsg("");
      }, 500);
    } catch (err: any) {
      setBookings(previousBookings);
      console.error(err);
      setSaveErrorMsg(err.message || "Failed to update payment status");
    } finally {
      setSavingPayment(false);
    }
  };

  // While user authentication is being verified, never flash "Restricted Access"!
  if (authLoading || (currentUser === null && loading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4">
        <div className="w-10 h-10 border-3 border-red-800 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">પેમેન્ટ સ્થિતિ લોડ થઈ રહી છે...</p>
      </div>
    );
  }

  // Access Control: Only Super Admin Can View (and ONLY if auth has finished loading and currentUser is definitely not Super Admin)
  if (!authLoading && currentUser && currentUser.role !== "SUPER_ADMIN") {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border border-rose-200 p-8 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">
          પ્રતિબંધિત એક્સેસ (Restricted Access)
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          આ પેમેન્ટ સ્થિતિ પેજ ફક્ત ટ્રસ્ટના સુપર એડમિન (ટ્રસ્ટી) માટે જ અધિકૃત છે.
          વ્યૂ-ઓન્લી એડમિન પેમેન્ટ વિગતો જોઈ કે બદલી શકતા નથી.
        </p>
        <div className="pt-2">
          <Link
            href="/admin/calendar"
            className="inline-flex items-center px-6 py-2.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-bold text-sm shadow-xs transition"
          >
            કેલેન્ડર પર પાછા જાઓ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200">
              સુપર એડમિન કંટ્રોલ (SUPER ADMIN ONLY)
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-bold text-slate-500">ટ્રસ્ટ ચુકવણી ખાતાવહી</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-[#0066cc]" />
            <span>પેમેન્ટ સ્થિતિ (Payment Status)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            તારીખ મુજબ સંપૂર્ણ મળેલ અને બાકી રહેલ ભાડાની ચુકવણીનું મોનિટરિંગ અને એડિટિંગ.
          </p>
        </div>

        {/* View Switcher: Calendar vs All Pending List */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold self-start md:self-auto">
          <button
            onClick={() => setActiveTab("CALENDAR")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === "CALENDAR"
                ? "bg-white text-slate-950 font-black shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#0066cc]" />
            <span>કેલેન્ડર વ્યૂ (Calendar)</span>
          </button>
          <button
            onClick={() => setActiveTab("PENDING_LIST")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === "PENDING_LIST"
                ? "bg-white text-slate-950 font-black shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>બાકી પેમેન્ટ્સ લિસ્ટ ({allPendingBookings.length})</span>
          </button>
        </div>
      </div>

      {/* Monthly Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Month Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>કુલ બુકિંગ રકમ</span>
            <Banknote className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
            ₹{monthStats.monthTotal.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            કુલ {monthStats.totalBookings} બુકિંગ્સ
          </span>
        </div>

        {/* Full Payment (Green) */}
        <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border-2 border-emerald-300 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>🟢 પૂર્ણ ચુકવણી મળેલ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1.5">
            ₹{monthStats.monthPaid.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            જમા થયેલ રકમ
          </span>
        </div>

        {/* Pending Payment (Yellow) */}
        <div className="bg-amber-50/70 p-4 sm:p-5 rounded-2xl border-2 border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span>🟡 બાકી ચુકવણી</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1.5">
            ₹{monthStats.monthPending.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
            વસૂલ કરવાની બાકી રકમ
          </span>
        </div>

        {/* Pending Bookings Count */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>બાકી બુકિંગ્સ સંખ્યા</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
            {monthStats.pendingBookings}{" "}
            <span className="text-sm font-normal text-slate-400">બુકિંગ</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            આ મહિનામાં બાકી ખાતા
          </span>
        </div>
      </div>

      {/* TAB 1: CALENDAR VIEW */}
      {activeTab === "CALENDAR" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
            {/* Month & Period Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevMonth}
                  aria-label="Previous Month"
                  className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-xl text-slate-600 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  {monthNames[month]} {year}
                </h2>
                <button
                  onClick={nextMonth}
                  aria-label="Next Month"
                  className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-xl text-slate-600 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={goToToday}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  આજનો દિવસ (Today)
                </button>

                {/* Facility Filter */}
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="ALL">બધી સુવિધાઓ (All)</option>
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* COLOR SCHEME & FACILITY LEGEND */}
            <div className="p-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700 shadow-2xs">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
                <span className="text-[11px] font-black uppercase text-slate-400">પેમેન્ટ સ્થિતિ:</span>
                <div className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
                  <span className="text-slate-500 font-semibold">ખાલી દિવસ</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    🟢 પૂર્ણ ચુકવણી (Full Paid)
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                    🟡 ચુકવણી બાકી (Pending)
                  </span>
                </div>
              </div>

              {/* Facility Dots Legend */}
              <div className="flex items-center space-x-3 flex-wrap gap-y-1 text-[11px] text-slate-600">
                <span className="text-[11px] font-black uppercase text-slate-400">સુવિધાઓ:</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> 🌳 પ્લોટ
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> 🏛️ હોલ
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-600" /> 🛏️ ડોર્મિટરી
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> 🚪 રૂમ
                </span>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-500 py-1.5 border-b border-slate-100">
              <span className="text-red-700 font-black">રવિ (Sun)</span>
              <span>સોમ (Mon)</span>
              <span>મંગળ (Tue)</span>
              <span>બુધ (Wed)</span>
              <span>ગુરુ (Thu)</span>
              <span>શુક્ર (Fri)</span>
              <span>શનિ (Sat)</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {/* Blanks before day 1 */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`blank-${i}`}
                  className="min-h-[66px] sm:min-h-[86px] bg-slate-50/50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200/70"
                />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayDate = new Date(year, month, dayNum);
                const evalResult = getDayPaymentEvaluation(dayNum);
                const isSelected =
                  selectedDate &&
                  selectedDate.getDate() === dayNum &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getFullYear() === year;

                // Color-coded booked facility types for dots
                const dayBookings = getBookingsForDay(dayNum);
                const bookedFacTypes = Array.from(
                  new Set(
                    dayBookings.map((b) => {
                      const fac = facilities.find((f) => f.id === b.facilityId) || b.facility;
                      return fac?.type || "";
                    }).filter(Boolean)
                  )
                );

                // Card and badge themes with soft glassmorphism
                let cardTheme = "bg-white/90 border border-slate-200/90 text-slate-800 hover:border-slate-300 hover:bg-slate-50/90";
                let badge = null;

                if (evalResult.type === "FULL_PAID") {
                  cardTheme = "bg-emerald-50/70 border-emerald-200/90 text-emerald-950 hover:bg-emerald-100/70 hover:border-emerald-300";
                  badge = (
                    <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs truncate block max-w-full">
                      🟢 ₹{evalResult.totalAmount.toLocaleString("en-IN")}
                    </span>
                  );
                } else if (evalResult.type === "PENDING") {
                  cardTheme = "bg-amber-50/70 border-amber-200/90 text-amber-950 hover:bg-amber-100/70 hover:border-amber-300";
                  badge = (
                    <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs truncate block max-w-full">
                      🟡 ₹{evalResult.pendingAmount.toLocaleString("en-IN")} બાકી
                    </span>
                  );
                }

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => setSelectedDate(dayDate)}
                    className={`min-h-[66px] sm:min-h-[86px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 text-center ${cardTheme} ${
                      isSelected
                        ? "ring-4 ring-amber-400 border-amber-500 shadow-md scale-[1.03] z-10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs sm:text-sm font-black leading-none text-slate-900 font-mono tabular-nums">
                        {dayNum}
                      </span>
                    </div>

                    {/* Badge */}
                    <div className="w-full my-auto">
                      {badge}
                    </div>

                    {/* Facility Dots */}
                    {bookedFacTypes.length > 0 && (
                      <div className="flex items-center gap-1 pt-0.5 shrink-0">
                        {bookedFacTypes.includes("PLOT") && (
                          <span title="પાર્ટી પ્લોટ" className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-300 shadow-2xs" />
                        )}
                        {bookedFacTypes.includes("HALL") && (
                          <span title="કોમ્યુનિટી હોલ" className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 ring-1 ring-blue-300 shadow-2xs" />
                        )}
                        {bookedFacTypes.includes("DORMITORY") && (
                          <span title="ડોર્મિટરી" className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-600 ring-1 ring-purple-300 shadow-2xs" />
                        )}
                        {bookedFacTypes.includes("ROOM") && (
                          <span title="એસી ગેસ્ટ રૂમ" className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 ring-1 ring-amber-300 shadow-2xs" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Payment Inspector (Right Col) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4 flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-100 pb-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-500">
                  તારીખ વિગત (DAY INSPECTOR)
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                    selectedDayEval.type === "BLANK"
                      ? "bg-slate-100 text-slate-700 border-slate-300"
                      : selectedDayEval.type === "FULL_PAID"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  {selectedDayEval.type === "BLANK"
                    ? "⚪ કોઈ બુકિંગ નથી"
                    : selectedDayEval.type === "FULL_PAID"
                    ? "🟢 પૂર્ણ ચુકવણી (Full Paid)"
                    : "🟡 ચુકવણી બાકી (Pending)"}
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "તારીખ પસંદ કરો"}
              </h3>
            </div>

            {/* Selected Day Stats */}
            {selectedDayEval.type !== "BLANK" && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">કુલ રકમ:</span>
                  <span className="text-sm font-black text-slate-900">
                    ₹{selectedDayEval.total.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">બાકી રકમ:</span>
                  <span className="text-sm font-black text-amber-800">
                    ₹{selectedDayEval.pending.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            {/* Bookings List for the Day */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    ⚪
                  </div>
                  <div className="text-sm font-bold text-slate-700">આ તારીખે કોઈ બુકિંગ નથી</div>
                  <p className="text-xs text-slate-400">
                    સફેદ કલર એટલે ખાલી દિવસ. આ તારીખે નવી બુકિંગ કરી શકાય છે.
                  </p>
                </div>
              ) : (
                selectedDayBookings.map((b) => {
                  const badge = getPaymentBadge(b.paymentStatus);
                  const cleanPhone = b.customerPhone?.replace(/\D/g, "") || "";
                  const waMessage = `શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ-નરોડા)\nજય શ્રી ખોડિયાર 🙏\n\nબુકિંગ પેમેન્ટ સ્થિતિ:\n• બુકિંગ નંબર: ${b.bookingNumber}\n• અરજદાર: ${b.customerName}\n• સુવિધા: ${b.facility?.name}\n• કુલ રકમ: ₹${b.totalAmount}\n• પેમેન્ટ સ્થિતિ: ${badge.shortLabel}\n• પદ્ધતિ: ${b.paymentMethod || "રોકડ"}`;

                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl border-2 space-y-3 transition shadow-2xs ${
                        badge.isPaid
                          ? "bg-emerald-50/60 border-emerald-300"
                          : "bg-amber-50/60 border-amber-300"
                      }`}
                    >
                      {/* Booking Top Info */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800">
                          {b.bookingNumber}
                        </span>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Applicant & Facility */}
                      <div>
                        <h4 className="text-base font-black text-slate-900">{b.customerName}</h4>
                        <p className="text-xs font-bold text-slate-600 mt-0.5">
                          🏛️ {b.facility?.name} • ({formatSlotLabel(b.slot)})
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          🎉 પ્રસંગ: {b.eventType}
                        </p>
                      </div>

                      {/* Payment Breakdown */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">કુલ ભાડું (Total):</span>
                          <span className="font-black text-slate-900 text-sm">
                            ₹{Number(b.totalAmount || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                        {b.depositAmount > 0 && (
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>ડિપોઝિટ (Deposit):</span>
                            <span className="font-bold">
                              ₹{Number(b.depositAmount).toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-500">ચુકવણી પદ્ધતિ:</span>
                          <span className="font-bold text-slate-800">
                            {b.paymentMethod === "CASH_AT_OFFICE"
                              ? "રોકડ (Cash)"
                              : b.paymentMethod === "UPI_BANK_TRANSFER"
                              ? "UPI / બેંક ટ્રાન્સફર"
                              : b.paymentMethod === "CHEQUE"
                              ? "ચેક (Cheque)"
                              : b.paymentMethod || "રોકડ"}
                          </span>
                        </div>
                        {b.paymentRefNo && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">રેફરન્સ / પાવતી:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {b.paymentRefNo}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Phone & Shortcuts */}
                      {b.customerPhone && (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-500 font-semibold">
                            📞 {b.customerPhone}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <a
                              href={`tel:${b.customerPhone}`}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition"
                            >
                              કોલ
                            </a>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                                  waMessage
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* EDIT PAYMENT STATUS ACTION (Only Super Admin) */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(b)}
                          className="w-full py-2.5 px-3 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] active:bg-[#0077ed] text-white font-black text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ચુકવણી સ્થિતિ અપડેટ કરો (Update Payment)</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL PENDING PAYMENTS QUICK LIST */}
      {activeTab === "PENDING_LIST" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span>બધા બાકી પેમેન્ટ્સનું લિસ્ટ (All Pending Bookings)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                કુલ {allPendingBookings.length} બુકિંગ્સમાં પેમેન્ટ બાકી છે. અહીંથી સીધું અપડેટ કરી શકો છો.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="નામ, મોબાઇલ કે બુકિંગ નં..."
                value={pendingSearchQuery}
                onChange={(e) => setPendingSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-white"
              />
            </div>
          </div>

          {allPendingBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="text-base font-black text-slate-800">
                કોઈ પેમેન્ટ બાકી નથી! (No Pending Payments)
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                બધા જ એક્ટિવ બુકિંગ્સના પેમેન્ટ જમા થઈ ગયા છે.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">બુકિંગ નં</th>
                    <th className="py-3 px-3">તારીખ</th>
                    <th className="py-3 px-3">અરજદાર</th>
                    <th className="py-3 px-3">સુવિધા</th>
                    <th className="py-3 px-3">બાકી રકમ</th>
                    <th className="py-3 px-3">સ્થિતિ</th>
                    <th className="py-3 px-3 text-right">ક્રિયા (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allPendingBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-amber-50/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {b.bookingNumber}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                        {new Date(b.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {b.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        <div>{b.facility?.name}</div>
                        <div className="text-[10px] text-slate-400">{formatSlotLabel(b.slot)}</div>
                      </td>
                      <td className="py-3 px-3 font-black text-amber-900 text-sm whitespace-nowrap">
                        ₹{Number(b.totalAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                          🟡 બાકી (Pending)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(b)}
                          className="px-3 py-1.5 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] text-white font-bold text-xs shadow-xs transition inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>ચુકવણી અપડેટ</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUPER ADMIN EDIT PAYMENT MODAL */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#0066cc] tracking-wider">
                  સુપર એડમિન ચુકવણી નિયંત્રણ
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  ચુકવણી સ્થિતિ અપડેટ કરો
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Booking Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-slate-700">
                  {editingBooking.bookingNumber}
                </span>
                <span className="font-black text-slate-900 text-sm">
                  કુલ: ₹{Number(editingBooking.totalAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="font-black text-slate-900 text-sm">
                {editingBooking.customerName} ({editingBooking.customerPhone})
              </div>
              <div className="text-slate-500">
                {editingBooking.facility?.name} •{" "}
                {new Date(editingBooking.startDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Error & Success Messages */}
            {saveErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                ⚠️ {saveErrorMsg}
              </div>
            )}
            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-black text-emerald-900">
                {saveSuccessMsg}
              </div>
            )}

            {/* Payment Status Selector (Green vs Yellow) */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block uppercase">
                ૧. ચુકવણી સ્થિતિ પસંદ કરો (Payment Status) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Full Payment Button */}
                <button
                  type="button"
                  onClick={() => setEditStatus("PAID")}
                  className={`p-3 rounded-2xl border-2 text-left font-bold transition flex items-center space-x-2.5 cursor-pointer ${
                    editStatus === "PAID" || editStatus === "PAID_CASH" || editStatus === "PAID_FULL"
                      ? "bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-300"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <div>
                    <div className="text-xs font-black">🟢 પૂર્ણ ચુકવણી (Paid)</div>
                    <div className="text-[10px] text-emerald-800 font-normal">સંપૂર્ણ રકમ જમા થઈ ગઈ</div>
                  </div>
                </button>

                {/* Pending Payment Button */}
                <button
                  type="button"
                  onClick={() => setEditStatus("PENDING")}
                  className={`p-3 rounded-2xl border-2 text-left font-bold transition flex items-center space-x-2.5 cursor-pointer ${
                    editStatus === "PENDING"
                      ? "bg-amber-100 border-amber-500 text-amber-950 ring-2 ring-amber-300"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0"></span>
                  <div>
                    <div className="text-xs font-black">🟡 બાકી પેમેન્ટ (Pending)</div>
                    <div className="text-[10px] text-amber-800 font-normal">રકમ લેવાની બાકી છે</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block uppercase">
                ૨. ચુકવણી પદ્ધતિ (Payment Method)
              </label>
              <select
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="CASH_AT_OFFICE">રોકડ (Cash at Office)</option>
                <option value="UPI_BANK_TRANSFER">UPI / બેંક ટ્રાન્સફર (Google Pay / PhonePe / IMPS)</option>
                <option value="CHEQUE">ચેક (Cheque)</option>
                <option value="ONLINE">ઓનલાઇન પેમેન્ટ (Online Payment)</option>
              </select>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block uppercase">
                ૩. પાવતી / ટ્રાન્ઝેક્શન / ચેક નંબર (Reference No.)
              </label>
              <input
                type="text"
                placeholder="દા.ત. UTR12345678, રસીદ નં ૪૫, ચેક નં"
                value={editRefNo}
                onChange={(e) => setEditRefNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 bg-white"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block uppercase">
                ૪. નોંધ / રિમાર્ક (Optional Notes)
              </label>
              <input
                type="text"
                placeholder="દા.ત. ડિપોઝિટ રોકડા મળ્યા, બાકી ₹2000 પ્રસંગ વખતે આપશે"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                રદ કરો (Cancel)
              </button>
              <button
                type="button"
                disabled={savingPayment}
                onClick={handleSavePayment}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] active:bg-[#0077ed] text-white text-xs font-black shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                {savingPayment ? (
                  <span>સાચવી રહ્યા છીએ...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>સાચવો (Save Changes)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
