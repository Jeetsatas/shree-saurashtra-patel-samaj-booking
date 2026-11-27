"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  User,
  MapPin,
  Tag,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { fetchAdminJson, getAdminCachedData } from "@/lib/admin-client-cache";
import {
  isFullDaySlot,
  formatSlotLabel,
  groupBookingsByParty,
  PartyBookingGroup,
  JamaEntry,
  parseJamaEntries,
  setJamaEntriesInNotes,
  calculateEventDeposit,
} from "@/lib/slotUtils";

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
      shortLabel: "સંપૂર્ણ ચુકતે",
      badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
      dotColor: "#10b981",
      isPaid: true,
    };
  }
  if (s === "PARTIAL") {
    return {
      label: "🟡 આંશિક ચુકવણી (Partial)",
      shortLabel: "આંશિક જમા",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#f59e0b",
      isPaid: false,
    };
  }
  return {
    label: "🟡 ચુકવણી બાકી (Pending)",
    shortLabel: "ચુકવણી બાકી",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
    dotColor: "#f43f5e",
    isPaid: false,
  };
}

function formatPaymentMode(mode?: string | null): string {
  switch (mode) {
    case "CASH_AT_OFFICE":
      return "રોકડ (Cash at Office)";
    case "UPI_BANK_TRANSFER":
      return "UPI / બેંક ટ્રાન્સફર";
    case "CHEQUE":
      return "ચેક (Cheque)";
    case "ONLINE":
      return "ઓનલાઈન પોર્ટલ";
    default:
      return mode || "રોકડ";
  }
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

  // Active Tab: PARTY_LEDGER is the primary default view
  const [activeTab, setActiveTab] = useState<"PARTY_LEDGER" | "CALENDAR" | "PENDING_LIST">("PARTY_LEDGER");

  // Party Ledger State
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [partyStatusFilter, setPartyStatusFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID">("ALL");

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");

  // Quick Single Booking Edit Modal
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<string>("PAID");
  const [editMethod, setEditMethod] = useState<string>("CASH_AT_OFFICE");
  const [editRefNo, setEditRefNo] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string>("");

  // JAMA MODAL (Party-wise Jama Entry Ledger)
  const [selectedPartyForJama, setSelectedPartyForJama] = useState<PartyBookingGroup | null>(null);
  const [jamaAmountInput, setJamaAmountInput] = useState<string>("");
  const [jamaDateInput, setJamaDateInput] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [jamaMethodInput, setJamaMethodInput] = useState<string>("CASH_AT_OFFICE");
  const [jamaRefNoInput, setJamaRefNoInput] = useState<string>("");
  const [jamaNotesInput, setJamaNotesInput] = useState<string>("");
  const [partyJamaLedger, setPartyJamaLedger] = useState<JamaEntry[]>([]);
  const [savingJama, setSavingJama] = useState(false);
  const [jamaError, setJamaError] = useState("");
  const [jamaSuccess, setJamaSuccess] = useState("");

  // View Party Details Modal
  const [viewingParty, setViewingParty] = useState<PartyBookingGroup | null>(null);

  const isMounted = useRef(false);
  const bookingsRefresh = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const cachedBookings = getAdminCachedData<any>("/api/bookings");
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
        if (now - lastRefreshTime > 10000) {
          lastRefreshTime = now;
          refreshBookings();
        }
      }
    };
    const timer = window.setInterval(refreshWhileVisible, 45000);
    window.addEventListener("focus", refreshWhileVisible);
    document.addEventListener("visibilitychange", refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhileVisible);
      document.removeEventListener("visibilitychange", refreshWhileVisible);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      if (!getAdminCachedData("/api/bookings")) {
        setLoading(true);
      }
      const [facRes, bookRes, userRes] = await Promise.allSettled([
        fetchAdminJson<any>("/api/facilities"),
        fetchAdminJson<any>("/api/bookings"),
        fetchAdminJson<any>("/api/auth/me"),
      ]);

      if (facRes.status === "fulfilled" && facRes.value?.facilities) {
        setFacilities(facRes.value.facilities);
      }
      if (bookRes.status === "fulfilled" && bookRes.value?.bookings) {
        setBookings(bookRes.value.bookings);
      }
      if (userRes.status === "fulfilled" && userRes.value?.user) {
        setCurrentUser(userRes.value.user);
      }
    } catch (err) {
      console.error("Payment status load error:", err);
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const refreshBookings = async () => {
    if (bookingsRefresh.current) return bookingsRefresh.current;
    bookingsRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>("/api/bookings");
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

  // Group all bookings into Parties
  const partyGroups: PartyBookingGroup[] = useMemo(() => {
    return groupBookingsByParty(bookings);
  }, [bookings]);

  // Filtered party groups for the Party Ledger tab
  const filteredPartyGroups = useMemo(() => {
    return partyGroups.filter((g) => {
      // Search Filter
      if (partySearchQuery.trim()) {
        const q = partySearchQuery.toLowerCase().trim();
        const matchesName = g.customerName.toLowerCase().includes(q);
        const matchesPhone = g.customerPhone.includes(q);
        const matchesBookings = g.bookings.some(
          (b) =>
            b.bookingNumber?.toLowerCase().includes(q) ||
            b.facility?.name?.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesPhone && !matchesBookings) return false;
      }

      // Status Filter
      if (partyStatusFilter !== "ALL") {
        if (g.paymentStatus !== partyStatusFilter) return false;
      }

      return true;
    });
  }, [partyGroups, partySearchQuery, partyStatusFilter]);

  // Overall Party Ledger Financial Statistics
  const partyStats = useMemo(() => {
    let totalParties = partyGroups.length;
    let totalBilled = 0;
    let totalJamaCollected = 0;
    let totalNetRemaining = 0;
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;

    for (const g of partyGroups) {
      totalBilled += g.net;
      totalJamaCollected += g.totalJama;
      totalNetRemaining += g.netRemaining;

      if (g.paymentStatus === "PAID") paidCount++;
      else if (g.paymentStatus === "PARTIAL") partialCount++;
      else pendingCount++;
    }

    return {
      totalParties,
      totalBilled,
      totalJamaCollected,
      totalNetRemaining,
      paidCount,
      partialCount,
      pendingCount,
    };
  }, [partyGroups]);

  // Open Jama Modal for a Party
  const handleOpenJamaModal = (party: PartyBookingGroup) => {
    setSelectedPartyForJama(party);
    setPartyJamaLedger([...party.jamaEntries]);
    setJamaAmountInput(party.netRemaining > 0 ? String(party.netRemaining) : "");
    const today = new Date();
    setJamaDateInput(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    );
    setJamaMethodInput("CASH_AT_OFFICE");
    setJamaRefNoInput("");
    setJamaNotesInput("");
    setJamaError("");
    setJamaSuccess("");
  };

  // Add Jama entry to local ledger in modal
  const handleAddJamaEntryToLedger = () => {
    const amt = Number(jamaAmountInput);
    if (!amt || isNaN(amt) || amt <= 0) {
      setJamaError("કૃપા કરીને માન્ય જમા રકમ દાખલ કરો (Please enter valid jama amount).");
      return;
    }
    if (!jamaDateInput) {
      setJamaError("કૃપા કરીને જમા તારીખ પસંદ કરો (Please select jama date).");
      return;
    }

    const newEntry: JamaEntry = {
      id: `jama-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: amt,
      date: jamaDateInput,
      method: jamaMethodInput,
      refNo: jamaRefNoInput.trim() || undefined,
      notes: jamaNotesInput.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setPartyJamaLedger((prev) => [newEntry, ...prev]);
    setJamaAmountInput("");
    setJamaRefNoInput("");
    setJamaNotesInput("");
    setJamaError("");
  };

  // Remove Jama entry from local ledger in modal
  const handleRemoveJamaEntry = (entryId: string) => {
    setPartyJamaLedger((prev) => prev.filter((e) => e.id !== entryId));
  };

  // Save all Jama entries for this Party to DB
  const handleSavePartyJama = async () => {
    if (!selectedPartyForJama) return;

    // If user filled in the input but didn't click "Add", include it automatically
    let finalLedger = [...partyJamaLedger];
    const pendingAmt = Number(jamaAmountInput);
    if (pendingAmt > 0 && jamaDateInput) {
      const quickEntry: JamaEntry = {
        id: `jama-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        amount: pendingAmt,
        date: jamaDateInput,
        method: jamaMethodInput,
        refNo: jamaRefNoInput.trim() || undefined,
        notes: jamaNotesInput.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      finalLedger = [quickEntry, ...finalLedger];
    }

    setSavingJama(true);
    setJamaError("");
    setJamaSuccess("");

    const totalJama = finalLedger.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const newNetRemaining = Math.max(0, selectedPartyForJama.net - totalJama);
    const isFullPaid = newNetRemaining <= 0;
    const derivedStatus = isFullPaid ? "PAID" : totalJama > 0 ? "PARTIAL" : "PENDING";

    // Optimistic UI update across all party bookings in local state
    const partyBookingIdSet = new Set(selectedPartyForJama.bookingIds);
    setBookings((prev) =>
      prev.map((b) => {
        if (partyBookingIdSet.has(b.id)) {
          return {
            ...b,
            paymentStatus: derivedStatus,
            paymentMethod: finalLedger[0]?.method || b.paymentMethod,
            paymentRefNo: finalLedger[0]?.refNo || b.paymentRefNo,
            notes: setJamaEntriesInNotes(b.notes, finalLedger),
          };
        }
        return b;
      })
    );

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedPartyForJama.bookingIds,
          jamaEntries: finalLedger,
          isFullPaid,
          updateAllRelated: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save jama entries");
      }

      setJamaSuccess("જમા રકમ અને ખાતાવહી સફળતાપૂર્વક સાચવવામાં આવી છે!");
      setTimeout(() => {
        setSelectedPartyForJama(null);
        refreshBookings();
      }, 1000);
    } catch (err: any) {
      console.error("Save Jama error:", err);
      setJamaError(err.message || "Failed to save jama entries");
    } finally {
      setSavingJama(false);
    }
  };

  // Calendar Date Navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthNames = [
    "January (જાન્યુઆરી)", "February (ફેબ્રુઆરી)", "March (માર્ચ)",
    "April (એપ્રિલ)", "May (મે)", "June (જૂન)", "July (જુલાઈ)",
    "August (ઓગસ્ટ)", "September (સપ્ટેમ્બર)", "October (ઓક્ટોબર)",
    "November (નવેમ્બર)", "December (ડિસેમ્બર)",
  ];

  // Get active bookings for a specific calendar date
  const getBookingsForDate = (dateObj: Date) => {
    const targetStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    return bookings.filter((b) => {
      if (selectedFacilityId !== "ALL" && b.facilityId !== selectedFacilityId) return false;
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

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

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

  // Handle Quick Edit Modal
  const handleOpenEditModal = (b: any) => {
    setEditingBooking(b);
    setEditStatus(isBookingFullyPaid(b) ? "PAID" : b.paymentStatus || "PENDING");
    setEditMethod(b.paymentMethod || "CASH_AT_OFFICE");
    setEditRefNo(b.paymentRefNo || "");
    setEditNotes(b.notes || "");
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
  };

  const handleSavePayment = async () => {
    if (!editingBooking) return;
    setSavingPayment(true);
    setSaveErrorMsg("");
    setSaveSuccessMsg("");

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
          updateAllRelated: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update payment");
      }

      setSaveSuccessMsg("પેમેન્ટ સ્થિતિ સફળતાપૂર્વક અપડેટ થઈ ગઈ!");
      setTimeout(() => {
        setEditingBooking(null);
        refreshBookings();
      }, 700);
    } catch (err: any) {
      console.error("Save payment error:", err);
      setSaveErrorMsg(err.message || "Failed to update payment status");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Top Banner & Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-700 flex items-center justify-center text-white shadow-sm shadow-amber-600/30">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>પેમેન્ટ સ્થિતિ અને જમા ખાતાવહી</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Accounts & Jama Ledger
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  પાર્ટી વાઇઝ બુકિંગ ખાતું, ડિપોઝિટ, જમા રકમ અને કેલેન્ડર સ્થિતિ
                </p>
              </div>
            </div>

            {/* View Switcher Tabs (iOS Segmented Style) */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("PARTY_LEDGER")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "PARTY_LEDGER"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span>પાર્ટી ખાતાવહી (Parties)</span>
                  <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono">
                    {partyGroups.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("CALENDAR")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "CALENDAR"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>કેલેન્ડર (Calendar)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("PENDING_LIST")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "PENDING_LIST"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>બાકી યાદી (Pending)</span>
                  {allPendingBookings.length > 0 && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono">
                      {allPendingBookings.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => refreshBookings()}
                title="Refresh data"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* ========================================================================= */}
        {/* TAB 1: 🏢 PARTY-WISE ACCOUNTS & JAMA LEDGER (PRIMARY DEFAULT VIEW)        */}
        {/* ========================================================================= */}
        {activeTab === "PARTY_LEDGER" && (
          <div className="space-y-6">
            {/* 4-Box Top KPI Financial Summary Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>કુલ પાર્ટીઓ</span>
                  <Building className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {partyStats.totalParties}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                  <span className="text-emerald-700 font-bold">{partyStats.paidCount} ચુકતે</span>
                  <span>•</span>
                  <span className="text-amber-700 font-bold">{partyStats.partialCount} આંશિક</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">{partyStats.pendingCount} બાકી</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/30 to-white shadow-2xs">
                <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                  <span>કુલ નેટ બિલિંગ (Net Billed)</span>
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-950 mt-1 tabular-nums">
                  ₹{partyStats.totalBilled.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-blue-700 mt-1">
                  ડિસ્કાઉન્ટ બાદ ભાડું + ડિપોઝિટ
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/30 to-white shadow-2xs">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                  <span>કુલ જમા મળેલ (Jama Collected)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
                  ₹{partyStats.totalJamaCollected.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  ખાતાવહીમાં જમા થયેલ કુલ રકમ
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50/30 to-white shadow-2xs">
                <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center justify-between">
                  <span>કુલ બાકી નેટ રકમ (Net Remaining)</span>
                  <Clock className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-900 mt-1 tabular-nums">
                  ₹{partyStats.totalNetRemaining.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-rose-700 mt-1 font-bold">
                  વસૂલવાપાત્ર બાકી રકમ
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={partySearchQuery}
                  onChange={(e) => setPartySearchQuery(e.target.value)}
                  placeholder="પાર્ટીનું નામ, ફોન નંબર કે બુકિંગ નંબરથી શોધો..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                />
                {partySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPartySearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { id: "ALL", label: "બધા (All)" },
                    { id: "PENDING", label: "બાકી (Pending)" },
                    { id: "PARTIAL", label: "આંશિક જમા (Partial)" },
                    { id: "PAID", label: "પૂર્ણ ચુકતે (Paid)" },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPartyStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      partyStatusFilter === st.id
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parties List */}
            {filteredPartyGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-base font-bold text-slate-800">કોઈ પાર્ટી મળી નથી</div>
                <p className="text-xs text-slate-500 mt-1">
                  શોધ શરતો બદલીને અથવા નવા ફિલ્ટર સાથે તપાસ કરો.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPartyGroups.map((party) => {
                  const badge = getPaymentBadge(party.paymentStatus);
                  return (
                    <div
                      key={party.partyKey}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition overflow-hidden"
                    >
                      {/* Party Card Header */}
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                              {party.customerName}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.badgeClass}`}
                            >
                              {badge.shortLabel}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {party.eventType}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            {party.customerPhone && (
                              <a
                                href={`tel:${party.customerPhone}`}
                                className="flex items-center gap-1 text-blue-700 hover:underline font-mono font-bold"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>{party.customerPhone}</span>
                              </a>
                            )}
                            {party.customerAddress && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-xs">{party.customerAddress}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                              <Calendar className="w-3 h-3 text-amber-700" />
                              <span>{party.dateRange.label}</span>
                            </span>
                          </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 self-start lg:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenJamaModal(party)}
                            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-sm shadow-amber-600/30 transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ જમા કરો (Add Jama)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingParty(party)}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>વિગત / રસીદ</span>
                          </button>
                        </div>
                      </div>

                      {/* Booked Facilities Pills */}
                      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                          બુક કરેલ સુવિધાઓ ({party.bookings.length}):
                        </span>
                        {party.bookings.map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-medium text-[11px]"
                          >
                            <Building className="w-3 h-3 text-slate-500" />
                            <span className="font-bold">{b.facility?.name || "Facility"}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                            </span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              ₹{(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* 4-METRIC FINANCIAL STRIP (Exact user formula) */}
                      <div className="p-4 sm:p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                          {/* 1. Total Rent */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              કુલ રકમ (Total)
                            </span>
                            <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                              ₹{party.total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-slate-400 block">સુવિધા ભાડું</span>
                          </div>

                          {/* 2. Total with Discount */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              ડિસ્કાઉન્ટ બાદ રકમ
                            </span>
                            <span className="text-base sm:text-lg font-black text-blue-900 tabular-nums">
                              ₹{party.totalWithDiscount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-blue-600 block">
                              {party.discountAmount > 0
                                ? `-₹${party.discountAmount.toLocaleString("en-IN")} ડિસ્કાઉન્ટ`
                                : "૦% ડિસ્કાઉન્ટ"}
                            </span>
                          </div>

                          {/* 3. Caution Deposit */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              ડિપોઝિટ (Deposit)
                            </span>
                            <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                              ₹{party.deposit.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-slate-500 block">રીફંડેબલ ડિપોઝિટ</span>
                          </div>

                          {/* 4. Net (After Deposit) */}
                          <div className="bg-amber-100/60 p-2 rounded-lg border border-amber-200/80">
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                              ચુકવવાપાત્ર કુલ નેટ (Net)
                            </span>
                            <span className="text-base sm:text-lg font-black text-amber-950 tabular-nums">
                              ₹{party.net.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-amber-800 font-bold block">
                              ભાડું + ડિપોઝિટ
                            </span>
                          </div>
                        </div>

                        {/* Jama Entries Ledger Banner & Net Remaining Adjustment */}
                        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-white border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>અત્યાર સુધી જમા રકમ:</span>
                              </span>
                              <span className="text-sm font-black text-emerald-800 tabular-nums">
                                ₹{party.totalJama.toLocaleString("en-IN")}
                              </span>
                            </div>

                            {/* Show previous Jama entries summary */}
                            {party.jamaEntries.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                {party.jamaEntries.slice(0, 3).map((ent) => (
                                  <span
                                    key={ent.id}
                                    className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-950 font-medium"
                                  >
                                    📅 {ent.date}: ₹{ent.amount.toLocaleString("en-IN")} ({formatPaymentMode(ent.method)})
                                  </span>
                                ))}
                                {party.jamaEntries.length > 3 && (
                                  <span className="text-slate-400">
                                    +{party.jamaEntries.length - 3} વધુ
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic">
                                હજુ સુધી કોઈ જમા રસીદ નોંધાયેલ નથી.
                              </div>
                            )}
                          </div>

                          {/* Net Remaining Balance Adjustment */}
                          <div className="text-right shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              બાકી રહેતી નેટ રકમ (Net Remaining)
                            </span>
                            <div className="flex items-center justify-end gap-1.5">
                              <span
                                className={`text-lg sm:text-xl font-black tabular-nums ${
                                  party.netRemaining === 0 ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                ₹{party.netRemaining.toLocaleString("en-IN")}
                              </span>
                              {party.netRemaining === 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  ✓ ચુકતે
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                  બાકી
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ₹{party.net.toLocaleString("en-IN")} - ₹{party.totalJama.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 📅 CALENDAR VIEW                                                   */}
        {/* ========================================================================= */}
        {activeTab === "CALENDAR" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              {/* Calendar Month Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {monthNames[month]} {year}
                  </h2>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    આજે (Today)
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase py-1 border-b border-slate-100">
                <span>રવિ</span>
                <span>સોમ</span>
                <span>મંગળ</span>
                <span>બુધ</span>
                <span>ગુરુ</span>
                <span>શુક્ર</span>
                <span>શનિ</span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} className="min-h-[70px] rounded-xl bg-slate-50/50 opacity-40" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayEval = getDayPaymentEvaluation(dayNum);
                  const thisDate = new Date(year, month, dayNum);
                  const isSelected =
                    selectedDate &&
                    selectedDate.getFullYear() === year &&
                    selectedDate.getMonth() === month &&
                    selectedDate.getDate() === dayNum;

                  const isToday =
                    new Date().getFullYear() === year &&
                    new Date().getMonth() === month &&
                    new Date().getDate() === dayNum;

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDate(thisDate)}
                      className={`min-h-[75px] p-1.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? "ring-2 ring-blue-600 border-blue-500 shadow-xs"
                          : "border-slate-200 hover:border-slate-300"
                      } ${
                        dayEval.type === "FULL_PAID"
                          ? "bg-emerald-50/60 border-emerald-200"
                          : dayEval.type === "PENDING"
                          ? "bg-amber-50/60 border-amber-200"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                            isToday
                              ? "bg-blue-600 text-white"
                              : "text-slate-800"
                          }`}
                        >
                          {dayNum}
                        </span>
                        {dayEval.type !== "BLANK" && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                dayEval.type === "FULL_PAID" ? "#10b981" : "#f59e0b",
                            }}
                          />
                        )}
                      </div>

                      {dayEval.type !== "BLANK" ? (
                        <div className="space-y-0.5 text-[10px]">
                          <span className="font-bold text-slate-800 block truncate">
                            {dayEval.bookings.length} બુકિંગ
                          </span>
                          <span
                            className={`font-black block tabular-nums ${
                              dayEval.type === "FULL_PAID"
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            ₹{dayEval.totalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-300">ખાલી</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>સંપૂર્ણ ચુકતે (Full Paid)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>ચુકવણી બાકી / આંશિક (Pending)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md border border-slate-200 bg-white" />
                  <span>ખાલી દિવસ (No Bookings)</span>
                </span>
              </div>
            </div>

            {/* Selected Date Details Sidebar */}
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "તારીખ પસંદ કરો"}
                  </span>
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {selectedDayBookings.length} બુકિંગ્સ
                </span>
              </div>

              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  આ તારીખે કોઈ બુકિંગ નોંધાયેલ નથી.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayBookings.map((b) => {
                    const badge = getPaymentBadge(b.paymentStatus);
                    const matchingParty = partyGroups.find((g) =>
                      g.bookingIds.includes(b.id)
                    );
                    return (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-black text-slate-900">
                              {b.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {b.facility?.name} • {formatSlotLabel(b.slot)}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${badge.badgeClass}`}
                          >
                            {badge.shortLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                          <span className="font-bold text-slate-700">
                            રકમ: ₹{Number(b.totalAmount || 0).toLocaleString("en-IN")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {matchingParty && (
                              <button
                                type="button"
                                onClick={() => handleOpenJamaModal(matchingParty)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                              >
                                + જમા
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(b)}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                            >
                              એડિટ
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ⏳ PENDING PAYMENTS LIST                                           */}
        {/* ========================================================================= */}
        {activeTab === "PENDING_LIST" && (
          <div className="space-y-4">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  placeholder="બાકી પેમેન્ટમાં શોધો..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="text-xs font-bold text-slate-500">
                કુલ બાકી: {allPendingBookings.length}
              </div>
            </div>

            {allPendingBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <div className="text-base font-bold text-slate-800">
                  બધા બુકિંગ્સનું પેમેન્ટ પૂર્ણ છે!
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="py-3 px-4">બુકિંગ #</th>
                        <th className="py-3 px-4">પાર્ટીનું નામ / ફોન</th>
                        <th className="py-3 px-4">સુવિધા</th>
                        <th className="py-3 px-4">તારીખ</th>
                        <th className="py-3 px-4">કુલ રકમ</th>
                        <th className="py-3 px-4">સ્થિતિ</th>
                        <th className="py-3 px-4 text-right">ક્રિયા</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {allPendingBookings.map((b) => {
                        const matchingParty = partyGroups.find((g) =>
                          g.bookingIds.includes(b.id)
                        );
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-blue-700">
                              {b.bookingNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{b.customerName}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {b.customerPhone}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">{b.facility?.name}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {new Date(b.startDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                              ₹{Number(b.totalAmount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                                બાકી
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              {matchingParty && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenJamaModal(matchingParty)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700"
                                >
                                  + જમા
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(b)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] hover:bg-slate-200 border border-slate-200"
                              >
                                એડિટ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: 💰 PARTY JAMA LEDGER MODAL (+ જમા કરો)                            */}
      {/* ========================================================================= */}
      {selectedPartyForJama && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200 block">
                  જમા ખાતાવહી નોંધણી (Party Jama Ledger)
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {selectedPartyForJama.customerName}
                </h3>
                <div className="text-xs text-amber-100 flex items-center gap-2 mt-0.5">
                  <span>{selectedPartyForJama.customerPhone}</span>
                  <span>•</span>
                  <span>{selectedPartyForJama.dateRange.label}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPartyForJama(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Party Financial Context Strip */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">
                    કુલ નેટ (Net Billed)
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-950 tabular-nums">
                    ₹{selectedPartyForJama.net.toLocaleString("en-IN")}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                    અત્યાર સુધી જમા
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-800 tabular-nums">
                    ₹{partyJamaLedger.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">
                    બાકી નેટ રકમ
                  </span>
                  {(() => {
                    const currentTotalJama = partyJamaLedger.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                    const rem = Math.max(0, selectedPartyForJama.net - currentTotalJama);
                    return (
                      <span className="text-base sm:text-lg font-black text-rose-800 tabular-nums">
                        ₹{rem.toLocaleString("en-IN")}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Form to Add New Jama Entry */}
              <div className="p-4 rounded-2xl border-2 border-amber-200/80 bg-white space-y-3.5 shadow-2xs">
                <div className="text-xs font-black text-slate-800 flex items-center justify-between">
                  <span>+ નવી જમા રકમ ઉમેરો (Add New Jama Entry)</span>
                  <span className="text-[10px] text-slate-500 font-normal">તારીખ અને રકમ પસંદ કરો</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Amount Input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      જમા રકમ (₹ Amount) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={jamaAmountInput}
                        onChange={(e) => setJamaAmountInput(e.target.value)}
                        placeholder="25000"
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Date Input */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      જમા તારીખ (Jama Date) *
                    </label>
                    <input
                      type="date"
                      value={jamaDateInput}
                      onChange={(e) => setJamaDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Payment Mode */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      ચુકવણી પદ્ધતિ (Mode)
                    </label>
                    <select
                      value={jamaMethodInput}
                      onChange={(e) => setJamaMethodInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                    >
                      <option value="CASH_AT_OFFICE">રોકડ (Cash at Office)</option>
                      <option value="UPI_BANK_TRANSFER">UPI / બેંક ટ્રાન્સફર (NEFT/IMPS)</option>
                      <option value="CHEQUE">ચેક (Cheque)</option>
                      <option value="ONLINE">ઓનલાઈન પોર્ટલ (Online)</option>
                    </select>
                  </div>

                  {/* Cheque / Ref No */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      ચેક / રેફરન્સ નંબર (Ref No)
                    </label>
                    <input
                      type="text"
                      value={jamaRefNoInput}
                      onChange={(e) => setJamaRefNoInput(e.target.value)}
                      placeholder="e.g. UTR12345 / CHQ-9988"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    નોંધ / વિગત (Note / Remarks)
                  </label>
                  <input
                    type="text"
                    value={jamaNotesInput}
                    onChange={(e) => setJamaNotesInput(e.target.value)}
                    placeholder="e.g. એડવાન્સ જમા (Advance token payment)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Add Entry Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddJamaEntryToLedger}
                    className="px-4 py-2 rounded-xl text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ખાતામાં ઉમેરો (+ Add Entry)</span>
                  </button>
                </div>
              </div>

              {/* Jama History Ledger for this Party */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>જમા થયેલ રસીદોનો ઇતિહાસ (Recorded Jama Entries)</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {partyJamaLedger.length} એન્ટ્રીઓ
                  </span>
                </div>

                {partyJamaLedger.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    હજુ સુધી આ પાર્ટી માટે કોઈ જમા એન્ટ્રી નથી.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {partyJamaLedger.map((ent, idx) => (
                      <div
                        key={ent.id || idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-800 tabular-nums">
                              ₹{ent.amount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                              {ent.date}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600">
                              {formatPaymentMode(ent.method)}
                            </span>
                          </div>
                          {(ent.refNo || ent.notes) && (
                            <div className="text-[11px] text-slate-500">
                              {ent.refNo ? `Ref: ${ent.refNo}` : ""}
                              {ent.refNo && ent.notes ? " • " : ""}
                              {ent.notes || ""}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveJamaEntry(ent.id)}
                          title="કાઢી નાખો (Remove)"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error & Success Messages */}
              {jamaError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{jamaError}</span>
                </div>
              )}
              {jamaSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{jamaSuccess}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedPartyForJama(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                રદ કરો (Cancel)
              </button>

              <button
                type="button"
                onClick={handleSavePartyJama}
                disabled={savingJama}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md shadow-amber-600/30 transition cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{savingJama ? "સાચવી રહ્યું છે..." : "ખાતાવહી સાચવો (Save Jama Ledger)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: 📄 VIEW PARTY DETAILS & OFFICIAL AUDIT BREAKDOWN                   */}
      {/* ========================================================================= */}
      {viewingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  પાર્ટી બુકિંગ સ્ટેટમેન્ટ (Party Statement)
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {viewingParty.customerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingParty(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">ફોન:</span>
                  <span className="font-mono font-bold">{viewingParty.customerPhone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">પ્રસંગ / પ્રકાર:</span>
                  <span className="font-bold">{viewingParty.eventType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">તારીખ ગાળો:</span>
                  <span className="font-bold text-amber-900">{viewingParty.dateRange.label}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-2">બુક કરેલ તમામ સુવિધાઓ:</span>
                <div className="space-y-1.5">
                  {viewingParty.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{b.facility?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} • {formatSlotLabel(b.slot)}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Totals */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>કુલ ભાડું (Total Rent):</span>
                  <span className="font-mono font-bold">₹{viewingParty.total.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>ડિસ્કાઉન્ટ બાદ (After Discount):</span>
                  <span className="font-mono font-bold">₹{viewingParty.totalWithDiscount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>ડિપોઝિટ (Caution Deposit):</span>
                  <span className="font-mono font-bold">₹{viewingParty.deposit.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-black text-sm border-t border-slate-800 pt-2">
                  <span>ચુકવવાપાત્ર નેટ (Net):</span>
                  <span className="font-mono">₹{viewingParty.net.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>જમા રકમ (Jama Paid):</span>
                  <span className="font-mono">₹{viewingParty.totalJama.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-black text-sm border-t border-slate-800 pt-2">
                  <span>બાકી નેટ રકમ (Balance):</span>
                  <span className="font-mono">₹{viewingParty.netRemaining.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingParty(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                બંધ કરો (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK EDIT PAYMENT FOR A SINGLE BOOKING                            */}
      {/* ========================================================================= */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">પેમેન્ટ સ્થિતિ એડિટ</span>
                <h3 className="text-base font-black text-slate-900">{editingBooking.customerName}</h3>
                <div className="text-[11px] text-slate-500 font-mono">{editingBooking.bookingNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">સ્થિતિ (Payment Status)</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                >
                  <option value="PAID">🟢 પૂર્ણ ચુકવણી (PAID)</option>
                  <option value="PARTIAL">🟡 આંશિક ચુકવણી (PARTIAL)</option>
                  <option value="PENDING">🔴 ચુકવણી બાકી (PENDING)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ચુકવણી પદ્ધતિ (Method)</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
                >
                  <option value="CASH_AT_OFFICE">રોકડ (Cash at Office)</option>
                  <option value="UPI_BANK_TRANSFER">UPI / બેંક ટ્રાન્સફર</option>
                  <option value="CHEQUE">ચેક (Cheque)</option>
                  <option value="ONLINE">ઓનલાઈન પોર્ટલ</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ચેક / રેફરન્સ નંબર</label>
                <input
                  type="text"
                  value={editRefNo}
                  onChange={(e) => setEditRefNo(e.target.value)}
                  placeholder="Reference number"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                />
              </div>

              {saveErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {saveErrorMsg}
                </div>
              )}
              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {saveSuccessMsg}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 text-xs"
              >
                રદ કરો
              </button>
              <button
                type="button"
                onClick={handleSavePayment}
                disabled={savingPayment}
                className="px-5 py-2 rounded-xl font-black text-white bg-slate-900 hover:bg-slate-800 text-xs disabled:opacity-50"
              >
                {savingPayment ? "સાચવી રહ્યું છે..." : "સાચવો"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
