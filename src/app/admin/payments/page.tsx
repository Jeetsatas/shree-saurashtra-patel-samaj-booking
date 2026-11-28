"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
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
  BarChart3,
  Undo2,
  RotateCcw,
  History,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchAdminJson, getAdminCachedData } from "@/lib/admin-client-cache";
import {
  isFullDaySlot,
  formatSlotLabel,
  groupBookingsByParty,
  PartyBookingGroup,
  JamaEntry,
  parseJamaEntries,
  setJamaEntriesInNotes,
  DepositStatus,
  DepositLedgerEntry,
  DepositRecord,
  parseDepositRecord,
  setDepositRecordInNotes,
  updateBookingNotesWithTags,
  getDepositStatusInfo,
  calculateEventDeposit,
  getCleanPartyName,
  getPartyIndexLetter,
} from "@/lib/slotUtils";

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
      isPartial: false,
    };
  }
  if (s === "PARTIAL") {
    return {
      label: "🟡 આંશિક ચુકવણી (Partial)",
      shortLabel: "આંશિક જમા",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#f59e0b",
      isPaid: false,
      isPartial: true,
    };
  }
  return {
    label: "🔴 ચુકવણી બાકી (Pending)",
    shortLabel: "ચુકવણી બાકી",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
    dotColor: "#f43f5e",
    isPaid: false,
    isPartial: false,
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

function AdminPaymentStatusContent() {
  const searchParams = useSearchParams();
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
  const [selectedPartyKey, setSelectedPartyKey] = useState<string | null>(null);
  const [alphabetFilter, setAlphabetFilter] = useState<string>("ALL");

  // Sync search query if passed from Audit & Analytics page (?party=...)
  useEffect(() => {
    const partyParam = searchParams.get("party");
    if (partyParam) {
      setPartySearchQuery(partyParam);
    }
  }, [searchParams]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");

  // MANUAL AUDIT MODAL STATE
  const [auditTarget, setAuditTarget] = useState<{
    booking?: any;
    party?: PartyBookingGroup;
    isPartyAudit: boolean;
  } | null>(null);
  const [manualAuditStatus, setManualAuditStatus] = useState<string>("PAID");
  const [manualAuditMethod, setManualAuditMethod] = useState<string>("CASH_AT_OFFICE");
  const [manualAuditRefNo, setManualAuditRefNo] = useState<string>("");
  const [manualAuditNotes, setManualAuditNotes] = useState<string>("");
  const [applyToAllPartyBookings, setApplyToAllPartyBookings] = useState<boolean>(true);
  const [savingAudit, setSavingAudit] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string>("");
  const [auditErrorMsg, setAuditErrorMsg] = useState<string>("");

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

  // DEPOSIT MODAL (Refund / Forfeit to Income / Reverse Entry)
  const [selectedPartyForDeposit, setSelectedPartyForDeposit] = useState<PartyBookingGroup | null>(null);
  const [depositActionMode, setDepositActionMode] = useState<"REFUND" | "FORFEIT_TO_INCOME" | "REVERSE_TO_REFUND" | "RESET_HELD">("REFUND");
  const [depositAmountInput, setDepositAmountInput] = useState<string>("");
  const [depositDateInput, setDepositDateInput] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [depositPaymentMode, setDepositPaymentMode] = useState<string>("CASH_AT_OFFICE");
  const [depositRefNoInput, setDepositRefNoInput] = useState<string>("");
  const [depositNotesInput, setDepositNotesInput] = useState<string>("");
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositSuccess, setDepositSuccess] = useState("");

  // View Party Details Modal
  const [viewingParty, setViewingParty] = useState<PartyBookingGroup | null>(null);

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

  // Group all bookings into Parties
  const partyGroups: PartyBookingGroup[] = useMemo(() => {
    return groupBookingsByParty(bookings);
  }, [bookings]);

  // Fast mapping from booking ID -> PartyBookingGroup
  const bookingPartyMap = useMemo(() => {
    const map = new Map<string, PartyBookingGroup>();
    for (const g of partyGroups) {
      for (const b of g.bookings) {
        map.set(b.id, g);
      }
    }
    return map;
  }, [partyGroups]);

  // Automated Effective Payment Status Evaluator (respects manual audit + calculates Jama automation)
  const getBookingEffectivePaymentInfo = (b: any) => {
    if (!b) return { status: "PENDING", isPaid: false, isPartial: false, party: null };
    const party = bookingPartyMap.get(b.id);
    const manualStatus = (b.paymentStatus || "").toUpperCase().trim();

    // 1. If Manual Audit marked it PAID, strictly honor manual audit:
    const isManualPaid =
      manualStatus === "PAID" ||
      manualStatus === "PAID_FULL" ||
      manualStatus === "PAID_CASH" ||
      manualStatus === "PAID_ONLINE" ||
      manualStatus === "COMPLETED";

    if (isManualPaid) {
      return { status: "PAID", isPaid: true, isPartial: false, party };
    }

    // 2. Automated evaluation based on Party Jama Ledger:
    if (party) {
      // If Net is 1 Lakh and Jama is 1 Lakh (netRemaining <= 0) -> AUTOMATICALLY PAID!
      if (party.netRemaining <= 0 && party.net > 0) {
        return { status: "PAID", isPaid: true, isPartial: false, party };
      }
      // If Net is 1 Lakh and Jama is 50k (totalJama > 0) -> AUTOMATICALLY PARTIALLY PAID!
      if (party.totalJama > 0 && party.netRemaining > 0) {
        return { status: "PARTIAL", isPaid: false, isPartial: true, party };
      }
    }

    if (manualStatus === "PARTIAL") {
      return { status: "PARTIAL", isPaid: false, isPartial: true, party };
    }

    return { status: "PENDING", isPaid: false, isPartial: false, party };
  };

  // Filtered party groups for the Party Ledger tab
  const filteredPartyGroups = useMemo(() => {
    return partyGroups.filter((g) => {
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

      if (partyStatusFilter !== "ALL") {
        if (g.paymentStatus !== partyStatusFilter) return false;
      }

      return true;
    });
  }, [partyGroups, partySearchQuery, partyStatusFilter]);

  // Extract all unique alphabet letters available in filteredPartyGroups for phone diary index
  const availableAlphabetIndex = useMemo(() => {
    const letterMap = new Map<string, { letter: string; english: string; count: number; displayLabel: string }>();
    for (const p of filteredPartyGroups) {
      const info = getPartyIndexLetter(p.customerName);
      const key = info.primaryKey;
      if (!letterMap.has(key)) {
        letterMap.set(key, {
          letter: info.gujarati,
          english: info.english,
          count: 1,
          displayLabel: info.displayLabel,
        });
      } else {
        letterMap.get(key)!.count += 1;
      }
    }
    return Array.from(letterMap.values()).sort((a, b) => a.letter.localeCompare(b.letter, "gu"));
  }, [filteredPartyGroups]);

  // Parties filtered by Alphabet (Phone Diary Index)
  const alphabetFilteredPartyGroups = useMemo(() => {
    if (alphabetFilter === "ALL") return filteredPartyGroups;
    return filteredPartyGroups.filter((p) => {
      const info = getPartyIndexLetter(p.customerName);
      return info.primaryKey === alphabetFilter || info.english === alphabetFilter;
    });
  }, [filteredPartyGroups, alphabetFilter]);

  // Active party selection for 2-Panel Master-Detail view in Party Ledger
  const activeParty = useMemo(() => {
    if (!alphabetFilteredPartyGroups || alphabetFilteredPartyGroups.length === 0) return null;
    const found = alphabetFilteredPartyGroups.find((p) => p.partyKey === selectedPartyKey);
    return found || alphabetFilteredPartyGroups[0];
  }, [alphabetFilteredPartyGroups, selectedPartyKey]);

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

  const handleRemoveJamaEntry = (entryId: string) => {
    setPartyJamaLedger((prev) => prev.filter((e) => e.id !== entryId));
  };

  // Save Jama entries with automated calendar & status sync
  const handleSavePartyJama = async () => {
    if (!selectedPartyForJama) return;

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
          paymentStatus: derivedStatus,
          isFullPaid,
          updateAllRelated: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save jama entries");
      }

      setJamaSuccess("જમા રકમ સાચવવામાં આવી છે અને કેલેન્ડર સ્થિતિ આપોઆપ અપડેટ થઈ ગઈ!");
      setTimeout(() => {
        setSelectedPartyForJama(null);
        refreshBookings();
      }, 900);
    } catch (err: any) {
      console.error("Save Jama error:", err);
      setJamaError(err.message || "Failed to save jama entries");
    } finally {
      setSavingJama(false);
    }
  };

  // Open Deposit Management & Refund Modal
  const handleOpenDepositModal = (party: PartyBookingGroup) => {
    setSelectedPartyForDeposit(party);
    const currentStatus = party.depositStatus || "HELD";

    // Smart initial action selection based on current status:
    // If already in FORFEITED_TO_INCOME, default to REVERSE_TO_REFUND (Party came later to claim)
    // If already REFUNDED or REVERSED_REFUND, allow RESET_HELD
    // Otherwise default to REFUND
    if (currentStatus === "FORFEITED_TO_INCOME") {
      setDepositActionMode("REVERSE_TO_REFUND");
    } else if (currentStatus === "REFUNDED" || currentStatus === "REVERSED_REFUND") {
      setDepositActionMode("RESET_HELD");
    } else {
      setDepositActionMode("REFUND");
    }

    setDepositAmountInput(String(party.deposit || 25000));
    const today = new Date();
    setDepositDateInput(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    );
    setDepositPaymentMode("CASH_AT_OFFICE");
    setDepositRefNoInput("");
    setDepositNotesInput("");
    setDepositError("");
    setDepositSuccess("");
  };

  // Save Deposit Action (Refund / Forfeit to Income / Reverse Entry)
  const handleSaveDepositAction = async () => {
    if (!selectedPartyForDeposit) return;
    setSavingDeposit(true);
    setDepositError("");
    setDepositSuccess("");

    try {
      const amt = Number(depositAmountInput) || selectedPartyForDeposit.deposit;
      const nowIso = new Date().toISOString();
      const dateStr = depositDateInput || nowIso.slice(0, 10);

      let targetStatus: DepositStatus = "HELD";
      let entryType: DepositLedgerEntry["type"] = "COLLECTED";
      let incomeRecognized = 0;
      let refundedAmount = 0;

      if (depositActionMode === "REFUND") {
        targetStatus = "REFUNDED";
        entryType = "REFUND";
        refundedAmount = amt;
        incomeRecognized = 0; // NOT recognized in income
      } else if (depositActionMode === "FORFEIT_TO_INCOME") {
        targetStatus = "FORFEITED_TO_INCOME";
        entryType = "ADD_TO_INCOME";
        incomeRecognized = amt; // ADDED TO TRUST INCOME
        refundedAmount = 0;
      } else if (depositActionMode === "REVERSE_TO_REFUND") {
        targetStatus = "REVERSED_REFUND";
        entryType = "REVERSE_TO_REFUND";
        refundedAmount = amt;
        incomeRecognized = 0; // REMOVED FROM INCOME (Reverse entry)
      } else if (depositActionMode === "RESET_HELD") {
        targetStatus = "HELD";
        entryType = "RESET";
        refundedAmount = 0;
        incomeRecognized = 0;
      }

      const defaultNotes =
        depositActionMode === "REFUND"
          ? `કાર્યક્રમ પૂર્ણ થયા બાદ પાર્ટીને ₹${amt.toLocaleString("en-IN")} ડિપોઝિટ પરત આપેલ.`
          : depositActionMode === "FORFEIT_TO_INCOME"
          ? `પાર્ટીનો કોઈ સંપર્ક કે દાવો ન હોવાથી ₹${amt.toLocaleString("en-IN")} ડિપોઝિટ ટ્રસ્ટ આવકમાં જમા કરેલ.`
          : depositActionMode === "REVERSE_TO_REFUND"
          ? `[REVERSE ENTRY] પાર્ટી પાછળથી ડિપોઝિટ લેવા આવતા આવકમાંથી ₹${amt.toLocaleString("en-IN")} રિવર્સ એન્ટ્રી કરી રિફંડ આપેલ.`
          : `ડિપોઝિટ સ્થિતિ અનામત તરીકે રીસેટ કરેલ.`;

      const newLedgerEntry: DepositLedgerEntry = {
        id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: entryType,
        status: targetStatus,
        amount: amt,
        date: dateStr,
        paymentMode: depositPaymentMode,
        refNo: depositRefNoInput.trim() || undefined,
        notes: depositNotesInput.trim() || defaultNotes,
        performedByName: currentUser?.name || "Admin",
        createdAt: nowIso,
      };

      const existingHistory = selectedPartyForDeposit.depositRecord?.history || [];
      const updatedHistory = [newLedgerEntry, ...existingHistory];

      const updatedRecord: DepositRecord = {
        status: targetStatus,
        originalDeposit: selectedPartyForDeposit.deposit,
        refundedAmount,
        incomeRecognized,
        lastUpdatedDate: dateStr,
        lastActionNote: newLedgerEntry.notes,
        history: updatedHistory,
      };

      // Optimistic local state update
      const partyIdSet = new Set(selectedPartyForDeposit.bookingIds);
      setBookings((prev) =>
        prev.map((b) => {
          if (partyIdSet.has(b.id)) {
            return {
              ...b,
              notes: updateBookingNotesWithTags(b.notes, { depositRecord: updatedRecord }),
            };
          }
          return b;
        })
      );

      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedPartyForDeposit.bookingIds,
          depositRecord: updatedRecord,
          updateAllRelated: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update deposit record");
      }

      setDepositSuccess(
        depositActionMode === "REFUND"
          ? "ડિપોઝિટ પાર્ટીને સફળતાપૂર્વક રિફંડ કરવામાં આવી છે!"
          : depositActionMode === "FORFEIT_TO_INCOME"
          ? "ડિપોઝિટ સફળતાપૂર્વક ટ્રસ્ટ આવકમાં જમા કરવામાં આવી છે!"
          : depositActionMode === "REVERSE_TO_REFUND"
          ? "આવકમાંથી રિવર્સ એન્ટ્રી કરીને પાર્ટીને રિફંડ સફળતાપૂર્વક અપડેટ થયું!"
          : "ડિપોઝિટ સ્થિતિ અનામત તરીકે રીસેટ થઈ ગઈ છે!"
      );

      setTimeout(() => {
        setSelectedPartyForDeposit(null);
        refreshBookings();
      }, 900);
    } catch (err: any) {
      console.error("Save deposit error:", err);
      setDepositError(err.message || "Failed to update deposit record");
    } finally {
      setSavingDeposit(false);
    }
  };

  // Open Manual Audit Modal
  const handleOpenManualAuditModal = (target: { booking?: any; party?: PartyBookingGroup }) => {
    const isParty = !target.booking && !!target.party;
    const party = target.party || (target.booking ? bookingPartyMap.get(target.booking.id) : undefined);
    const b = target.booking;

    setAuditTarget({
      booking: b,
      party,
      isPartyAudit: isParty,
    });

    const currentStatus = b ? b.paymentStatus : party ? party.paymentStatus : "PENDING";
    setManualAuditStatus(currentStatus || "PAID");
    setManualAuditMethod(b?.paymentMethod || party?.bookings[0]?.paymentMethod || "CASH_AT_OFFICE");
    setManualAuditRefNo(b?.paymentRefNo || party?.bookings[0]?.paymentRefNo || "");
    setManualAuditNotes(b?.notes ? b.notes.replace(/<!--JAMA_ENTRIES:[\s\S]*?-->/g, "").trim() : "");
    setApplyToAllPartyBookings(true);
    setAuditSuccessMsg("");
    setAuditErrorMsg("");
  };

  // Save Manual Audit with instant optimistic update
  const handleSaveManualAudit = async () => {
    if (!auditTarget) return;
    setSavingAudit(true);
    setAuditErrorMsg("");
    setAuditSuccessMsg("");

    let targetIds: string[] = [];
    if (applyToAllPartyBookings && auditTarget.party) {
      targetIds = auditTarget.party.bookingIds;
    } else if (auditTarget.booking) {
      targetIds = [auditTarget.booking.id];
    } else if (auditTarget.party) {
      targetIds = auditTarget.party.bookingIds;
    }

    if (targetIds.length === 0) {
      setAuditErrorMsg("કોઈ બુકિંગ પસંદ થયેલ નથી.");
      setSavingAudit(false);
      return;
    }

    const idSet = new Set(targetIds);

    // Optimistic local update
    setBookings((prev) =>
      prev.map((item) =>
        idSet.has(item.id)
          ? {
              ...item,
              paymentStatus: manualAuditStatus,
              paymentMethod: manualAuditMethod,
              paymentRefNo: manualAuditRefNo,
              notes: manualAuditNotes
                ? (item.notes?.includes("<!--JAMA_ENTRIES:")
                    ? `${manualAuditNotes}\n${item.notes.match(/<!--JAMA_ENTRIES:[\s\S]*?-->/)?.[0] || ""}`
                    : manualAuditNotes)
                : item.notes,
            }
          : item
      )
    );

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: targetIds,
          paymentStatus: manualAuditStatus,
          paymentMethod: manualAuditMethod,
          paymentRefNo: manualAuditRefNo,
          notes: manualAuditNotes,
          updateAllRelated: applyToAllPartyBookings,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update payment audit");
      }

      setAuditSuccessMsg("મેન્યુઅલ ઓડિટ સફળતાપૂર્વક સાચવવામાં આવ્યું!");
      setTimeout(() => {
        setAuditTarget(null);
        refreshBookings();
      }, 700);
    } catch (err: any) {
      console.error("Save manual audit error:", err);
      setAuditErrorMsg(err.message || "Failed to update payment audit");
    } finally {
      setSavingAudit(false);
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

  // AUTOMATED CALENDAR EVALUATION:
  // Green (FULL_PAID): All bookings on this day are fully paid (via full Jama OR manual audit)
  // Yellow (PENDING/PARTIAL): At least 1 booking has pending balance or partial payment
  // Blank: No bookings
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
        partialCount: 0,
      };
    }

    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let partialCount = 0;

    for (const b of dayBookings) {
      const bTotal = Number(b.totalAmount || b.facilityAmount || 0);
      totalAmount += bTotal;
      const info = getBookingEffectivePaymentInfo(b);

      if (info.isPaid) {
        paidAmount += bTotal;
      } else if (info.isPartial && info.party) {
        partialCount += 1;
        pendingCount += 1;
        // Allocate proportionate Jama payment
        const partyTotal = Math.max(1, info.party.net);
        const partyJama = info.party.totalJama;
        const bShare = Math.min(bTotal, Math.round((bTotal / partyTotal) * partyJama));
        paidAmount += bShare;
        pendingAmount += Math.max(0, bTotal - bShare);
      } else {
        pendingCount += 1;
        pendingAmount += bTotal;
      }
    }

    // AUTOMATION: If pendingCount is 0, this day AUTOMATICALLY becomes FULL_PAID (Green)!
    if (pendingCount === 0) {
      return {
        type: "FULL_PAID" as const,
        bookings: dayBookings,
        totalAmount,
        paidAmount: totalAmount,
        pendingAmount: 0,
        pendingCount: 0,
        partialCount: 0,
      };
    }

    return {
      type: "PENDING" as const,
      bookings: dayBookings,
      totalAmount,
      paidAmount,
      pendingAmount,
      pendingCount,
      partialCount,
    };
  };

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  // All Pending Bookings across the entire system
  const allPendingBookings = bookings
    .filter((b) => {
      if (b.status === "CANCELLED") return false;
      const info = getBookingEffectivePaymentInfo(b);
      return !info.isPaid;
    })
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

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Top Banner & Header - Polished for zero overlapping on all screen sizes */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-700 flex items-center justify-center text-white shadow-sm shadow-amber-600/30 shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                    પેમેન્ટ સ્થિતિ અને જમા ખાતાવહી
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                    Accounts & Jama Ledger
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  પાર્ટી વાઇઝ બુકિંગ ખાતું, ડિપોઝિટ, ઓટો-જમા સ્થિતિ અને કેલેન્ડર
                </p>
              </div>
            </div>

            {/* View Switcher Tabs (iOS Segmented Style) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("PARTY_LEDGER")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                href="/admin/reports"
                className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                title="વાર્ષિક ઓડિટ, CA રજિસ્ટર અને એનાલિટિક્સ રિપોર્ટ જુઓ"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-700" />
                <span>વાર્ષિક ઓડિટ & એનાલિટિક્સ</span>
              </Link>
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

            {/* Master-Detail Split View (2-Panel Layout: 35% Left List & 65% Sticky Right Detail) */}
            {filteredPartyGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-base font-bold text-slate-800">કોઈ પાર્ટી મળી નથી</div>
                <p className="text-xs text-slate-500 mt-1">
                  શોધ શરતો બદલીને અથવા નવા ફિલ્ટર સાથે તપાસ કરો.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                {/* ============================================================== */}
                {/* LEFT PANEL (35%-40% width / lg:col-span-5): Compact Party List */}
                {/* ============================================================== */}
                <div className="lg:col-span-5 flex flex-col gap-2.5">
                  {/* 📇 Phone Diary Alphabet Slider / Quick Scroller */}
                  {availableAlphabetIndex.length > 0 && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between px-0.5 text-[11px] font-bold text-slate-600">
                        <span className="flex items-center gap-1.5 text-slate-800">
                          <span className="text-sm">📇</span>
                          <span className="font-extrabold">ફોન ડાયરી મૂળાક્ષર (Phone Diary A-Z):</span>
                        </span>
                        {alphabetFilter !== "ALL" && (
                          <button
                            type="button"
                            onClick={() => setAlphabetFilter("ALL")}
                            className="text-[10px] text-amber-800 hover:text-amber-950 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <span>બધા જુઓ (Clear)</span>
                            <span>✕</span>
                          </button>
                        )}
                      </div>

                      {/* Scrollable Alphabet Ribbon */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scroll-smooth">
                        <button
                          type="button"
                          onClick={() => setAlphabetFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer shrink-0 ${
                            alphabetFilter === "ALL"
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          બધા ({filteredPartyGroups.length})
                        </button>

                        {availableAlphabetIndex.map((item) => {
                          const isSelected = alphabetFilter === item.letter || alphabetFilter === item.english;
                          return (
                            <button
                              key={`alph-pay-${item.letter}`}
                              type="button"
                              onClick={() => {
                                const newFilter = isSelected ? "ALL" : item.letter;
                                setAlphabetFilter(newFilter);
                                const match = filteredPartyGroups.find((p) => {
                                  const info = getPartyIndexLetter(p.customerName);
                                  return info.primaryKey === item.letter || info.english === item.english;
                                });
                                if (match) {
                                  setSelectedPartyKey(match.partyKey);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                                isSelected
                                  ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm ring-2 ring-amber-400 font-black scale-105"
                                  : "bg-slate-50 hover:bg-amber-50 hover:text-amber-900 text-slate-700 border border-slate-200/80"
                              }`}
                              title={`અક્ષર '${item.letter}' વાળી પાર્ટીઓ જુઓ`}
                            >
                              <span className="font-bold">{item.letter}</span>
                              <span className="text-[10px] opacity-80 font-mono">({item.english})</span>
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded-full font-mono ml-0.5 ${
                                  isSelected ? "bg-amber-900/60 text-white" : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {item.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-bold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Building className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        પાર્ટીઓ ({alphabetFilteredPartyGroups.length}
                        {alphabetFilter !== "ALL" ? ` / કુલ ${filteredPartyGroups.length}` : ""})
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {alphabetFilter !== "ALL" ? `અક્ષર '${alphabetFilter}' ફિલ્ટર કરેલ` : "ક્લિક કરીને ખાતાવહી જુઓ"}
                    </span>
                  </div>

                  {/* Scrollable compact list */}
                  <div className="space-y-2 lg:max-h-[calc(100vh-210px)] lg:overflow-y-auto pr-1 scrollbar-thin">
                    {alphabetFilteredPartyGroups.map((party) => {
                      const isSelectedParty = activeParty?.partyKey === party.partyKey;
                      const badge = getPaymentBadge(party.paymentStatus);

                      return (
                        <div
                          key={party.partyKey}
                          onClick={() => setSelectedPartyKey(party.partyKey)}
                          className={`group relative p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                            isSelectedParty
                              ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-md translate-x-0.5"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
                          }`}
                        >
                          {/* Active marker accent bar */}
                          {isSelectedParty && (
                            <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-amber-600 rounded-r-full" />
                          )}

                          {/* Card Header: Customer Name & Payment Badge */}
                          <div className="flex items-start justify-between gap-2 pl-1">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4
                                  className={`text-sm font-bold truncate leading-tight ${
                                    isSelectedParty ? "text-amber-950 font-black" : "text-slate-800"
                                  }`}
                                >
                                  {party.customerName}
                                </h4>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 font-mono border border-amber-200/80 shrink-0">
                                  📇 {getPartyIndexLetter(party.customerName).gujarati}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-mono">
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{party.customerPhone}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.badgeClass}`}
                              >
                                {badge.shortLabel}
                              </span>
                              {party.eventType && (
                                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/80">
                                  {party.eventType}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Middle row: Dates & Facilities count */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 pl-1">
                            <div className="flex items-center gap-1 truncate">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{party.dateRange.label}</span>
                            </div>
                            <span className="shrink-0 font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px]">
                              {party.bookings.length} સુવિધાઓ
                            </span>
                          </div>

                          {/* Bottom Row: Net Billed & Net Remaining Balance */}
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between pl-1">
                            <div className="text-[10px] text-slate-600 font-bold">
                              નેટ: ₹{party.net.toLocaleString("en-IN")}
                            </div>
                            <div className="text-right">
                              {party.netRemaining === 0 ? (
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  ✓ પૂર્ણ ચુકતે
                                </span>
                              ) : party.totalJama > 0 ? (
                                <span className="text-[10px] font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  બાકી: ₹{party.netRemaining.toLocaleString("en-IN")}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  બાકી: ₹{party.netRemaining.toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ============================================================== */}
                {/* RIGHT PANEL (65%-60% width / lg:col-span-7): Sticky Party Dossier & Ledger */}
                {/* ============================================================== */}
                <div className="lg:col-span-7 lg:sticky lg:top-4">
                  {activeParty ? (
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto scrollbar-thin">
                      {/* 1. Header: Customer Name, Status, Phone, Event & Quick Actions */}
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                              {activeParty.customerName}
                            </span>
                            {(() => {
                              const badge = getPaymentBadge(activeParty.paymentStatus);
                              return (
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.badgeClass}`}
                                >
                                  {badge.shortLabel}
                                </span>
                              );
                            })()}
                            {activeParty.eventType && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {activeParty.eventType}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            {activeParty.customerPhone && (
                              <a
                                href={`tel:${activeParty.customerPhone}`}
                                className="flex items-center gap-1 text-blue-700 hover:underline font-mono font-bold"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>{activeParty.customerPhone}</span>
                              </a>
                            )}
                            {activeParty.customerAddress && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-xs">{activeParty.customerAddress}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                              <Calendar className="w-3 h-3 text-amber-700" />
                              <span>{activeParty.dateRange.label}</span>
                            </span>
                          </div>
                        </div>

                        {/* Top Action Buttons (Edit, Add Jama, Audit, Receipt) */}
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                          <Link
                            href={`/admin/bookings?edit=${activeParty.bookings[0]?.id}`}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                            title="આ પાર્ટી અને સુવિધાઓની વિગતો સુધારો (Edit Party & Facilities)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                            <span>સુધારો</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenJamaModal(activeParty)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-sm shadow-amber-600/30 transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ જમા કરો</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDepositModal(activeParty)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                            title="ડિપોઝિટ રિફંડ / આવકમાં જમા / રિવર્સ એન્ટ્રી વ્યવસ્થાપન"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                            <span>ડિપોઝિટ એક્શન</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenManualAuditModal({ party: activeParty })}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <Shield className="w-3.5 h-3.5 text-slate-600" />
                            <span>ઓડિટ</span>
                          </button>

                          <Link
                            href={`/admin/reports?party=${encodeURIComponent(activeParty.customerPhone || activeParty.customerName)}`}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="આ પાર્ટીનો સત્તાવાર ઓડિટ રેકોર્ડ જુઓ"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-blue-700" />
                            <span>ઓડિટ રજિસ્ટર</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setViewingParty(activeParty)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>રસીદ</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Booked Facilities Section */}
                      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                          બુક કરેલ સુવિધાઓ ({activeParty.bookings.length}):
                        </span>
                        {activeParty.bookings.map((b) => (
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
                            <Link
                              href={`/admin/bookings?edit=${b.id}`}
                              className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-0.5 transition"
                              title="આ સુવિધા, તારીખ અથવા રકમ સુધારો"
                            >
                              <Edit3 className="w-2.5 h-2.5 text-amber-700" />
                              <span>Edit</span>
                            </Link>
                          </span>
                        ))}
                      </div>

                      {/* 3. 4-METRIC FINANCIAL STRIP */}
                      <div className="p-4 sm:px-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                          {/* 1. Total Rent */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              ૧. કુલ રકમ (Total)
                            </span>
                            <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                              ₹{activeParty.total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-slate-400 block">સુવિધા ભાડું</span>
                          </div>

                          {/* 2. Total with Discount */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              ૨. ડિસ્કાઉન્ટ બાદ રકમ
                            </span>
                            <span className="text-base sm:text-lg font-black text-blue-900 tabular-nums">
                              ₹{activeParty.totalWithDiscount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-blue-600 block">
                              {activeParty.discountAmount > 0
                                ? `-₹${activeParty.discountAmount.toLocaleString("en-IN")} ડિસ્કાઉન્ટ`
                                : "૦% ડિસ્કાઉન્ટ"}
                            </span>
                          </div>

                          {/* 3. Caution Deposit */}
                          {(() => {
                            const depInfo = getDepositStatusInfo(activeParty.depositStatus);
                            return (
                              <div className="flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    ૩. ડિપોઝિટ (Deposit)
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${depInfo.badgeClass}`}
                                  >
                                    {depInfo.shortLabel}
                                  </span>
                                </div>
                                <div className="flex items-baseline justify-between mt-1">
                                  <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                                    ₹{activeParty.deposit.toLocaleString("en-IN")}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDepositModal(activeParty)}
                                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <span>રિફંડ</span>
                                    <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <span className="text-[10px] text-slate-500 block truncate" title={depInfo.description}>
                                  {activeParty.depositStatus === "FORFEITED_TO_INCOME"
                                    ? "💰 આવકમાં જમા લીધેલ"
                                    : activeParty.depositStatus === "REVERSED_REFUND"
                                    ? "🔄 રિવર્સ રિફંડ આપેલ"
                                    : activeParty.depositStatus === "REFUNDED"
                                    ? "↩️ પાર્ટીને પરત કરેલ"
                                    : "🛡️ અનામત ચાલુ"}
                                </span>
                              </div>
                            );
                          })()}

                          {/* 4. Net (After Deposit) */}
                          <div className="bg-amber-100/60 p-2 rounded-lg border border-amber-200/80">
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                              ૪. ચુકવવાપાત્ર નેટ (Net)
                            </span>
                            <span className="text-base sm:text-lg font-black text-amber-950 tabular-nums">
                              ₹{activeParty.net.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-amber-800 font-bold block">
                              ભાડું + ડિપોઝિટ
                            </span>
                          </div>
                        </div>

                        {/* 4. Jama Entries Ledger Banner & Net Remaining Adjustment */}
                        <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-white border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>અત્યાર સુધી જમા રકમ:</span>
                              </span>
                              <span className="text-sm font-black text-emerald-800 tabular-nums">
                                ₹{activeParty.totalJama.toLocaleString("en-IN")}
                              </span>
                            </div>

                            {/* Show previous Jama entries summary */}
                            {activeParty.jamaEntries.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                {activeParty.jamaEntries.map((ent) => (
                                  <span
                                    key={ent.id}
                                    className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-950 font-medium"
                                  >
                                    📅 {ent.date}: ₹{ent.amount.toLocaleString("en-IN")} ({formatPaymentMode(ent.method)})
                                  </span>
                                ))}
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
                                  activeParty.netRemaining === 0 ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                ₹{activeParty.netRemaining.toLocaleString("en-IN")}
                              </span>
                              {activeParty.netRemaining === 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  ✓ પૂર્ણ ચુકતે
                                </span>
                              ) : activeParty.totalJama > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                  આંશિક જમા
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                  બાકી
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ₹{activeParty.net.toLocaleString("en-IN")} - ₹{activeParty.totalJama.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                      ડાબી બાજુની યાદીમાંથી કોઈપણ એક પાર્ટી પસંદ કરો (Select a party).
                    </div>
                  )}
                </div>
              </div>
            )}

</div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 📅 CALENDAR VIEW (AUTOMATED GREEN / YELLOW WITH JAMA LEDGER)       */}
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

              {/* Calendar Grid - Automatically Green if Full Paid, Yellow if Partial/Pending */}
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
                      className={`min-h-[78px] p-1.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? "ring-2 ring-blue-600 border-blue-500 shadow-xs"
                          : "border-slate-200 hover:border-slate-300"
                      } ${
                        dayEval.type === "FULL_PAID"
                          ? "bg-emerald-50/70 border-emerald-300"
                          : dayEval.type === "PENDING"
                          ? dayEval.partialCount > 0
                            ? "bg-amber-50/80 border-amber-300"
                            : "bg-rose-50/40 border-rose-200"
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
                            className="w-2.5 h-2.5 rounded-full"
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
                          {dayEval.type === "FULL_PAID" ? (
                            <span className="text-[9px] font-bold text-emerald-800 block">
                              ✓ પૂર્ણ ચુકતે
                            </span>
                          ) : dayEval.paidAmount > 0 ? (
                            <span className="text-[9px] font-bold text-amber-800 block truncate">
                              જમા: ₹{dayEval.paidAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-700 block">
                              બાકી
                            </span>
                          )}
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
                  <span className="font-bold text-emerald-900">🟢 પૂર્ણ ચુકવણી (Full Paid by Jama/Audit)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-bold text-amber-900">🟡 આંશિક જમા / બાકી (Partial/Pending)</span>
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
                    const info = getBookingEffectivePaymentInfo(b);
                    const badge = getPaymentBadge(info.status);
                    const matchingParty = info.party;

                    return (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs"
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

                        {/* Party financial context preview */}
                        {matchingParty && (
                          <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-[10px] space-y-0.5 font-mono">
                            <div className="flex justify-between text-slate-600">
                              <span>પાર્ટી નેટ:</span>
                              <span className="font-bold">₹{matchingParty.net.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="flex justify-between text-emerald-700">
                              <span>કુલ જમા:</span>
                              <span className="font-bold">₹{matchingParty.totalJama.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="flex justify-between text-rose-700 font-bold">
                              <span>બાકી રકમ:</span>
                              <span>₹{matchingParty.netRemaining.toLocaleString("en-IN")}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                          <span className="font-bold text-slate-700">
                            ભાડું: ₹{Number(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {matchingParty && (
                              <button
                                type="button"
                                onClick={() => handleOpenJamaModal(matchingParty)}
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition"
                              >
                                + જમા
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenManualAuditModal({ booking: b, party: matchingParty || undefined })}
                              className="text-[10px] font-bold px-2 py-1 rounded-md bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 transition"
                            >
                              ઓડિટ
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
                        <th className="py-3 px-4">કુલ ભાડું</th>
                        <th className="py-3 px-4">સ્થિતિ</th>
                        <th className="py-3 px-4 text-right">ક્રિયા</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {allPendingBookings.map((b) => {
                        const matchingParty = bookingPartyMap.get(b.id);
                        const info = getBookingEffectivePaymentInfo(b);
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
                              ₹{Number(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  info.isPartial
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-rose-50 text-rose-800 border-rose-200"
                                }`}
                              >
                                {info.isPartial ? "આંશિક જમા" : "બાકી"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
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
                                onClick={() => handleOpenManualAuditModal({ booking: b, party: matchingParty || undefined })}
                                className="px-2.5 py-1 rounded-lg bg-white text-slate-700 font-bold text-[11px] hover:bg-slate-100 border border-slate-300"
                              >
                                ઓડિટ
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
                        min="0"
                        step="any"
                        value={jamaAmountInput}
                        onChange={(e) => setJamaAmountInput(e.target.value)}
                        placeholder="25000"
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

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
      {/* MODAL: 🛡️ PARTY DEPOSIT MANAGEMENT & REFUND / REVERSE ENTRY MODAL       */}
      {/* ========================================================================= */}
      {selectedPartyForDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
                  ડિપોઝિટ વ્યવસ્થાપન • રિફંડ / આવક એક્શન
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{selectedPartyForDeposit.customerName}</span>
                  {(() => {
                    const info = getDepositStatusInfo(selectedPartyForDeposit.depositStatus);
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.badgeClass}`}>
                        {info.shortLabel}
                      </span>
                    );
                  })()}
                </h3>
                <div className="text-xs text-amber-200 flex items-center gap-2 mt-0.5">
                  <span>{selectedPartyForDeposit.customerPhone}</span>
                  <span>•</span>
                  <span>{selectedPartyForDeposit.dateRange.label}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPartyForDeposit(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Deposit Overview Strip */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">
                    કુલ અનામત ડિપોઝિટ
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums">
                    ₹{selectedPartyForDeposit.deposit.toLocaleString("en-IN")}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">
                    હાલની સ્થિતિ
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-950 block mt-0.5">
                    {selectedPartyForDeposit.depositStatus === "FORFEITED_TO_INCOME"
                      ? "💰 આવકમાં જમા કરેલ"
                      : selectedPartyForDeposit.depositStatus === "REVERSED_REFUND"
                      ? "🔄 રિવર્સ રિફંડ આપેલ"
                      : selectedPartyForDeposit.depositStatus === "REFUNDED"
                      ? "↩️ પાર્ટીને પરત કરેલ"
                      : "🛡️ અનામત ચાલુ"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase block">
                    ટ્રસ્ટ આવક અસર
                  </span>
                  <span className={`text-xs sm:text-sm font-black block mt-0.5 ${
                    selectedPartyForDeposit.depositStatus === "FORFEITED_TO_INCOME"
                      ? "text-emerald-700 font-bold"
                      : "text-slate-600"
                  }`}>
                    {selectedPartyForDeposit.depositStatus === "FORFEITED_TO_INCOME"
                      ? `+₹${selectedPartyForDeposit.deposit.toLocaleString("en-IN")} આવકમાં ઉમેરેલ`
                      : "આવકમાંથી બાદ (રિફંડ/અનામત)"}
                  </span>
                </div>
              </div>

              {/* Action Selection Tabs / Cards */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 block">
                  ડિપોઝિટ એક્શન પસંદ કરો (Select Action):
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Action 1: Standard Refund */}
                  <button
                    type="button"
                    onClick={() => setDepositActionMode("REFUND")}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      depositActionMode === "REFUND"
                        ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                        <span>૧. પાર્ટીને રિફંડ આપો</span>
                      </span>
                      {depositActionMode === "REFUND" && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      કાર્યક્રમ પૂર્ણ થયા બાદ ડિપોઝિટ પાર્ટીને પરત આપવી. (આવક ગણાશે નહીં)
                    </p>
                  </button>

                  {/* Action 2: Forfeit / Add to Income */}
                  <button
                    type="button"
                    onClick={() => setDepositActionMode("FORFEIT_TO_INCOME")}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      depositActionMode === "FORFEIT_TO_INCOME"
                        ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        <span>૨. આવકમાં જમા કરો (બિન-દાવો)</span>
                      </span>
                      {depositActionMode === "FORFEIT_TO_INCOME" && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      પાર્ટીનો કોઈ સંપર્ક ન હોય કે દાવો ન કરે તો ડિપોઝિટ ટ્રસ્ટ આવકમાં જમા લેવી.
                    </p>
                  </button>

                  {/* Action 3: Reverse Entry from Income to Refund */}
                  <button
                    type="button"
                    onClick={() => setDepositActionMode("REVERSE_TO_REFUND")}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      depositActionMode === "REVERSE_TO_REFUND"
                        ? "border-purple-500 bg-purple-50/80 ring-2 ring-purple-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                        <Undo2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>૩. આવકમાંથી રિવર્સ એન્ટ્રી & રિફંડ</span>
                      </span>
                      {depositActionMode === "REVERSE_TO_REFUND" && (
                        <Check className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      જો ડિપોઝિટ પહેલા આવકમાં જમા લીધી હોય અને પાછળથી પાર્ટી લેવા આવે, તો આવકમાંથી રિવર્સ એન્ટ્રી કરી રિફંડ આપવું.
                    </p>
                  </button>

                  {/* Action 4: Reset to Held */}
                  <button
                    type="button"
                    onClick={() => setDepositActionMode("RESET_HELD")}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      depositActionMode === "RESET_HELD"
                        ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>૪. અનામત ચાલુ (Reset to Held)</span>
                      </span>
                      {depositActionMode === "RESET_HELD" && (
                        <Check className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      સામાન્ય અનામત ડિપોઝિટ સ્થિતિમાં પરત લાવો (હજુ કોઈ નિર્ણય ન લીધો હોય ત્યારે).
                    </p>
                  </button>
                </div>
              </div>

              {/* Action Form Fields */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/60 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      ડિપોઝિટ રકમ (₹ Amount) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={depositAmountInput}
                        onChange={(e) => setDepositAmountInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      એક્શન તારીખ (Action Date) *
                    </label>
                    <input
                      type="date"
                      value={depositDateInput}
                      onChange={(e) => setDepositDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                {(depositActionMode === "REFUND" || depositActionMode === "REVERSE_TO_REFUND") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        રિફંડ પદ્ધતિ (Refund Mode)
                      </label>
                      <select
                        value={depositPaymentMode}
                        onChange={(e) => setDepositPaymentMode(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="CASH_AT_OFFICE">રોકડ (Cash at Office)</option>
                        <option value="UPI_BANK_TRANSFER">UPI / બેંક ટ્રાન્સફર (NEFT/IMPS)</option>
                        <option value="CHEQUE">ચેક (Cheque)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        ચેક / ટ્રાન્ઝેક્શન રેફરન્સ (Ref No)
                      </label>
                      <input
                        type="text"
                        value={depositRefNoInput}
                        onChange={(e) => setDepositRefNoInput(e.target.value)}
                        placeholder="e.g. UTR12345 / CHQ-9988"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    નોંધ / કારણ (Remarks / Reason) *
                  </label>
                  <input
                    type="text"
                    value={depositNotesInput}
                    onChange={(e) => setDepositNotesInput(e.target.value)}
                    placeholder={
                      depositActionMode === "REFUND"
                        ? "કાર્યક્રમ પૂર્ણ થયા બાદ ડિપોઝિટ પાર્ટીને રોકડ/બેંકથી પરત આપેલ."
                        : depositActionMode === "FORFEIT_TO_INCOME"
                        ? "પાર્ટીનો કોઈ સંપર્ક કે દાવો ન હોવાથી ટ્રસ્ટ આવકમાં જમા."
                        : depositActionMode === "REVERSE_TO_REFUND"
                        ? "પાર્ટી પાછળથી ડિપોઝિટ લેવા આવતા આવકમાંથી રિવર્સ એન્ટ્રી કરીને રિફંડ આપેલ."
                        : "અનામત ચાલુ તરીકે સેટ કરેલ."
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              </div>

              {/* Deposit History Log (Audit Trail) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-700" />
                    <span>ડિપોઝિટ ઇતિહાસ અને ઓડિટ ટ્રેક (Deposit History)</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {selectedPartyForDeposit.depositRecord?.history?.length || 0} એન્ટ્રીઓ
                  </span>
                </div>

                {!selectedPartyForDeposit.depositRecord?.history || selectedPartyForDeposit.depositRecord.history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    હજુ સુધી આ ડિપોઝિટ માટે કોઈ અગાઉની એક્શન નોંધાયેલ નથી (અનામત ચાલુ છે).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedPartyForDeposit.depositRecord.history.map((h, i) => (
                      <div
                        key={h.id || i}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 tabular-nums">
                              ₹{h.amount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono">
                              {h.date}
                            </span>
                            <span className="text-[10px] font-bold text-amber-900">
                              {h.status === "FORFEITED_TO_INCOME"
                                ? "💰 આવકમાં જમા"
                                : h.status === "REVERSED_REFUND"
                                ? "🔄 રિવર્સ રિફંડ"
                                : h.status === "REFUNDED"
                                ? "↩️ રિફંડ"
                                : "🛡️ અનામત"}
                            </span>
                          </div>
                          {h.notes && (
                            <p className="text-[11px] text-slate-600">
                              {h.notes}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400">
                            નોંધણીકર્તા: {h.performedByName || "Admin"}
                            {h.paymentMode ? ` • ${formatPaymentMode(h.paymentMode)}` : ""}
                            {h.refNo ? ` • Ref: ${h.refNo}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error & Success Messages */}
              {depositError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{depositError}</span>
                </div>
              )}
              {depositSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{depositSuccess}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedPartyForDeposit(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                રદ કરો (Cancel)
              </button>

              <button
                type="button"
                onClick={handleSaveDepositAction}
                disabled={savingDeposit}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 shadow-md shadow-amber-900/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-60 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{savingDeposit ? "સાચવી રહ્યું છે..." : "સાચવો અને લાગુ કરો (Save Deposit Action)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: 🛡️ MANUAL PAYMENT AUDIT MODAL (PRESERVES MANUAL OVERRIDE)          */}
      {/* ========================================================================= */}
      {auditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    મેન્યુઅલ પેમેન્ટ ઓડિટ (Manual Audit)
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {auditTarget.party?.customerName || auditTarget.booking?.customerName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Automated Jama Insight Box */}
              {auditTarget.party && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>ઓટોમેટેડ ગણતરી (Auto Calculation):</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-200 text-blue-950">
                      નેટ ₹{auditTarget.party.net.toLocaleString("en-IN")} • જમા ₹{auditTarget.party.totalJama.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 flex items-center justify-between">
                    <span>સિસ્ટમ ઓટો સ્ટેટસ:</span>
                    <span className="font-black">
                      {auditTarget.party.netRemaining <= 0
                        ? "🟢 આપોઆપ પૂર્ણ ચુકતે (AUTO PAID)"
                        : auditTarget.party.totalJama > 0
                        ? "🟡 આપોઆપ આંશિક જમા (AUTO PARTIAL)"
                        : "🔴 આપોઆપ બાકી (AUTO PENDING)"}
                    </span>
                  </div>
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ઓડિટ સ્થિતિ પસંદ કરો (Manual Audit Status) *
                </label>
                <select
                  value={manualAuditStatus}
                  onChange={(e) => setManualAuditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="PAID">🟢 પૂર્ણ ચુકવણી (PAID - Mark Fully Paid)</option>
                  <option value="PARTIAL">🟡 આંશિક ચુકવણી (PARTIAL - Mark Partial)</option>
                  <option value="PENDING">🔴 ચુકવણી બાકી (PENDING - Mark Unpaid)</option>
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ચુકવણી પદ્ધતિ (Method)
                </label>
                <select
                  value={manualAuditMethod}
                  onChange={(e) => setManualAuditMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:bg-white focus:outline-none"
                >
                  <option value="CASH_AT_OFFICE">રોકડ (Cash at Office)</option>
                  <option value="UPI_BANK_TRANSFER">UPI / બેંક ટ્રાન્સફર (NEFT/IMPS)</option>
                  <option value="CHEQUE">ચેક (Cheque)</option>
                  <option value="ONLINE">ઓનલાઈન પોર્ટલ (Online)</option>
                </select>
              </div>

              {/* Reference / Cheque No */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ચેક / રેફરન્સ નંબર (Reference No)
                </label>
                <input
                  type="text"
                  value={manualAuditRefNo}
                  onChange={(e) => setManualAuditRefNo(e.target.value)}
                  placeholder="e.g. Verified Cheque #4455"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:outline-none"
                />
              </div>

              {/* Audit Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ઓડિટ નોંધ / રિમાર્કસ (Audit Remarks)
                </label>
                <input
                  type="text"
                  value={manualAuditNotes}
                  onChange={(e) => setManualAuditNotes(e.target.value)}
                  placeholder="e.g. ટ્રસ્ટીશ્રી દ્વારા વેરિફાઈડ અને મંજૂર"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Checkbox: Apply to all related bookings of this party */}
              {auditTarget.party && auditTarget.party.bookings.length > 1 && (
                <label className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllPartyBookings}
                    onChange={(e) => setApplyToAllPartyBookings(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-800 font-bold text-[11px]">
                    આ પાર્ટીના તમામ {auditTarget.party.bookings.length} સંબંધિત બુકિંગ્સ પર ઓડિટ લાગુ કરો
                  </span>
                </label>
              )}

              {auditErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {auditErrorMsg}
                </div>
              )}
              {auditSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {auditSuccessMsg}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 text-xs transition"
              >
                રદ કરો (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSaveManualAudit}
                disabled={savingAudit}
                className="px-5 py-2.5 rounded-xl font-black text-white bg-slate-900 hover:bg-slate-800 text-xs disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingAudit ? "સાચવી રહ્યું છે..." : "ઓડિટ સાચવો (Save Audit)"}</span>
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
                      className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{b.facility?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} • {formatSlotLabel(b.slot)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          ₹{(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                        </span>
                        <Link
                          href={`/admin/bookings?edit=${b.id}`}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                          title="સુવિધા અને રકમ સુધારો (Edit Facility & Amount)"
                        >
                          <Edit3 className="w-3 h-3 text-amber-700" />
                          <span>સુધારો</span>
                        </Link>
                      </div>
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
    </div>
  );
}

export default function AdminPaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
        </div>
      }
    >
      <AdminPaymentStatusContent />
    </Suspense>
  );
}
