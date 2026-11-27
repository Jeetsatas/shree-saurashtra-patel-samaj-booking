"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchAdminJson, getAdminCachedData, clearAdminClientCache } from "@/lib/admin-client-cache";
import {
  doSlotsOverlap,
  parseSlotTimeRange,
  STANDARD_HOURS,
  TIMING_PRESETS,
  formatSlotLabel,
  doBookingsConflict,
  WHOLE_DAY_SLOT_LABEL,
  WHOLE_DAY_SLOT_GUJARATI,
  isFullDaySlot,
  isGroundFloorHall,
  getBookingGroundHallOption,
  getStandardFacilityRate,
} from "@/lib/slotUtils";
import { InteractiveClockModal } from "@/components/InteractiveClockModal";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Phone,
  Calendar,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  Trash2,
  AlertCircle,
  Percent,
  Sparkles,
  Shield,
  Download,
  Eye,
  Edit3,
  ArrowUpDown,
  Tag,
  User,
  Info,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function BookingsManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-bold text-slate-600">બુકિંગ્સ લોડ થઈ રહ્યા છે...</span>
          </div>
        </div>
      }
    >
      <BookingsManagementContent />
    </Suspense>
  );
}

function BookingsManagementContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(() => {
    return getAdminCachedData<any>("/api/auth/me")?.user || null;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    return !getAdminCachedData<any>("/api/auth/me")?.user;
  });
  const [bookings, setBookings] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [facilityFilter, setFacilityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("NEWEST");

  // Create Booking Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const initialBookingFormData = {
    facilityId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    customerAadhar: "",
    eventType: "Wedding",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    slot: WHOLE_DAY_SLOT_LABEL,
    status: "CONFIRMED",
    facilityAmount: 0,
    discountCode: "NONE",
    discountPercent: 0,
    discountAmount: 0,
    discountOverridden: false,
    discountOverrideReason: "",
    selectedServices: [] as string[],
    servicesAmount: 0,
    totalAmount: 0,
    depositAmount: 0,
    paymentStatus: "PENDING",
    paymentMethod: "CASH_AT_OFFICE",
    paymentRefNo: "",
    notes: "",
  };
  const [formData, setFormData] = useState(initialBookingFormData);
  const [customDeposit, setCustomDeposit] = useState<number | null>(null);

  // Multi-Facility, Multi-Date, Multi-Timing Checkbox States
  const defaultTodayDateStr = new Date().toISOString().split("T")[0];
  const [selectedDates, setSelectedDates] = useState<string[]>([defaultTodayDateStr]);
  const [activeDate, setActiveDate] = useState<string>(defaultTodayDateStr);
  const [dateFacilityMap, setDateFacilityMap] = useState<Record<string, string[]>>({});
  const [dateTimeTimingMap, setDateTimeTimingMap] = useState<Record<string, Record<string, string[]>>>({});
  const [datePlotPurposeMap, setDatePlotPurposeMap] = useState<Record<string, "WEDDING" | "FAMILY">>({});
  const [dateTimingScopeMap, setDateTimingScopeMap] = useState<Record<string, "SAME_ALL" | "CUSTOM_PER_FACILITY">>({});
  const [dateCopySuccess, setDateCopySuccess] = useState<boolean>(false);
  const [newDateInput, setNewDateInput] = useState<string>("");
  const [timingScope, setTimingScope] = useState<"SAME_ALL" | "CUSTOM_PER_FACILITY">("SAME_ALL");
  const [selectedTimings, setSelectedTimings] = useState<string[]>([WHOLE_DAY_SLOT_LABEL]);
  const [customStartTime, setCustomStartTime] = useState<string>("12:00 PM");
  const [customEndTime, setCustomEndTime] = useState<string>("02:00 PM");
  const [customSlotsList, setCustomSlotsList] = useState<string[]>([]);
  const [plotPurpose, setPlotPurpose] = useState<"WEDDING" | "FAMILY">("WEDDING");
  const [groundHallAc, setGroundHallAc] = useState<"AC" | "NON_AC">("NON_AC");
  const [dateGroundHallAcMap, setDateGroundHallAcMap] = useState<Record<string, "AC" | "NON_AC">>({});

  const getDateGroundHallAc = (dateStr: string): "AC" | "NON_AC" => {
    return dateGroundHallAcMap[dateStr] || groundHallAc;
  };
  const setDateGroundHallAc = (dateStr: string, opt: "AC" | "NON_AC") => {
    setDateGroundHallAcMap((prev) => ({ ...prev, [dateStr]: opt }));
  };

  const getDatePlotPurpose = (dateStr: string): "WEDDING" | "FAMILY" => {
    return datePlotPurposeMap[dateStr] || plotPurpose;
  };
  const setDatePlotPurpose = (dateStr: string, purpose: "WEDDING" | "FAMILY") => {
    setDatePlotPurposeMap((prev) => ({ ...prev, [dateStr]: purpose }));
  };
  const getDateTimingScope = (dateStr: string): "SAME_ALL" | "CUSTOM_PER_FACILITY" => {
    return dateTimingScopeMap[dateStr] || "SAME_ALL";
  };
  const setDateTimingScope = (dateStr: string, scope: "SAME_ALL" | "CUSTOM_PER_FACILITY") => {
    setDateTimingScopeMap((prev) => ({ ...prev, [dateStr]: scope }));
  };

  // Facility-specific Function / Event Type selector (Wedding, Family Function, Besnu, Other)
  const [dateFacilityFunctionMap, setDateFacilityFunctionMap] = useState<
    Record<string, Record<string, "WEDDING" | "FAMILY" | "BESNU" | "OTHER">>
  >({});

  const getDateFacilityFunction = (
    dateStr: string,
    facId: string
  ): "WEDDING" | "FAMILY" | "BESNU" | "OTHER" => {
    if (dateFacilityFunctionMap[dateStr]?.[facId]) {
      return dateFacilityFunctionMap[dateStr][facId];
    }
    const plotP = datePlotPurposeMap[dateStr];
    if (plotP) {
      if (plotP === "WEDDING") return "WEDDING";
      if (plotP === "FAMILY") return "FAMILY";
    }
    const ev = (formData.eventType || "").toLowerCase();
    if (ev.includes("wedding") || ev.includes("lagna") || ev.includes("wedd")) return "WEDDING";
    if (ev.includes("besnu") || ev.includes("shok") || ev.includes("prarthana")) return "BESNU";
    if (ev.includes("family") || ev.includes("sagai")) return "FAMILY";
    return "OTHER";
  };

  const setDateFacilityFunction = (
    dateStr: string,
    facId: string,
    fn: "WEDDING" | "FAMILY" | "BESNU" | "OTHER"
  ) => {
    setDateFacilityFunctionMap((prev) => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [facId]: fn,
      },
    }));
    const fac = facilities.find((f) => f.id === facId);
    if (fac?.code === "PLOT-OUTSIDE" || fac?.type === "PLOT") {
      setDatePlotPurpose(dateStr, fn === "WEDDING" ? "WEDDING" : "FAMILY");
    }
  };

  const getFunctionLabel = (fn: "WEDDING" | "FAMILY" | "BESNU" | "OTHER"): string => {
    switch (fn) {
      case "WEDDING":
        return "Wedding";
      case "FAMILY":
        return "Family Function";
      case "BESNU":
        return "Besnu";
      case "OTHER":
        return "Other";
      default:
        return "Wedding";
    }
  };

  // Active Date Resolution Helpers
  const currentActiveDate = activeDate && selectedDates.includes(activeDate)
    ? activeDate
    : selectedDates[0] || "";

  const activeDateFacilityIds = dateFacilityMap[currentActiveDate] || [];

  const activeDateIndex = selectedDates.indexOf(currentActiveDate);
  const hasNextDate = activeDateIndex !== -1 && activeDateIndex < selectedDates.length - 1;
  const nextDateStr = hasNextDate ? selectedDates[activeDateIndex + 1] : "";

  // Left-Side Calendar Widget State
  const [calViewDate, setCalViewDate] = useState<Date>(() => new Date());
  const [dateSelectionMode, setDateSelectionMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Booking Detail Modal State
  const [detailBooking, setDetailBooking] = useState<any | null>(null);

  // Edit Booking Modal State (Super Admin)
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [relatedBookings, setRelatedBookings] = useState<any[]>([]);
  const [applyToAllRelated, setApplyToAllRelated] = useState(false);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [targetBulkIds, setTargetBulkIds] = useState<string[]>([]);
  const [editFormData, setEditFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    customerAadhar: "",
    eventType: "Wedding",
    facilityId: "",
    facilityAmount: 0,
    depositAmount: 0,
    totalAmount: 0,
    startDate: "",
    slot: WHOLE_DAY_SLOT_LABEL,
    notes: "",
    paymentStatus: "PENDING",
    paymentMethod: "CASH_AT_OFFICE",
    paymentRefNo: "",
    status: "CONFIRMED",
    groundHallOption: "NON_AC" as "AC" | "NON_AC",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Export State
  const [exporting, setExporting] = useState(false);
  const bookingsRefresh = useRef<Promise<void> | null>(null);
  const facilitiesRefresh = useRef<Promise<void> | null>(null);

  // Senior-Friendly Delete Modal State with Smart Delete (Party & Mobile Auto-Detection)
  const [bookingToDelete, setBookingToDelete] = useState<any | null>(null);
  const [relatedDeleteBookings, setRelatedDeleteBookings] = useState<any[]>([]);
  const [deleteMode, setDeleteMode] = useState<"SINGLE" | "SMART_ALL">("SMART_ALL");
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Interactive 24-Hour Clock Modal State (સમાજ સમયપત્રક મુજબ)
  const [clockModalOpen, setClockModalOpen] = useState(false);
  const [clockModalDate, setClockModalDate] = useState<string>("");
  const [clockModalFacId, setClockModalFacId] = useState<string | null>(null);
  const [clockModalFacName, setClockModalFacName] = useState<string>("");

  // Pagination State (Fast 25/50/100 records per page to eliminate DOM lag)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Open and Close Modal Helpers with URL Cleanup
  const openNewBookingModal = (dateParam?: string | null, facParam?: string | null) => {
    setCreateError("");
    setShowCreateModal(true);
    setDateCopySuccess(false);
    setCustomDeposit(null);
    setGroundHallAc("NON_AC");
    setDateGroundHallAcMap({});
    const dStr = dateParam || new Date().toISOString().split("T")[0];
    setSelectedDates([dStr]);
    setActiveDate(dStr);
    setFormData({
      ...initialBookingFormData,
      startDate: dStr,
      endDate: dStr,
    });
    if (facParam) {
      setDateFacilityMap({ [dStr]: [facParam] });
      setDateTimeTimingMap({ [dStr]: { [facParam]: [WHOLE_DAY_SLOT_LABEL] } });
    } else {
      setDateFacilityMap({});
      setDateTimeTimingMap({});
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setDateCopySuccess(false);
    setCustomDeposit(null);
    setFormData(initialBookingFormData);
    if (typeof window !== "undefined" && window.location.search.includes("new=true")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      url.searchParams.delete("date");
      url.searchParams.delete("facilityId");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }
  };

  // React to searchParams change (handles navigation from calendar or direct URL with ?new=true)
  useEffect(() => {
    if (searchParams && searchParams.get("new") === "true") {
      const dateParam = searchParams.get("date");
      const facParam = searchParams.get("facilityId");
      openNewBookingModal(dateParam, facParam);
    }

    // Wait until authentication has loaded so Super Admin role is properly resolved
    if (authLoading || !currentUser) return;

    if (searchParams && searchParams.get("edit") && bookings.length > 0) {
      const editId = searchParams.get("edit");
      const target = bookings.find((b) => b.id === editId || b.bookingNumber === editId);
      if (target) {
        handleOpenEdit(target);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("edit");
          window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
        }
      }
    }
  }, [searchParams, bookings, currentUser, authLoading]);

  // React to custom event (handles clicking "+ નવું બુકિંગ" in navbar while already on /admin/bookings)
  useEffect(() => {
    const handleOpenModal = () => {
      openNewBookingModal();
    };
    window.addEventListener("open-new-booking-modal", handleOpenModal);
    return () => {
      window.removeEventListener("open-new-booking-modal", handleOpenModal);
    };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCreateModal) {
        closeCreateModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal]);

  useEffect(() => {
    const cachedUser = getAdminCachedData<any>("/api/auth/me");
    const cachedBookings = getAdminCachedData<any>("/api/bookings");
    const cachedFacilities = getAdminCachedData<any>("/api/facilities");
    const cachedDiscounts = getAdminCachedData<any>("/api/discounts");
    const cachedServices = getAdminCachedData<any>("/api/services");
    if (cachedUser?.user) {
      setCurrentUser(cachedUser.user);
      setAuthLoading(false);
    }
    if (cachedBookings?.bookings) setBookings(cachedBookings.bookings);
    if (cachedFacilities?.facilities) setFacilities(cachedFacilities.facilities);
    if (cachedDiscounts?.discounts) setDiscounts(cachedDiscounts.discounts);
    if (cachedServices?.services) setServices(cachedServices.services);
    if (cachedBookings) setLoading(false);
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
    const refreshFacilitiesWhileVisible = () => {
      if (document.visibilityState === "visible") refreshFacilities();
    };
    // Relax idle background polling: bookings every 45s, static facilities every 2 mins
    const timer = window.setInterval(refreshWhileVisible, 45000);
    const facilitiesTimer = window.setInterval(refreshFacilitiesWhileVisible, 120000);
    window.addEventListener("focus", refreshWhileVisible);
    document.addEventListener("visibilitychange", refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(facilitiesTimer);
      window.removeEventListener("focus", refreshWhileVisible);
      document.removeEventListener("visibilitychange", refreshWhileVisible);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      if (!getAdminCachedData("/api/bookings")) setLoading(true);
      const [userRes, bookRes, facRes, discRes, servRes] = await Promise.allSettled([
        fetchAdminJson<any>("/api/auth/me"),
        fetchAdminJson<any>("/api/bookings"),
        fetchAdminJson<any>("/api/facilities"),
        fetchAdminJson<any>("/api/discounts"),
        fetchAdminJson<any>("/api/services"),
      ]);

      if (userRes.status === "fulfilled" && userRes.value?.user) {
        setCurrentUser(userRes.value.user);
      }
      setAuthLoading(false);
      if (bookRes.status === "fulfilled" && bookRes.value?.bookings) {
        setBookings(bookRes.value.bookings);
      }
      if (facRes.status === "fulfilled" && facRes.value?.facilities) {
        setFacilities(facRes.value.facilities);
      }
      if (discRes.status === "fulfilled" && discRes.value?.discounts) {
        setDiscounts(discRes.value.discounts);
      }
      if (servRes.status === "fulfilled" && servRes.value?.services) {
        setServices(servRes.value.services);
      }
    } catch (err) {
      console.error("Bookings fetchInitialData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshFacilities = async () => {
    if (facilitiesRefresh.current) return facilitiesRefresh.current;
    facilitiesRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>("/api/facilities");
        if (data?.facilities) setFacilities(data.facilities);
      } catch (err) {
        console.error("Bookings facility refresh error:", err);
      } finally {
        facilitiesRefresh.current = null;
      }
    })();
    return facilitiesRefresh.current;
  };

  const refreshBookings = async () => {
    if (bookingsRefresh.current) return bookingsRefresh.current;
    bookingsRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>("/api/bookings");
        if (data.bookings) {
          setBookings(data.bookings);
          setDetailBooking((current: any) =>
            current ? data.bookings.find((booking: any) => booking.id === current.id) || null : null
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        bookingsRefresh.current = null;
      }
    })();
    return bookingsRefresh.current;
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const canExportData = isSuperAdmin || Boolean(currentUser?.canExport);

  const STANDARD_SLOT_OPTIONS = [
    {
      id: "WHOLE_DAY",
      slotLabel: WHOLE_DAY_SLOT_LABEL,
      title: "Whole Day / 24 Hours",
      guTitle: "આખો દિવસ / 24 Hours (Whole Day)",
      guDesc: "09:00 AM થી બીજા દિવસે 08:00 AM ચેકઆઉટ (24 કલાક પૂરા)",
      badge: "24 કલાક (Check-in 09:00 AM → 08:00 AM Next Day)",
    },
  ];

  const toggleFacilityForDate = (dateStr: string, facId: string) => {
    setDateFacilityMap((prev) => {
      const list = prev[dateStr] || [];
      const updated = list.includes(facId)
        ? list.filter((id) => id !== facId)
        : [...list, facId];
      return { ...prev, [dateStr]: updated };
    });
  };

  const toggleFacility = (facId: string) => {
    if (!currentActiveDate) return;
    toggleFacilityForDate(currentActiveDate, facId);
  };

  const selectAllRoomsForDate = (dateStr: string) => {
    const roomIds = facilities.filter((f) => f.type === "ROOM").map((f) => f.id);
    setDateFacilityMap((prev) => {
      const current = prev[dateStr] || [];
      const allSelected = roomIds.every((id) => current.includes(id));
      const nextList = allSelected
        ? current.filter((id) => !roomIds.includes(id))
        : Array.from(new Set([...current, ...roomIds]));
      return { ...prev, [dateStr]: nextList };
    });
  };

  const selectAllRooms = () => {
    if (!currentActiveDate) return;
    selectAllRoomsForDate(currentActiveDate);
  };

  const selectAllHallsForDate = (dateStr: string) => {
    const hallIds = facilities.filter((f) => f.type === "HALL").map((f) => f.id);
    setDateFacilityMap((prev) => {
      const current = prev[dateStr] || [];
      const allSelected = hallIds.every((id) => current.includes(id));
      const nextList = allSelected
        ? current.filter((id) => !hallIds.includes(id))
        : Array.from(new Set([...current, ...hallIds]));
      return { ...prev, [dateStr]: nextList };
    });
  };

  const selectAllHalls = () => {
    if (!currentActiveDate) return;
    selectAllHallsForDate(currentActiveDate);
  };

  const selectAllDormsForDate = (dateStr: string) => {
    const dormIds = facilities.filter((f) => f.type === "DORMITORY").map((f) => f.id);
    setDateFacilityMap((prev) => {
      const current = prev[dateStr] || [];
      const allSelected = dormIds.every((id) => current.includes(id));
      const nextList = allSelected
        ? current.filter((id) => !dormIds.includes(id))
        : Array.from(new Set([...current, ...dormIds]));
      return { ...prev, [dateStr]: nextList };
    });
  };

  const selectAllDorms = () => {
    if (!currentActiveDate) return;
    selectAllDormsForDate(currentActiveDate);
  };

  const selectAllFacilitiesForDate = (dateStr: string) => {
    setDateFacilityMap((prev) => ({
      ...prev,
      [dateStr]: facilities.map((f) => f.id),
    }));
  };

  const selectAllFacilities = () => {
    if (!currentActiveDate) return;
    selectAllFacilitiesForDate(currentActiveDate);
  };

  const clearAllFacilitiesForDate = (dateStr: string) => {
    setDateFacilityMap((prev) => ({
      ...prev,
      [dateStr]: [],
    }));
  };

  const clearAllFacilities = () => {
    if (!currentActiveDate) return;
    clearAllFacilitiesForDate(currentActiveDate);
  };

  const copyDateToAllOthers = (sourceDateStr: string) => {
    const sourceFacs = dateFacilityMap[sourceDateStr] || [];
    const sourceTimings = dateTimeTimingMap[sourceDateStr] || {};
    const sourcePurpose = datePlotPurposeMap[sourceDateStr] || plotPurpose;
    const sourceScope = dateTimingScopeMap[sourceDateStr] || "SAME_ALL";
    const sourceGroundHallAc = dateGroundHallAcMap[sourceDateStr] || groundHallAc;

    setDateFacilityMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = [...sourceFacs];
      }
      return next;
    });
    setDateTimeTimingMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = JSON.parse(JSON.stringify(sourceTimings));
      }
      return next;
    });
    setDatePlotPurposeMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = sourcePurpose;
      }
      return next;
    });
    setDateGroundHallAcMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = sourceGroundHallAc;
      }
      return next;
    });
    setDateTimingScopeMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = sourceScope;
      }
      return next;
    });
    const sourceFunctions = dateFacilityFunctionMap[sourceDateStr] || {};
    setDateFacilityFunctionMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = { ...sourceFunctions };
      }
      return next;
    });
    setDateCopySuccess(true);
    setTimeout(() => setDateCopySuccess(false), 3000);
  };

  const copyActiveDateFacilitiesToAll = () => {
    if (!currentActiveDate || selectedDates.length <= 1) return;
    copyDateToAllOthers(currentActiveDate);
  };

  const formatDateGu = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const weekdaysGu = ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"];
    const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayGu = weekdaysGu[dt.getDay()];
    const dayEn = weekdaysEn[dt.getDay()];
    const mName = monthsEn[dt.getMonth()];
    return `${d} ${mName} ${y} (${dayGu} / ${dayEn})`;
  };

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        const next = prev.filter((d) => d !== dateStr);
        if (activeDate === dateStr) {
          setActiveDate(next[0] || "");
        }
        return next;
      } else {
        const next = [...prev, dateStr].sort();
        setActiveDate(dateStr);
        return next;
      }
    });
  };

  const removeDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = prev.filter((d) => d !== dateStr);
      if (activeDate === dateStr) {
        setActiveDate(next[0] || "");
      }
      return next;
    });
  };

  const addDate = (dateStr: string) => {
    if (!dateStr) return;
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        setActiveDate(dateStr);
        return prev;
      }
      const next = [...prev, dateStr].sort();
      setActiveDate(dateStr);
      return next;
    });
    setNewDateInput("");
  };

  const addRelativeDays = (count: number) => {
    const base =
      selectedDates.length > 0
        ? selectedDates[selectedDates.length - 1]
        : new Date().toISOString().split("T")[0];
    const [y, m, d] = base.split("-").map(Number);
    const newDates: string[] = [];
    for (let i = 1; i <= count; i++) {
      const next = new Date(y, m - 1, d + i);
      const str = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      newDates.push(str);
    }
    if (dateSelectionMode === "SINGLE" && count === 1) {
      setSelectedDates([newDates[0]]);
      setActiveDate(newDates[0]);
    } else {
      setSelectedDates((prev) => {
        const next = Array.from(new Set([...prev, ...newDates])).sort();
        if (newDates[0]) setActiveDate(newDates[0]);
        return next;
      });
    }
  };

  const MONTH_NAMES_GU = [
    "જાન્યુઆરી (Jan)",
    "ફેબ્રુઆરી (Feb)",
    "માર્ચ (Mar)",
    "એપ્રિલ (Apr)",
    "મે (May)",
    "જૂન (Jun)",
    "જુલાઈ (Jul)",
    "ઓગસ્ટ (Aug)",
    "સપ્ટેમ્બર (Sep)",
    "ઓક્ટોબર (Oct)",
    "નવેમ્બર (Nov)",
    "ડિસેમ્બર (Dec)",
  ];

  const CAL_WEEK_DAYS = [
    { gu: "રવિ", en: "Su" },
    { gu: "સોમ", en: "Mo" },
    { gu: "મંગળ", en: "Tu" },
    { gu: "બુધ", en: "We" },
    { gu: "ગુરુ", en: "Th" },
    { gu: "શુક્ર", en: "Fr" },
    { gu: "શનિ", en: "Sa" },
  ];

  const calYear = calViewDate.getFullYear();
  const calMonth = calViewDate.getMonth();
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfCalWeek = new Date(calYear, calMonth, 1).getDay();
  const todayDateStr = new Date().toISOString().split("T")[0];

  const prevCalMonth = () => {
    setCalViewDate(new Date(calYear, calMonth - 1, 1));
  };
  const nextCalMonth = () => {
    setCalViewDate(new Date(calYear, calMonth + 1, 1));
  };
  const goToCalToday = () => {
    const now = new Date();
    setCalViewDate(now);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (dateSelectionMode === "SINGLE") {
      setSelectedDates([todayStr]);
    }
  };

  const handleCalendarDayClick = (dateStr: string) => {
    if (dateSelectionMode === "SINGLE") {
      setSelectedDates([dateStr]);
    } else {
      toggleDate(dateStr);
    }
  };

  const getDateTimings = (dateStr: string): string[] => {
    const dateMap = dateTimeTimingMap[dateStr];
    if (dateMap && dateMap["__ALL__"] !== undefined) {
      return dateMap["__ALL__"];
    }
    return [WHOLE_DAY_SLOT_LABEL];
  };

  const getActiveDateTimings = (dateStr: string): string[] => {
    return getDateTimings(dateStr);
  };

  const activeDateTimings = getDateTimings(currentActiveDate);

  const toggleDateTimingSlot = (dateStr: string, slotLabel: string) => {
    setDateTimeTimingMap((prev) => {
      const dateMap = prev[dateStr] || {};
      const current = (dateMap["__ALL__"] !== undefined)
        ? dateMap["__ALL__"]
        : [WHOLE_DAY_SLOT_LABEL];
      let next: string[];
      if (slotLabel === WHOLE_DAY_SLOT_LABEL) {
        if (current.includes(WHOLE_DAY_SLOT_LABEL)) {
          next = current.filter((s) => s !== WHOLE_DAY_SLOT_LABEL);
        } else {
          next = [WHOLE_DAY_SLOT_LABEL, ...current.filter((s) => s !== WHOLE_DAY_SLOT_LABEL)];
        }
      } else {
        if (current.includes(slotLabel)) {
          next = current.filter((s) => s !== slotLabel);
        } else {
          next = [...current.filter((s) => s !== WHOLE_DAY_SLOT_LABEL), slotLabel];
        }
      }
      const updatedDateMap: Record<string, string[]> = { ...dateMap, __ALL__: next };
      const facIds = dateFacilityMap[dateStr] || [];
      for (const fId of facIds) {
        updatedDateMap[fId] = next;
      }
      return {
        ...prev,
        [dateStr]: updatedDateMap,
      };
    });
  };

  const toggleTimingSlot = (slotLabel: string) => {
    if (!currentActiveDate) return;
    toggleDateTimingSlot(currentActiveDate, slotLabel);
  };

  const addDateCustomSlot = (dateStr: string, from: string, to: string) => {
    const customSlot = `${from} - ${to}`;
    if (!customSlotsList.includes(customSlot)) {
      setCustomSlotsList((prev) => [...prev, customSlot]);
    }
    setDateTimeTimingMap((prev) => {
      const dateMap = prev[dateStr] || {};
      const current = (dateMap["__ALL__"] !== undefined)
        ? dateMap["__ALL__"]
        : [WHOLE_DAY_SLOT_LABEL];
      if (current.includes(customSlot)) return prev;
      const next = [...current.filter((s) => s !== WHOLE_DAY_SLOT_LABEL), customSlot];
      const updatedDateMap: Record<string, string[]> = { ...dateMap, __ALL__: next };
      const facIds = dateFacilityMap[dateStr] || [];
      for (const fId of facIds) {
        updatedDateMap[fId] = next;
      }
      return {
        ...prev,
        [dateStr]: updatedDateMap,
      };
    });
  };

  const addCustomSlot = (from: string, to: string) => {
    if (!currentActiveDate) return;
    addDateCustomSlot(currentActiveDate, from, to);
  };

  const removeDateCustomSlot = (dateStr: string, slotStr: string) => {
    setDateTimeTimingMap((prev) => {
      const dateMap = prev[dateStr] || {};
      const current = (dateMap["__ALL__"] !== undefined)
        ? dateMap["__ALL__"]
        : [WHOLE_DAY_SLOT_LABEL];
      const next = current.filter((s) => s !== slotStr);
      const updatedDateMap: Record<string, string[]> = { ...dateMap, __ALL__: next };
      const facIds = dateFacilityMap[dateStr] || [];
      for (const fId of facIds) {
        updatedDateMap[fId] = next;
      }
      return {
        ...prev,
        [dateStr]: updatedDateMap,
      };
    });
  };

  const removeCustomSlot = (slotStr: string) => {
    setCustomSlotsList((prev) => prev.filter((s) => s !== slotStr));
    if (currentActiveDate) {
      removeDateCustomSlot(currentActiveDate, slotStr);
    }
  };

  const getDateFacilitySlots = (dateStr: string, facId: string): string[] => {
    const dateMap = dateTimeTimingMap[dateStr];
    if (dateMap && dateMap[facId] !== undefined) {
      return dateMap[facId];
    }
    if (dateMap && dateMap["__ALL__"] !== undefined) {
      return dateMap["__ALL__"];
    }
    return [WHOLE_DAY_SLOT_LABEL];
  };

  const getActiveFacilitySlots = (facId: string): string[] => {
    if (!currentActiveDate) return [WHOLE_DAY_SLOT_LABEL];
    return getDateFacilitySlots(currentActiveDate, facId);
  };

  const toggleFacilityCustomTimingForDate = (dateStr: string, facId: string, slotStr: string) => {
    setDateTimeTimingMap((prev) => {
      const dateMap = prev[dateStr] || {};
      const currentSlots = dateMap[facId] !== undefined ? dateMap[facId] : (dateMap["__ALL__"] !== undefined ? dateMap["__ALL__"] : [WHOLE_DAY_SLOT_LABEL]);
      let updatedSlots: string[];
      if (slotStr === WHOLE_DAY_SLOT_LABEL) {
        if (currentSlots.includes(WHOLE_DAY_SLOT_LABEL)) {
          updatedSlots = currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL);
        } else {
          updatedSlots = [WHOLE_DAY_SLOT_LABEL, ...currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL)];
        }
      } else {
        if (currentSlots.includes(slotStr)) {
          updatedSlots = currentSlots.filter((s) => s !== slotStr);
        } else {
          updatedSlots = [...currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL), slotStr];
        }
      }
      return {
        ...prev,
        [dateStr]: {
          ...dateMap,
          [facId]: updatedSlots,
        },
      };
    });
  };

  const toggleFacilityCustomTiming = (facId: string, slotStr: string) => {
    if (!currentActiveDate) return;
    toggleFacilityCustomTimingForDate(currentActiveDate, facId, slotStr);
  };

  const addFacilityCustomTimingSlotForDate = (dateStr: string, facId: string, from: string, to: string) => {
    const slotStr = `${from} - ${to}`;
    setDateTimeTimingMap((prev) => {
      const dateMap = prev[dateStr] || {};
      const currentSlots = dateMap[facId] !== undefined ? dateMap[facId] : (dateMap["__ALL__"] !== undefined ? dateMap["__ALL__"] : [WHOLE_DAY_SLOT_LABEL]);
      if (currentSlots.includes(slotStr)) return prev;
      return {
        ...prev,
        [dateStr]: {
          ...dateMap,
          [facId]: [...currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL), slotStr],
        },
      };
    });
  };

  const addFacilityCustomTimingSlot = (facId: string, from: string, to: string) => {
    if (!currentActiveDate) return;
    addFacilityCustomTimingSlotForDate(currentActiveDate, facId, from, to);
  };

  const openClockForDate = (dateStr: string) => {
    setClockModalDate(dateStr);
    setClockModalFacId(null);
    setClockModalFacName("બધી સુવિધાઓ (All Facilities)");
    setClockModalOpen(true);
  };

  const openClockForFacility = (dateStr: string, facId: string, facName: string) => {
    setClockModalDate(dateStr);
    setClockModalFacId(facId);
    setClockModalFacName(facName);
    setClockModalOpen(true);
  };

  const handleClockAddSlot = (slotString: string) => {
    if (!clockModalDate) return;
    const parts = slotString.split(" - ");
    const from = parts[0]?.trim() || "09:00 AM";
    const to = parts[1]?.trim() || "01:00 PM";
    if (clockModalFacId) {
      addFacilityCustomTimingSlotForDate(clockModalDate, clockModalFacId, from, to);
    } else {
      addDateCustomSlot(clockModalDate, from, to);
    }
  };

  const getNextDateStr = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  };

  const handlePlotPurposeChange = (purpose: "WEDDING" | "FAMILY") => {
    setPlotPurpose(purpose);
    setFormData((prev) => ({
      ...prev,
      eventType: purpose === "WEDDING" ? "Wedding" : "Family Function / Sagai",
    }));
  };

  const handleDiscountChange = (code: string) => {
    if (code === "NONE") {
      setFormData((prev) => ({
        ...prev,
        discountCode: "NONE",
        discountPercent: 0,
        discountOverridden: false,
      }));
    } else if (code === "MANUAL_OVERRIDE") {
      setFormData((prev) => ({
        ...prev,
        discountCode: "MANUAL_OVERRIDE",
        discountOverridden: true,
      }));
    } else {
      const rule = discounts.find((d) => d.code === code);
      setFormData((prev) => ({
        ...prev,
        discountCode: code,
        discountPercent: rule ? rule.percentage : 0,
        discountOverridden: false,
      }));
    }
  };

  const handleServiceToggle = (serviceCode: string) => {
    setFormData((prev) => {
      const exists = prev.selectedServices.includes(serviceCode);
      return {
        ...prev,
        selectedServices: exists
          ? prev.selectedServices.filter((c) => c !== serviceCode)
          : [...prev.selectedServices, serviceCode],
      };
    });
  };

  // Real-time Generated Bookings & Multi-Conflict Checker (Date-Scoped Facilities & Timings)
  const bookingItems = useMemo(() => {
    if (selectedDates.length === 0) return [];

    const items: Array<{
      facilityId: string;
      facilityName: string;
      facilityCode: string;
      facilityType: string;
      resourceGroup?: string;
      startDate: string;
      endDate: string;
      slot: string;
      baseRent: number;
      cautionDeposit: number;
      conflict: { isConflict: boolean; reason?: string; bookedBy?: string };
      groundHallOption?: "AC" | "NON_AC";
      eventType?: string;
    }> = [];

    for (const dateStr of selectedDates) {
      const facIdsForDate = dateFacilityMap[dateStr] || [];
      const timingsForDate = dateTimeTimingMap[dateStr] || {};

      for (const facId of facIdsForDate) {
        const fac = facilities.find((f) => f.id === facId);
        if (!fac) continue;

        const facFn = getDateFacilityFunction(dateStr, fac.id);
        const facFnLabel = getFunctionLabel(facFn);

        let baseRent = fac.baseRent || 0;
        if (fac.code === "PLOT-OUTSIDE" || fac.type === "PLOT") {
          baseRent =
            facFn === "WEDDING"
              ? fac.weddingRent || fac.baseRent || 51000
              : fac.familyRent || fac.baseRent || 21000;
        }
        const cautionDeposit = fac.cautionDeposit || 0;

        const facSlots =
          timingsForDate[facId] !== undefined
            ? timingsForDate[facId]
            : timingsForDate["__ALL__"] !== undefined
              ? timingsForDate["__ALL__"]
              : selectedTimings.length > 0
                ? selectedTimings
                : [WHOLE_DAY_SLOT_LABEL];

        for (const slotLabel of facSlots) {
          const isFull = isFullDaySlot(slotLabel);
          const endDateStr = isFull ? getNextDateStr(dateStr) || dateStr : dateStr;

          let slotBaseRent = baseRent;
          if (fac.code === "HALL-MULTIPURPOSE") {
            slotBaseRent = isFull ? 31000 : 21000;
          } else if (fac.code === "HALL-GROUND-FLOOR") {
            slotBaseRent = isFull ? 150000 : 100000;
          } else if (!slotBaseRent) {
            slotBaseRent = getStandardFacilityRate(fac, slotLabel, datePlotPurposeMap[dateStr] || plotPurpose);
          }

          // Conflict check against active bookings in database
          const dbConflict = bookings.find((b) => {
            if (b.status === "CANCELLED") return false;
            const facMatches = b.facilityId === fac.id;
            const groupMatches =
              fac.resourceGroup &&
              (b.facility?.resourceGroup === fac.resourceGroup ||
                b.resourceGroup === fac.resourceGroup);
            if (!facMatches && !groupMatches) return false;

            return doBookingsConflict(
              { startDate: b.startDate, slot: b.slot },
              { startDate: dateStr, slot: slotLabel }
            );
          });

          // Conflict check against previous items in this same generated batch
          const batchConflict = items.find((prev) => {
            const facMatches = prev.facilityId === fac.id;
            const groupMatches =
              fac.resourceGroup &&
              prev.resourceGroup &&
              fac.resourceGroup === prev.resourceGroup;
            if (!facMatches && !groupMatches) return false;

            return doBookingsConflict(
              { startDate: prev.startDate, slot: prev.slot },
              { startDate: dateStr, slot: slotLabel }
            );
          });

          let conflictInfo = { isConflict: false, reason: "", bookedBy: "" };
          if (dbConflict) {
            conflictInfo = {
              isConflict: true,
              reason: `પહેલેથી બુક થયેલ છે (${dbConflict.slot})`,
              bookedBy: dbConflict.customerName || "Existing Booking",
            };
          } else if (batchConflict) {
            conflictInfo = {
              isConflict: true,
              reason: `આ જ ફોર્મમાં ડુપ્લિકેટ પસંદગી`,
              bookedBy: "આ જ બુકિંગ",
            };
          }

          const isGround = isGroundFloorHall(fac);
          const hallAcOpt = isGround ? getDateGroundHallAc(dateStr) : undefined;
          const facFn = getDateFacilityFunction(dateStr, fac.id);
          const facFnLabel = getFunctionLabel(facFn);

          items.push({
            facilityId: fac.id,
            facilityName: isGround ? `${fac.name} (${hallAcOpt === "AC" ? "AC" : "Non-AC"})` : fac.name,
            facilityCode: fac.code,
            facilityType: fac.type,
            resourceGroup: fac.resourceGroup,
            startDate: dateStr,
            endDate: endDateStr,
            slot: slotLabel,
            baseRent: slotBaseRent,
            cautionDeposit,
            conflict: conflictInfo,
            groundHallOption: hallAcOpt,
            eventType: facFnLabel,
          });
        }
      }
    }

    return items;
  }, [
    selectedDates,
    dateFacilityMap,
    dateTimeTimingMap,
    facilities,
    bookings,
    plotPurpose,
    datePlotPurposeMap,
    dateGroundHallAcMap,
    groundHallAc,
    dateFacilityFunctionMap,
  ]);

  const totalFacilityRent = useMemo(() => {
    return bookingItems.reduce((acc, it) => acc + (it.baseRent || 0), 0);
  }, [bookingItems]);

  const currentDiscountPercent = useMemo(() => {
    if (formData.discountCode === "NONE") return 0;
    if (formData.discountCode === "MANUAL_OVERRIDE") return Number(formData.discountPercent) || 0;
    const rule = discounts.find((d) => d.code === formData.discountCode);
    return rule ? rule.percentage : 0;
  }, [formData.discountCode, formData.discountPercent, discounts]);

  const totalDiscountAmount = useMemo(() => {
    return Math.round((totalFacilityRent * currentDiscountPercent) / 100);
  }, [totalFacilityRent, currentDiscountPercent]);

  const totalServicesAmount = useMemo(() => {
    return formData.selectedServices.reduce((acc, code) => {
      const s = services.find((srv) => srv.code === code);
      return acc + (s?.price || 0);
    }, 0);
  }, [formData.selectedServices, services]);

  const totalDepositAmount = useMemo(() => {
    const uniqueFacilityIds = Array.from(new Set(bookingItems.map((it) => it.facilityId)));
    const bookedFacs = uniqueFacilityIds.map((id) => facilities.find((f) => f.id === id)).filter(Boolean);
    const hasMajorFacility = bookedFacs.some((f) => {
      const c = f?.code || "";
      return c === "PLOT-OUTSIDE" || c === "HALL-GROUND-FLOOR" || c === "HALL-MULTIPURPOSE" || c.startsWith("DORM");
    });
    if (hasMajorFacility) return 25000;
    return bookedFacs.reduce((acc, fac) => acc + (fac?.cautionDeposit || 0), 0);
  }, [bookingItems, facilities]);

  const effectiveDeposit = useMemo(() => {
    if (customDeposit !== null && !isNaN(customDeposit)) {
      return Math.max(0, customDeposit);
    }
    return totalDepositAmount;
  }, [customDeposit, totalDepositAmount]);

  const finalTotalAmount = useMemo(() => {
    return Math.max(0, totalFacilityRent - totalDiscountAmount) + totalServicesAmount;
  }, [totalFacilityRent, totalDiscountAmount, totalServicesAmount]);

  const netPayableWithDeposit = useMemo(() => {
    return finalTotalAmount + effectiveDeposit;
  }, [finalTotalAmount, effectiveDeposit]);

  const hasAnyConflict = useMemo(() => {
    return bookingItems.some((it) => it.conflict.isConflict);
  }, [bookingItems]);

  const conflictingItemsCount = useMemo(() => {
    return bookingItems.filter((it) => it.conflict.isConflict).length;
  }, [bookingItems]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to create bookings.");
      return;
    }

    if (selectedDates.length === 0) {
      setCreateError("કૃપા કરીને ઓછામાં ઓછી એક તારીખ પસંદ કરો (Please select at least one date).");
      return;
    }

    const datesWithoutFacilities = selectedDates.filter(
      (d) => (dateFacilityMap[d] || []).length === 0
    );
    if (datesWithoutFacilities.length > 0) {
      const emptyDateStr = datesWithoutFacilities[0];
      setActiveDate(emptyDateStr);
      setCreateError(
        `તારીખ ${formatDateGu(emptyDateStr)} માટે કોઈ સુવિધા પસંદ નથી. કૃપા કરીને સુવિધા પસંદ કરો અથવા ડાબી બાજુ કેલેન્ડરમાંથી તે તારીખ દૂર કરો.`
      );
      return;
    }

    // Check if any facility on any date has 0 time slots selected
    for (const d of selectedDates) {
      const fIds = dateFacilityMap[d] || [];
      for (const fId of fIds) {
        const slots = getDateFacilitySlots(d, fId);
        if (slots.length === 0) {
          const facObj = facilities.find((f) => f.id === fId);
          setActiveDate(d);
          setCreateError(
            `તારીખ ${formatDateGu(d)} પર "${facObj?.name || 'સુવિધા'}" માટે કોઈ સમય સ્લોટ પસંદ કરેલ નથી. કૃપા કરીને આખો દિવસ અથવા ચોક્કસ સમય પસંદ કરો.`
          );
          return;
        }
      }
    }

    if (bookingItems.length === 0) {
      setCreateError("કોઈ માન્ય બુકિંગ આઇટમ તૈયાર થઈ નથી (No valid booking items generated).");
      return;
    }

    if (hasAnyConflict) {
      setCreateError(
        `સમય ટકરાવ: ${conflictingItemsCount} બુકિંગમાં સમય ટકરાવ છે. કૃપા કરીને લાલ હાઇલાઇટ થયેલા સ્લોટ્સ બદલો.`
      );
      return;
    }

    setCreating(true);
    setCreateError("");

    const selectedServiceObjs = formData.selectedServices.map((code) => {
      const s = services.find((srv) => srv.code === code);
      return { name: s?.name || code, code, price: s?.price || 0 };
    });

    const preparedItems = bookingItems.map((item, idx) => ({
      facilityId: item.facilityId,
      startDate: item.startDate,
      endDate: item.endDate,
      slot: item.slot,
      facilityAmount: item.baseRent,
      depositAmount: idx === 0 ? effectiveDeposit : 0,
      groundHallOption: (item as any).groundHallOption,
      eventType: (item as any).eventType || formData.eventType || "General Function",
    }));

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: preparedItems,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          customerEmail: formData.customerEmail,
          customerAddress: formData.customerAddress,
          customerAadhar: formData.customerAadhar,
          eventType: formData.eventType || "General Function",
          facilityAmount: totalFacilityRent,
          discountCode: formData.discountCode,
          discountPercent: currentDiscountPercent,
          discountAmount: totalDiscountAmount,
          discountOverridden: formData.discountCode === "MANUAL_OVERRIDE",
          discountOverrideReason: formData.discountOverrideReason,
          selectedServices: selectedServiceObjs,
          servicesAmount: totalServicesAmount,
          depositAmount: effectiveDeposit,
          totalAmount: finalTotalAmount,
          paymentStatus: formData.paymentStatus || "PENDING",
          paymentMethod: formData.paymentMethod || "CASH_AT_OFFICE",
          paymentRefNo: formData.paymentRefNo,
          notes: formData.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      if (data.bookings && Array.isArray(data.bookings)) {
        const enriched = data.bookings.map((b: any) => {
          const fac = facilities.find((f) => f.id === b.facilityId);
          return {
            ...b,
            facilityName: fac?.name || b.facility?.name || "",
            facilityCode: fac?.code || b.facility?.code || "",
            resourceGroup: fac?.resourceGroup || b.facility?.resourceGroup || "",
          };
        });
        setBookings((prev) => [...enriched, ...prev]);
      } else if (data.booking) {
        const fac = facilities.find((f) => f.id === data.booking.facilityId);
        const enriched = {
          ...data.booking,
          facilityName: fac?.name || data.booking.facility?.name || "",
          facilityCode: fac?.code || data.booking.facility?.code || "",
          resourceGroup: fac?.resourceGroup || data.booking.facility?.resourceGroup || "",
        };
        setBookings((prev) => [enriched, ...prev]);
      }

      closeCreateModal();
      refreshBookings();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create booking");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to modify booking statuses.");
      return;
    }

    // Instant Optimistic UI Update: update badge and status in 0ms without waiting for network
    const previousBookings = [...bookings];
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
    if (detailBooking?.id === id) {
      setDetailBooking((prev: any) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        // Revert on error
        setBookings(previousBookings);
        const err = await res.json();
        alert(err.error || "Failed to update booking status");
      }
    } catch (err) {
      // Revert on network failure
      setBookings(previousBookings);
      console.error(err);
      alert("Network error: Could not update status.");
    }
  };

  const handleOpenEdit = (b: any, bulkIds?: string[]) => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to edit booking details.");
      return;
    }

    const isBulk = Array.isArray(bulkIds) && bulkIds.length > 1;

    // Smart Matching: find all other bookings by this party
    const cleanPhone = b.customerPhone?.replace(/\D/g, "") || "";
    const cleanName = b.customerName?.trim().toLowerCase() || "";

    const related = isBulk
      ? bookings.filter((item) => bulkIds.includes(item.id) && item.id !== b.id)
      : bookings.filter((other) => {
          if (other.id === b.id) return false;
          const oPhone = other.customerPhone?.replace(/\D/g, "") || "";
          const oName = other.customerName?.trim().toLowerCase() || "";
          const phoneMatches = cleanPhone && oPhone && cleanPhone === oPhone;
          const nameMatches = cleanName && oName && cleanName === oName;
          return Boolean(phoneMatches || nameMatches);
        });

    setEditingBooking(b);
    setRelatedBookings(related);
    // Smart default: if related bookings exist, enable batch update by default!
    setApplyToAllRelated(related.length > 0 || isBulk);
    setIsBulkEditMode(isBulk);
    setTargetBulkIds(isBulk ? bulkIds! : [b.id]);

    const initialGroundHallOpt = getBookingGroundHallOption(b) || "NON_AC";
    const bStart = b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "";
    const bFacAmt = Number(b.facilityAmount ?? b.totalAmount ?? 0);
    const bTotalAmt = Number(b.totalAmount ?? b.facilityAmount ?? 0);
    const bDepositAmt = Number(b.depositAmount !== undefined && b.depositAmount !== null ? b.depositAmount : (b.facility?.cautionDeposit || 25000));

    setEditFormData({
      customerName: b.customerName || "",
      customerPhone: b.customerPhone || "",
      customerEmail: b.customerEmail || "",
      customerAddress: b.customerAddress || "",
      customerAadhar: b.customerAadhar || "",
      eventType: b.eventType || "Wedding",
      facilityId: b.facilityId || "",
      facilityAmount: bFacAmt,
      depositAmount: bDepositAmt,
      totalAmount: bTotalAmt,
      startDate: bStart,
      slot: b.slot || WHOLE_DAY_SLOT_LABEL,
      notes: b.notes || "",
      paymentStatus: b.paymentStatus || "PENDING",
      paymentMethod: b.paymentMethod || "CASH_AT_OFFICE",
      paymentRefNo: b.paymentRefNo || "",
      status: b.status || "CONFIRMED",
      groundHallOption: initialGroundHallOpt,
    });
    setEditError("");
    setEditSuccess("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    if (!editFormData.customerName.trim()) {
      setEditError("કૃપા કરીને અરજદાર / પાર્ટીનું નામ દાખલ કરો (Party Name is required)");
      return;
    }
    if (!editFormData.customerPhone.trim()) {
      setEditError("કૃપા કરીને સંપર્ક નંબર દાખલ કરો (Phone number is required)");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setEditSuccess("");

    let idsToUpdate: string[] = [editingBooking.id];
    if (isBulkEditMode && targetBulkIds.length > 0) {
      idsToUpdate = targetBulkIds;
    } else if (applyToAllRelated && relatedBookings.length > 0) {
      idsToUpdate = Array.from(new Set([editingBooking.id, ...relatedBookings.map((r) => r.id)]));
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBooking.id,
          ids: idsToUpdate,
          customerName: editFormData.customerName.trim(),
          customerPhone: editFormData.customerPhone.trim(),
          customerEmail: editFormData.customerEmail.trim(),
          customerAddress: editFormData.customerAddress.trim(),
          customerAadhar: editFormData.customerAadhar.trim(),
          eventType: editFormData.eventType.trim(),
          facilityId: editFormData.facilityId,
          facilityAmount: Number(editFormData.facilityAmount),
          depositAmount: Number(editFormData.depositAmount),
          totalAmount: Number(editFormData.totalAmount),
          startDate: editFormData.startDate,
          slot: editFormData.slot.trim(),
          notes: editFormData.notes.trim(),
          paymentStatus: editFormData.paymentStatus,
          paymentMethod: editFormData.paymentMethod,
          paymentRefNo: editFormData.paymentRefNo.trim(),
          status: editFormData.status,
          groundHallOption: editFormData.groundHallOption,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update bookings");
      }

      const updatedList: any[] = data.bookings || (data.booking ? [data.booking] : []);
      const updatedMap = new Map(updatedList.map((item) => [item.id, item]));

      // Optimistically update all affected bookings in state in 0ms
      setBookings((prev) =>
        prev.map((b) => {
          if (updatedMap.has(b.id)) {
            const up = updatedMap.get(b.id);
            return {
              ...b,
              ...up,
              facility: up.facility || facilities.find((f) => f.id === up.facilityId) || b.facility,
            };
          }
          if (idsToUpdate.includes(b.id)) {
            const isTarget = b.id === editingBooking.id;
            const updatedFac = isTarget && editFormData.facilityId ? (facilities.find((f) => f.id === editFormData.facilityId) || b.facility) : b.facility;
            return {
              ...b,
              ...(isTarget ? {
                facilityId: editFormData.facilityId,
                facility: updatedFac,
                facilityAmount: Number(editFormData.facilityAmount),
                depositAmount: Number(editFormData.depositAmount),
                totalAmount: Number(editFormData.totalAmount),
                startDate: editFormData.startDate,
                slot: editFormData.slot.trim(),
              } : {}),
              customerName: editFormData.customerName.trim(),
              customerPhone: editFormData.customerPhone.trim(),
              customerEmail: editFormData.customerEmail.trim() || null,
              customerAddress: editFormData.customerAddress.trim() || null,
              customerAadhar: editFormData.customerAadhar.trim() || null,
              eventType: editFormData.eventType.trim(),
              notes: editFormData.notes.trim() || null,
              paymentStatus: editFormData.paymentStatus,
              paymentMethod: editFormData.paymentMethod,
              paymentRefNo: editFormData.paymentRefNo.trim() || null,
              status: editFormData.status,
            };
          }
          return b;
        })
      );

      // If details modal was open or viewing this booking, update it too
      if (detailBooking && idsToUpdate.includes(detailBooking.id)) {
        setDetailBooking((prev: any) => ({
          ...prev,
          ...(detailBooking.id === editingBooking.id ? {
            facilityId: editFormData.facilityId,
            facility: facilities.find((f) => f.id === editFormData.facilityId) || prev.facility,
            facilityAmount: Number(editFormData.facilityAmount),
            depositAmount: Number(editFormData.depositAmount),
            totalAmount: Number(editFormData.totalAmount),
            startDate: editFormData.startDate,
            slot: editFormData.slot.trim(),
          } : {}),
          customerName: editFormData.customerName.trim(),
          customerPhone: editFormData.customerPhone.trim(),
          customerEmail: editFormData.customerEmail.trim() || null,
          customerAddress: editFormData.customerAddress.trim() || null,
          customerAadhar: editFormData.customerAadhar.trim() || null,
          eventType: editFormData.eventType.trim(),
          notes: editFormData.notes.trim() || null,
          paymentStatus: editFormData.paymentStatus,
          paymentMethod: editFormData.paymentMethod,
          paymentRefNo: editFormData.paymentRefNo.trim() || null,
          status: editFormData.status,
        }));
      }

      clearAdminClientCache();
      refreshBookings();
      setSelectedBookingIds([]);

      setEditSuccess(
        idsToUpdate.length > 1
          ? `✓ આ અરજદારના તમામ ${idsToUpdate.length} બુકિંગ્સમાં વિગતો સફળતાપૂર્વક ઓવરરાઈટ થઈ ગઈ છે!`
          : "✓ બુકિંગ અને પાર્ટીની વિગતો સફળતાપૂર્વક સુધારાઈ ગઈ છે!"
      );

      setTimeout(() => {
        setEditingBooking(null);
        setEditSuccess("");
      }, 750);
    } catch (err: any) {
      console.error("Booking edit error:", err);
      setEditError(err.message || "Failed to save booking edits");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClick = (b: any) => {
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to cancel or delete bookings.");
      return;
    }

    // Smart Matching: find all other bookings by this party (same customer name or phone)
    const cleanPhone = b.customerPhone?.replace(/\D/g, "") || "";
    const cleanName = b.customerName?.trim().toLowerCase() || "";

    const related = bookings.filter((other) => {
      if (other.id === b.id) return false;
      const oPhone = other.customerPhone?.replace(/\D/g, "") || "";
      const oName = other.customerName?.trim().toLowerCase() || "";
      const phoneMatches = cleanPhone && oPhone && cleanPhone === oPhone;
      const nameMatches = cleanName && oName && cleanName === oName;
      return Boolean(phoneMatches || nameMatches);
    });

    setBookingToDelete(b);
    setRelatedDeleteBookings(related);
    // If related bookings exist, default to SMART_ALL (smart delete) for fast convenience, or user can toggle to SINGLE (manual delete)
    setDeleteMode(related.length > 0 ? "SMART_ALL" : "SINGLE");
  };

  const confirmDeleteBooking = async (id?: string) => {
    if (!bookingToDelete && !id) return;
    setIsDeletingBooking(true);

    const targetBaseId = id || bookingToDelete.id;
    const idsToDelete =
      deleteMode === "SMART_ALL" && relatedDeleteBookings.length > 0
        ? Array.from(new Set([targetBaseId, ...relatedDeleteBookings.map((r) => r.id)]))
        : [targetBaseId];

    // Optimistic instant removal: rows disappear in 0ms without waiting for network
    const previousBookings = [...bookings];
    setBookings((prev) => prev.filter((b) => !idsToDelete.includes(b.id)));
    if (detailBooking && idsToDelete.includes(detailBooking.id)) {
      setDetailBooking(null);
    }
    setBookingToDelete(null);
    setRelatedDeleteBookings([]);

    try {
      const res = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) {
        const err = await res.json();
        // Revert on failure
        setBookings(previousBookings);
        alert(err.error || "Failed to delete booking(s)");
      } else {
        clearAdminClientCache();
        refreshBookings();
      }
    } catch (err) {
      // Revert on network failure
      setBookings(previousBookings);
      console.error(err);
      alert("Network error: Could not delete booking(s).");
    } finally {
      setIsDeletingBooking(false);
    }
  };

  const toggleSelectBooking = (id: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (allIds: string[]) => {
    if (allIds.every((id) => selectedBookingIds.includes(id))) {
      // All visible are selected, unselect all visible
      setSelectedBookingIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      // Add all visible IDs to selected
      setSelectedBookingIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const clearSelection = () => {
    setSelectedBookingIds([]);
  };

  const confirmBulkDeleteBookings = async () => {
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to delete bookings.");
      return;
    }
    if (selectedBookingIds.length === 0) return;

    setIsBulkDeleting(true);
    const idsToDelete = [...selectedBookingIds];
    const previousBookings = [...bookings];

    // Optimistic removal: records disappear immediately from UI in 0ms
    setBookings((prev) => prev.filter((b) => !idsToDelete.includes(b.id)));
    if (detailBooking && idsToDelete.includes(detailBooking.id)) {
      setDetailBooking(null);
    }
    setShowBulkDeleteModal(false);
    setSelectedBookingIds([]);

    try {
      const res = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) {
        const err = await res.json();
        setBookings(previousBookings);
        alert(err.error || "Failed to delete selected bookings");
      } else {
        refreshBookings();
      }
    } catch (err) {
      setBookings(previousBookings);
      console.error(err);
      alert("Network error: Could not delete selected bookings.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch("/api/bookings/export");
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Export failed or not authorized.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shree-patel-samaj-bookings-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("An error occurred while exporting bookings.");
    } finally {
      setExporting(false);
    }
  };

  // Filter & Search Bookings
  const filteredBookings = bookings.filter((b) => {
    if (categoryFilter !== "ALL") {
      const fac = facilities.find((f) => f.id === b.facilityId);
      if (fac && fac.type !== categoryFilter) return false;
    }
    if (facilityFilter !== "ALL" && b.facilityId !== facilityFilter) return false;
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;

    // Date range filter
    if (startDateFilter) {
      const bDate = new Date(b.startDate).toISOString().split("T")[0];
      if (bDate < startDateFilter) return false;
    }
    if (endDateFilter) {
      const bDate = new Date(b.startDate).toISOString().split("T")[0];
      if (bDate > endDateFilter) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = b.customerName?.toLowerCase().includes(term);
      const matchPhone = b.customerPhone?.toLowerCase().includes(term);
      const matchNum = b.bookingNumber?.toLowerCase().includes(term);
      const matchEvent = b.eventType?.toLowerCase().includes(term);
      const matchAadhar = b.customerAadhar?.toLowerCase().includes(term);
      return matchName || matchPhone || matchNum || matchEvent || matchAadhar;
    }

    return true;
  });

  // Sorting
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (sortBy === "NEWEST") {
      return new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime();
    }
    if (sortBy === "EVENT_DATE_ASC") {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    if (sortBy === "EVENT_DATE_DESC") {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    }
    if (sortBy === "AMOUNT_HIGH") {
      return (b.totalAmount || 0) - (a.totalAmount || 0);
    }
    if (sortBy === "AMOUNT_LOW") {
      return (a.totalAmount || 0) - (b.totalAmount || 0);
    }
    return 0;
  });

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, facilityFilter, statusFilter, startDateFilter, endDateFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = useMemo(() => {
    return sortedBookings.slice(startIndex, startIndex + pageSize);
  }, [sortedBookings, startIndex, pageSize]);

  const selectedFacilityObj = facilities.find(
    (f) => f.id === (activeDateFacilityIds[0] || formData.facilityId)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
              {isSuperAdmin ? "Reservation Management" : "Community Bookings"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSuperAdmin ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
              {isSuperAdmin ? "Super Admin Full Access" : `${currentUser?.name || "View-Only Admin"} (View Only)`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {isSuperAdmin ? "All Hall, Party Plot & Dormitory Bookings" : "All Community Bookings & Slips"}
          </h1>
          <p className="text-xs text-slate-500">
            {isSuperAdmin
              ? "Internal trust records for Outside Party Plot, Multipurpose Hall, Ground Floor Hall, Dormitories, and AC Guest Rooms."
              : "Search reservations, inspect applicant details, and print official slips."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isSuperAdmin && (
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Total:</span>
              <span className="font-extrabold text-slate-900">{bookings.length}</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-medium">Confirmed:</span>
              <span className="font-extrabold text-emerald-800">
                {bookings.filter((b) => b.status === "CONFIRMED").length}
              </span>
            </div>
          )}

          {canExportData && (
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="bg-slate-50 border border-slate-200/90 text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center cursor-pointer"
              title="Download CSV export of bookings"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-500" />
              {exporting ? "Exporting CSV..." : "Export CSV"}
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => openNewBookingModal()}
              className="group bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/30 transition-all duration-200 flex items-center cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center mr-2 shadow-2xs transition-all duration-200">
                <Plus className="w-3.5 h-3.5 text-white stroke-[3]" />
              </span>
              <span>+ નવું બુકિંગ (Create New Booking)</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs & Direct Facility Pills (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center mr-1">
                <Filter className="w-3.5 h-3.5 mr-1" />
                Category:
              </span>
              {[
                { id: "ALL", label: `All Facilities (${facilities.length})` },
                { id: "PLOT", label: "Outside Party Plot (1)" },
                { id: "HALL", label: "Halls (2)" },
                { id: "DORMITORY", label: "Dormitories (2)" },
                { id: "ROOM", label: "AC Guest Rooms (3)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCategoryFilter(tab.id);
                    setFacilityFilter("ALL");
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer active:scale-95 ${
                    categoryFilter === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xs font-black"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {(categoryFilter !== "ALL" || facilityFilter !== "ALL") && (
              <button
                onClick={() => {
                  setCategoryFilter("ALL");
                  setFacilityFilter("ALL");
                }}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                ✕ Reset Facility Filters
              </button>
            )}
          </div>

          {/* Direct Facility Selection Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Direct Facility:</span>
            <button
              onClick={() => setFacilityFilter("ALL")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition cursor-pointer active:scale-95 ${
                facilityFilter === "ALL"
                  ? "bg-slate-800 text-white font-bold shadow-2xs"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              All in Category
            </button>
            {facilities
              .filter((f) => categoryFilter === "ALL" || f.type === categoryFilter)
              .map((f) => {
                const isSelected = facilityFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFacilityFilter(f.id);
                      setCategoryFilter(f.type);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-xl transition font-medium cursor-pointer active:scale-95 ${
                      isSelected
                        ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black shadow-xs"
                        : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {f.name.replace("Outside Party Plot — ", "").replace("Dormitory — ", "")}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search applicant name, phone, booking #, event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center">
            {/* Clean Facility Dropdown */}
            <select
              value={facilityFilter}
              onChange={(e) => {
                setFacilityFilter(e.target.value);
                setCategoryFilter("ALL");
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-semibold w-full md:w-auto"
            >
              <option value="ALL">All Facilities ({facilities.length})</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-semibold w-full md:w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="BLOCKED_BY_TRUST">BLOCKED_BY_TRUST</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-semibold w-full md:w-auto"
            >
              <option value="NEWEST">Sort: Newest First</option>
              <option value="EVENT_DATE_ASC">Event Date: Earliest First</option>
              <option value="EVENT_DATE_DESC">Event Date: Latest First</option>
              <option value="AMOUNT_HIGH">Amount: High to Low</option>
              <option value="AMOUNT_LOW">Amount: Low to High</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Event Date Range:
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">From:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-slate-700"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">To:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-slate-700"
            />
          </div>
          {(startDateFilter || endDateFilter) && (
            <button
              onClick={() => {
                setStartDateFilter("");
                setEndDateFilter("");
              }}
              className="text-[11px] font-bold text-red-700 hover:text-red-900"
            >
              Clear Date Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-semibold">
            Showing <span className="text-slate-900 font-bold">{paginatedBookings.length}</span> of {sortedBookings.length} reservations {sortedBookings.length > pageSize && `(પેજ ${currentPage} / ${totalPages})`}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Super Admin Only) */}
      {selectedBookingIds.length > 0 && isSuperAdmin && (
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border-2 border-red-500/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-400 text-red-300 flex items-center justify-center font-black text-sm">
              {selectedBookingIds.length}
            </span>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-white">
                {selectedBookingIds.length} બુકિંગ પસંદ કરેલ છે ({selectedBookingIds.length} Bookings Selected)
              </div>
              <div className="text-[11px] text-slate-400">
                તમે આ તમામ પસંદ કરેલ બુકિંગ્સને એકસાથે ડિલીટ / રદ કરી શકો છો.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              ✕ સાફ કરો (Deselect)
            </button>
            <button
              type="button"
              onClick={() => {
                const first = bookings.find((b) => selectedBookingIds.includes(b.id));
                if (first) handleOpenEdit(first, selectedBookingIds);
              }}
              className="px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>પસંદ કરેલ {selectedBookingIds.length} બુકિંગ સામૂહિક સુધારો (Bulk Edit)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-4 py-2 text-xs font-black rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>કાઢી નાખો (Delete)</span>
            </button>
          </div>
        </div>
      )}

      {/* Bookings Container: Responsive Dual-View (Cards for Mobile/Tablet, Full Table for Desktop) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 1. Desktop & iPad Landscape Table View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isSuperAdmin && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedBookings.length > 0 &&
                        paginatedBookings.every((b) => selectedBookingIds.includes(b.id))
                      }
                      onChange={() => toggleSelectAll(paginatedBookings.map((b) => b.id))}
                      className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer"
                      title="બધા પસંદ કરો / રદ કરો (Select All)"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Facility / Resource</th>
                <th className="py-3 px-4">Applicant & Phone</th>
                <th className="py-3 px-4">Function & Slot</th>
                <th className="py-3 px-4">Event Date</th>
                <th className="py-3 px-4">Tariff & Discount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
                    No booking records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b) => {
                  const isSelected = selectedBookingIds.includes(b.id);
                  return (
                    <tr
                      key={b.id}
                      className={`transition ${isSelected
                        ? "bg-red-50/80 hover:bg-red-100/60 font-semibold"
                        : "hover:bg-slate-50/80"
                        }`}
                    >
                      {isSuperAdmin && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectBooking(b.id)}
                            className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                        <button
                          onClick={() => setDetailBooking(b)}
                          className="hover:underline flex items-center font-mono font-bold tabular-nums text-blue-700 hover:text-blue-900"
                          title="Click to view full reservation details"
                        >
                          {b.bookingNumber}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{b.facility?.name}</span>
                          {isGroundFloorHall(b.facility) && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 ${
                              getBookingGroundHallOption(b) === "AC"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {getBookingGroundHallOption(b) === "AC" ? "❄️ AC" : "🍃 Non-AC"}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-800 font-mono font-normal">
                          {b.facility?.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          <span className="font-mono tabular-nums tracking-wide">{b.customerPhone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{b.eventType}</div>
                        <div className="text-[10px] text-slate-500 font-bold">{b.slot}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 tabular-nums">
                          {new Date(b.startDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold tabular-nums text-slate-900">
                          ₹{b.totalAmount.toLocaleString("en-IN")}
                        </div>
                        {b.discountPercent > 0 && (
                          <div className="text-[10px] text-emerald-700 font-mono font-semibold tabular-nums">
                            Discount: -₹{b.discountAmount.toLocaleString("en-IN")} ({b.discountPercent}%)
                          </div>
                        )}
                        {b.servicesAmount > 0 && (
                          <div className="text-[10px] text-blue-700 font-mono font-semibold tabular-nums">
                            Services: +₹{b.servicesAmount.toLocaleString("en-IN")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSuperAdmin ? (
                          <select
                            value={b.status}
                            onChange={(e) => handleStatusUpdate(b.id, e.target.value)}
                            className={`text-[11px] font-bold px-2 py-1 rounded-md border ${b.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : b.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                          >
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PENDING_APPROVAL">PENDING</option>
                            <option value="BLOCKED_BY_TRUST">BLOCKED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-md border ${b.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : b.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                          >
                            {b.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setDetailBooking(b)}
                          title="વિગત જુઓ (View Full Details)"
                          className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200/90 hover:border-blue-200 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 group cursor-pointer"
                        >
                          <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                        </button>

                        <Link
                          href={`/admin/bookings/${b.id}/receipt`}
                          target="_blank"
                          title="સત્તાવાર રસીદ પ્રિન્ટ કરો (Print Official Slip)"
                          className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200/90 hover:border-emerald-200 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 group cursor-pointer"
                        >
                          <Printer className="w-4 h-4 transition-transform group-hover:scale-110" />
                        </Link>

                        {isSuperAdmin && (
                          <button
                            onClick={() => handleOpenEdit(b)}
                            title="બુકિંગ અને પાર્ટીની વિગતો સુધારો (Edit Booking & Party Details)"
                            className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 border border-slate-200/90 hover:border-amber-200 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 group cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4 transition-transform group-hover:scale-110 text-amber-600" />
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeleteClick(b)}
                            title="બુકિંગ રદ અને ડીલીટ કરો (Cancel & Delete Booking)"
                            className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200/90 hover:border-rose-200 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 group cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile & Tablet Touch-Friendly Booking Cards (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {paginatedBookings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No booking records found matching your filters.
            </div>
          ) : (
            paginatedBookings.map((b) => {
              const isSelected = selectedBookingIds.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`p-3.5 sm:p-4 space-y-3 transition ${isSelected ? "bg-red-50/80 border-l-4 border-l-red-600" : "bg-white hover:bg-slate-50/70"
                    }`}
                >
                  {/* Card Header: Booking # & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectBooking(b.id)}
                          className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                        />
                      )}
                      <button
                        onClick={() => setDetailBooking(b)}
                        className="text-xs font-black text-red-900 bg-red-100/90 hover:bg-red-200 px-2.5 py-1 rounded-lg flex items-center tracking-wide"
                      >
                        {b.bookingNumber}
                      </button>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${b.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : b.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  {/* Applicant Name, Event & Quick Call Link */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 leading-snug">{b.customerName}</div>
                      <div className="text-xs text-slate-600 font-semibold mt-0.5">{b.eventType}</div>
                    </div>
                    {b.customerPhone && (
                      <a
                        href={`tel:${b.customerPhone}`}
                        className="text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 active:bg-red-200 px-3 py-1.5 rounded-xl border border-red-200 flex items-center flex-shrink-0 min-h-[36px]"
                      >
                        <Phone className="w-3.5 h-3.5 mr-1.5 text-red-700" />
                        Call
                      </a>
                    )}
                  </div>

                  {/* Facility, Event Date & Tariff Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Facility</span>
                      <span className="font-bold text-slate-800 truncate block mt-0.5">{b.facility?.name}</span>
                      {isGroundFloorHall(b.facility) && (
                        <span className={`inline-block mt-0.5 text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                          getBookingGroundHallOption(b) === "AC"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {getBookingGroundHallOption(b) === "AC" ? "❄️ AC" : "🍃 Non-AC"}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date & Slot</span>
                      <span className="font-bold text-slate-800 block mt-0.5">
                        {new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {b.slot}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Tariff</span>
                      <span className="font-black text-slate-900 block mt-0.5">₹{b.totalAmount.toLocaleString("en-IN")}</span>
                    </div>
                    {b.discountPercent > 0 ? (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Discount</span>
                        <span className="font-bold text-emerald-700 block mt-0.5">
                          -₹{b.discountAmount.toLocaleString("en-IN")} ({b.discountPercent}%)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Payment</span>
                        <span className="font-bold text-slate-600 block mt-0.5">{b.paymentStatus || "Cash at Office"}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Tap-Friendly Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setDetailBooking(b)}
                      title="વિગત જુઓ (View Details)"
                      className="flex-1 py-2 px-3 text-xs font-bold bg-slate-50 hover:bg-blue-50 active:bg-blue-100 text-slate-700 hover:text-blue-800 rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center min-h-[40px] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      Details
                    </button>
                    <Link
                      href={`/admin/bookings/${b.id}/receipt`}
                      target="_blank"
                      title="સત્તાવાર રસીદ (Print Slip)"
                      className="flex-1 py-2 px-3 text-xs font-bold bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center min-h-[40px] cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Print Slip
                    </Link>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleOpenEdit(b)}
                        title="વિગતો સુધારો (Edit Details)"
                        className="flex-1 py-2 px-3 text-xs font-bold bg-slate-50 hover:bg-amber-50 active:bg-amber-100 text-slate-700 hover:text-amber-800 rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center min-h-[40px] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                        Edit
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteClick(b)}
                        className="p-2 text-slate-400 hover:text-rose-600 active:text-rose-700 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 min-h-[40px] min-w-[40px] flex items-center justify-center shadow-2xs transition-all cursor-pointer"
                        title="Delete Booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls (Fast 25/50/100/All Records Slicing) */}
        {sortedBookings.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-500">પ્રતિ પેજ (Per Page):</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-700 cursor-pointer shadow-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={10000}>બધા (All)</option>
              </select>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-700">
                {startIndex + 1} - {Math.min(startIndex + pageSize, sortedBookings.length)} of {sortedBookings.length} reservations
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition shadow-xs cursor-pointer"
              >
                ← અગાઉનું (Prev)
              </button>
              <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-xs">
                પેજ {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition shadow-xs cursor-pointer"
              >
                આગળનું (Next) →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Details Modal (For All Administrators) */}
      {detailBooking && (
        <div className="booking-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                  Reservation Details & Audit Summary
                </span>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2 mt-0.5">
                  <span>{detailBooking.bookingNumber}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${detailBooking.status === "CONFIRMED"
                      ? "bg-emerald-600 text-white"
                      : detailBooking.status === "CANCELLED"
                        ? "bg-rose-600 text-white"
                        : "bg-amber-600 text-white"
                      }`}
                  >
                    {detailBooking.status}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setDetailBooking(null)}
                className="text-white/70 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-700">
              {/* Applicant & Ceremony Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-slate-500 block text-[11px]">Applicant Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{detailBooking.customerName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block text-[11px]">Contact Phone:</span>
                  <span className="font-bold text-slate-900">{detailBooking.customerPhone}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block text-[11px]">Email Address:</span>
                  <span>{detailBooking.customerEmail || "Not provided"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block text-[11px]">Aadhar / ID:</span>
                  <span>{detailBooking.customerAadhar || "Verified at Nikol Office"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-bold text-slate-500 block text-[11px]">Address:</span>
                  <span>{detailBooking.customerAddress || "Ahmedabad, Gujarat"}</span>
                </div>
              </div>

              {/* Facility & Date Info */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-red-800 uppercase">Booked Facility</span>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                      <span>{detailBooking.facility?.name}</span>
                      {isGroundFloorHall(detailBooking.facility) && (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          getBookingGroundHallOption(detailBooking) === "AC"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {getBookingGroundHallOption(detailBooking) === "AC" ? "❄️ AC Setup" : "🍃 Non-AC Setup"}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">Code: {detailBooking.facility?.code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Event Date</span>
                    <div className="font-bold text-slate-900">
                      {new Date(detailBooking.startDate).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <span className="text-[10px] text-slate-600 font-bold">Slot: {detailBooking.slot}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500">Function Type:</span>{" "}
                  <span className="font-semibold text-slate-800">{detailBooking.eventType}</span>
                </div>
              </div>

              {/* Tariff & Financials */}
              <div className="border border-slate-200 rounded-xl p-4 bg-amber-50/40 space-y-2">
                <span className="font-bold text-slate-900 block text-xs">Financial & Discount Breakdown</span>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Facility Tariff:</span>
                    <span className="font-semibold text-slate-800">
                      ₹{detailBooking.facilityAmount?.toLocaleString("en-IN") || 0}
                    </span>
                  </div>

                  {detailBooking.discountPercent > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>
                        Trustee / Donor Discount ({detailBooking.discountCode} - {detailBooking.discountPercent}%):
                      </span>
                      <span>- ₹{detailBooking.discountAmount?.toLocaleString("en-IN") || 0}</span>
                    </div>
                  )}

                  {detailBooking.servicesAmount > 0 && (
                    <div className="flex justify-between text-blue-700 font-semibold">
                      <span>Add-on Cleaning & Waste Collection:</span>
                      <span>+ ₹{detailBooking.servicesAmount?.toLocaleString("en-IN") || 0}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                    <span>Total Rent Payable:</span>
                    <span className="text-red-900">
                      ₹{detailBooking.totalAmount?.toLocaleString("en-IN") || 0}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Refundable Caution Deposit:</span>
                    <span className="font-semibold">
                      ₹{detailBooking.depositAmount?.toLocaleString("en-IN") || 0}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Payment Mode & Ref:</span>
                    <span className="font-semibold">
                      {detailBooking.paymentMethod} {detailBooking.paymentRefNo ? `(${detailBooking.paymentRefNo})` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Meta */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex flex-wrap justify-between gap-2">
                <div>
                  <span>Created By: </span>
                  <span className="font-bold text-slate-700">{detailBooking.createdByName || "Trust Administrator"}</span>
                </div>
                <div>
                  <span>Created At: </span>
                  <span className="font-semibold text-slate-700">
                    {detailBooking.createdAt ? new Date(detailBooking.createdAt).toLocaleString("en-IN") : "N/A"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      const target = detailBooking;
                      setDetailBooking(null);
                      handleDeleteClick(target);
                    }}
                    title="આ બુકિંગ રદ અને ડીલીટ કરો (Cancel & Smart Delete)"
                    className="bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 active:scale-[0.98] text-xs font-bold px-3 py-2 rounded-xl flex items-center shadow-2xs transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    રદ કરો (Delete)
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      const target = detailBooking;
                      setDetailBooking(null);
                      handleOpenEdit(target);
                    }}
                    title="પાર્ટીનું નામ કે વિગતો સુધારો (Edit Booking & Party Details)"
                    className="bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 active:scale-[0.98] text-xs font-bold px-4 py-2 rounded-xl flex items-center shadow-2xs transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                    વિગતો સુધારો (Edit Details)
                  </button>
                )}
                <Link
                  href={`/admin/bookings/${detailBooking.id}/receipt`}
                  target="_blank"
                  className="bg-slate-50 border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 active:scale-[0.98] text-xs font-bold px-4 py-2 rounded-xl flex items-center shadow-2xs transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Print Official Slip
                </Link>
                <button
                  onClick={() => setDetailBooking(null)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] text-xs font-bold px-4 py-2 rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal (For Super Admin) */}
      {editingBooking && isSuperAdmin && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) setEditingBooking(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Super Admin Only
                  </span>
                  <span className="text-xs text-blue-200 font-bold">
                    પાર્ટી અને બુકિંગ વિગતો સુધારો
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-300" />
                  <span>
                    {isBulkEditMode
                      ? `સામૂહિક બુકિંગ સુધારો (${targetBulkIds.length} બુકિંગ્સ)`
                      : `બુકિંગ સુધારો: ${editingBooking.bookingNumber}`}
                  </span>
                </h3>
                <p className="text-xs text-blue-100/90 mt-0.5">
                  પાર્ટીનું નામ કે વિગતો સુધારીને સાચવો. જૂનો ડેટા ઓવરરાઈટ થશે.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingEdit && setEditingBooking(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Facility, Date, Slot & Amount Editing Section */}
              <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border-2 border-blue-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/80">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-700" />
                    <span className="font-extrabold text-blue-950 text-xs uppercase tracking-wide">
                      સુવિધા, તારીખ, સમય અને ભાડું (Facility, Date & Amount)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                    {editingBooking.bookingNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Facility Dropdown */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>સુવિધા પસંદ કરો (Select Facility) <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-slate-500 font-normal">કોઈપણ સુવિધા બદલી શકાય છે</span>
                    </label>
                    <select
                      value={editFormData.facilityId}
                      onChange={(e) => {
                        const newFacId = e.target.value;
                        const selFac = facilities.find((f) => f.id === newFacId);
                        setEditFormData({
                          ...editFormData,
                          facilityId: newFacId,
                          ...(selFac && {
                            facilityAmount: selFac.basePrice,
                            totalAmount: selFac.basePrice,
                          }),
                        });
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                    >
                      {facilities.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name} ({fac.code}) — મૂળ ભાડું: ₹{fac.basePrice?.toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Booking Amount / Tariff Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>બુકિંગ ભાડું / રકમ (Tariff Amount) <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-amber-700 font-bold">સીધી રકમ બદલો</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-600 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={editFormData.facilityAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditFormData({
                            ...editFormData,
                            facilityAmount: val,
                            totalAmount: val,
                          });
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-black text-slate-950 text-sm shadow-2xs bg-white"
                        placeholder="દા.ત. 21000"
                      />
                    </div>
                  </div>

                  {/* Security Deposit Amount Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>ડિપોઝિટ રકમ (Security Deposit) <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-emerald-700 font-bold">રિફંડેબલ ડિપોઝિટ</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-600 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={editFormData.depositAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditFormData({
                            ...editFormData,
                            depositAmount: val,
                          });
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-black text-slate-950 text-sm shadow-2xs bg-white"
                        placeholder="દા.ત. 25000"
                      />
                    </div>
                  </div>

                  {/* Event Date Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      પ્રસંગની તારીખ (Event Date) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={editFormData.startDate}
                      onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                    />
                  </div>

                  {/* Time Slot Selection */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>સમયગાળો / સ્લોટ (Timing Slot) <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-slate-500 font-normal">સમાજ મુજબ</span>
                    </label>
                    <div className="space-y-1.5">
                      <select
                        value={
                          [
                            WHOLE_DAY_SLOT_LABEL,
                            "07:00 AM to 03:00 PM",
                            "03:00 PM to 11:00 PM",
                            "11:00 PM to 07:00 AM Next Day",
                            "01:00 AM to 02:00 PM",
                            "03:00 PM to 12:00 AM",
                          ].includes(editFormData.slot)
                            ? editFormData.slot
                            : "CUSTOM"
                        }
                        onChange={(e) => {
                          if (e.target.value !== "CUSTOM") {
                            setEditFormData({ ...editFormData, slot: e.target.value });
                          }
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                      >
                        <option value={WHOLE_DAY_SLOT_LABEL}>આખો દિવસ: {WHOLE_DAY_SLOT_LABEL}</option>
                        <option value="07:00 AM to 03:00 PM">સવાર / બપોર: 07:00 AM to 03:00 PM</option>
                        <option value="03:00 PM to 11:00 PM">સાંજ / રાત્રિ: 03:00 PM to 11:00 PM</option>
                        <option value="11:00 PM to 07:00 AM Next Day">મધ્યરાત્રિ: 11:00 PM to 07:00 AM</option>
                        <option value="01:00 AM to 02:00 PM">01:00 AM થી 02:00 PM</option>
                        <option value="03:00 PM to 12:00 AM">03:00 PM થી 12:00 AM</option>
                        <option value="CUSTOM">અન્ય કસ્ટમ સમય</option>
                      </select>

                      <input
                        type="text"
                        value={editFormData.slot}
                        onChange={(e) => setEditFormData({ ...editFormData, slot: e.target.value })}
                        placeholder="દા.ત. 07:00 AM to 03:00 PM"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium text-slate-800 text-[11px] shadow-2xs bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Auto-Detection Banner for Multiple Bookings by Same Party */}
              {relatedBookings.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                        ⚡
                      </span>
                      <div>
                        <span className="font-black text-amber-950 text-xs sm:text-sm block">
                          સ્માર્ટ લિન્કિંગ: આ અરજદારના અન્ય {relatedBookings.length} સંબંધિત બુકિંગ્સ શોધાયા!
                        </span>
                        <span className="text-[10px] text-amber-800 font-semibold block">
                          {isBulkEditMode
                            ? `તમે પસંદ કરેલ કુલ ${targetBulkIds.length} બુકિંગ્સ એકસાથે સુધારી રહ્યા છો.`
                            : `આ જ અરજદાર / ફોન નંબર સાથે જોડાયેલા કુલ ${relatedBookings.length + 1} બુકિંગ્સ ઉપલબ્ધ છે.`}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
                      કુલ {relatedBookings.length + 1} બુકિંગ્સ
                    </span>
                  </div>

                  {/* Checkbox to batch apply */}
                  <label className="flex items-start sm:items-center gap-3 bg-white p-3 rounded-xl border-2 border-amber-300 cursor-pointer hover:bg-amber-100/40 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={applyToAllRelated}
                      onChange={(e) => setApplyToAllRelated(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded mt-0.5 sm:mt-0 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-black text-slate-950 block">
                        આ તમામ {relatedBookings.length + 1} બુકિંગ્સમાં નવું પાર્ટી નામ અને વિગતો એકસાથે લાગુ કરો (સૂચિત)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        (એક-એક કરીને સુધારવાની જરૂર નથી — એક જ સેવ ક્લિકથી તમામ બુકિંગ્સ ઓવરરાઈટ થશે)
                      </span>
                    </div>
                  </label>

                  {/* Chips of the related bookings */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                      સંબંધિત બુકિંગ નંબરો:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      <span className="text-[10px] font-mono font-bold text-amber-950 bg-white border border-amber-400 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        <span>{editingBooking.bookingNumber}</span>
                        <span className="font-sans font-semibold text-amber-700">(હાલનું)</span>
                      </span>
                      {relatedBookings.map((rb: any) => (
                        <span
                          key={rb.id}
                          className="text-[10px] font-mono font-bold text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{rb.bookingNumber}</span>
                          <span className="font-sans font-normal text-slate-600">
                            ({rb.facility?.name || "Facility"} • {new Date(rb.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Party / Applicant Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                    અરજદાર / પાર્ટીની વિગતો (Applicant & Party Information)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      અરજદાર / પાર્ટીનું પૂરું નામ (Applicant / Party Full Name) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.customerName}
                      onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                      placeholder="દા.ત. શ્રી નરેશભાઈ મનસુખભાઈ પાનસુરીયા"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-sm shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      સંપર્ક મોબાઇલ નંબર (Contact Phone) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={editFormData.customerPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                      placeholder="દા.ત. 9824454129"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-xs shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      પ્રસંગનો પ્રકાર (Function / Event Type) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {[
                        { id: "Wedding", label: "💍 Wedding" },
                        { id: "Family Function", label: "👨‍👩‍👧‍👦 Family Function" },
                        { id: "Besnu", label: "🙏 Besnu" },
                        { id: "Other", label: "✨ Other" },
                      ].map((fOpt) => (
                        <button
                          key={fOpt.id}
                          type="button"
                          onClick={() => setEditFormData({ ...editFormData, eventType: fOpt.id })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            editFormData.eventType === fOpt.id
                              ? "bg-blue-700 text-white border-blue-800 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {fOpt.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={editFormData.eventType}
                      onChange={(e) => setEditFormData({ ...editFormData, eventType: e.target.value })}
                      placeholder="દા.ત. Wedding, Family Function, Besnu"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 text-xs shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ઈમેલ સરનામું (Email Address - વૈકલ્પિક)
                    </label>
                    <input
                      type="email"
                      value={editFormData.customerEmail}
                      onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                      placeholder="દા.ત. example@gmail.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      આધાર / ઓળખપત્ર (Aadhar / ID Proof - વૈકલ્પિક)
                    </label>
                    <input
                      type="text"
                      value={editFormData.customerAadhar}
                      onChange={(e) => setEditFormData({ ...editFormData, customerAadhar: e.target.value })}
                      placeholder="દા.ત. Verified at Nikol Office / 1234 5678 9012"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      સરનામું / વતન (Address / Native Place - વૈકલ્પિક)
                    </label>
                    <input
                      type="text"
                      value={editFormData.customerAddress}
                      onChange={(e) => setEditFormData({ ...editFormData, customerAddress: e.target.value })}
                      placeholder="દા.ત. Ahmedabad, Gujarat"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs shadow-2xs"
                    />
                  </div>
                </div>

                {/* Ground Floor Hall AC / Non-AC Selector in Edit Modal */}
                {isGroundFloorHall(facilities.find((f) => f.id === editFormData.facilityId) || editingBooking.facility) && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <span>⚡ ગ્રાઉન્ડ ફ્લોર હોલ વિકલ્પ (Ground Floor Hall Option)</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-blue-900 border border-blue-200">
                        {editFormData.groundHallOption === "AC" ? "❄️ AC પસંદ કરેલ" : "🍃 Non-AC પસંદ કરેલ"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, groundHallOption: "AC" })}
                        className={`py-2 px-3 rounded-xl border font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          editFormData.groundHallOption === "AC"
                            ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span>❄️ AC (એસી)</span>
                        {editFormData.groundHallOption === "AC" && <span className="text-[10px]">✓</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, groundHallOption: "NON_AC" })}
                        className={`py-2 px-3 rounded-xl border font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          editFormData.groundHallOption === "NON_AC"
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span>🍃 Non-AC (નોન-એસી)</span>
                        {editFormData.groundHallOption === "NON_AC" && <span className="text-[10px]">✓</span>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Status & Payment Information */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                    બુકિંગ અને ચુકવણી સ્થિતિ (Booking & Payment Status)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      બુકિંગ સ્થિતિ (Booking Status)
                    </label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                    >
                      <option value="CONFIRMED">CONFIRMED (કન્ફર્મ)</option>
                      <option value="PENDING_APPROVAL">PENDING (પેન્ડિંગ)</option>
                      <option value="CANCELLED">CANCELLED (રદ થયેલ)</option>
                      <option value="BLOCKED_BY_TRUST">BLOCKED (ટ્રસ્ટ દ્વારા બ્લોક)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      પેમેન્ટ સ્થિતિ (Payment Status)
                    </label>
                    <select
                      value={editFormData.paymentStatus}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                    >
                      <option value="PAID">PAID (સંપૂર્ણ ચુકવણી)</option>
                      <option value="PENDING">PENDING (ચુકવણી બાકી)</option>
                      <option value="PARTIAL">PARTIAL (આંશિક ચુકવણી)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ચુકવણી પદ્ધતિ (Payment Mode)
                    </label>
                    <select
                      value={editFormData.paymentMethod}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 text-xs shadow-2xs cursor-pointer bg-white"
                    >
                      <option value="CASH_AT_OFFICE">CASH_AT_OFFICE (રોકડ)</option>
                      <option value="ONLINE_UPI">ONLINE_UPI (ઓનલાઈન UPI)</option>
                      <option value="BANK_TRANSFER">BANK_TRANSFER (બેંક ટ્રાન્સફર)</option>
                      <option value="CHEQUE">CHEQUE (ચેક)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ચુકવણી સંદર્ભ નંબર / રસીદ નં (Payment Ref No - વૈકલ્પિક)
                    </label>
                    <input
                      type="text"
                      value={editFormData.paymentRefNo}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentRefNo: e.target.value })}
                      placeholder="દા.ત. Receipt-042 / UTR / Cheque No"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ખાસ નોંધ / શેરો (Admin Notes - વૈકલ્પિક)
                    </label>
                    <textarea
                      rows={2}
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="કોઈ વધારાની વિગત કે સુધારા અંગેની ખાસ નોંધ..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs shadow-2xs resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] font-bold text-xs transition cursor-pointer shadow-2xs"
                >
                  રદ કરો (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white font-extrabold text-xs transition shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {savingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>સાચવી રહ્યા છીએ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>ફેરફારો સાચવો (Save Changes)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Booking Modal with Multi-Facility, Multi-Date, and Multi-Timing Checkboxes */}
      {showCreateModal && isSuperAdmin && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreateModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-6xl xl:max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-800 to-amber-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400 text-red-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Super Admin Only
                  </span>
                  <span className="text-xs text-amber-200 font-bold">
                    કેલેન્ડર તારીખ • સુવિધા ચેકબોક્સ • સમય સ્લોટ્સ
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  નવું બુકિંગ નોંધણી (New Booking Entry)
                </h3>
                <p className="text-xs text-amber-100/90">
                  શ્રી સૌરાષ્ટ્ર પટેલ સમાજ, નિકોલ - નરોડા | અમદાવાદ
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="m-3 sm:mx-6 sm:mt-4 p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable 2-Column Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                  {/* ============================================================== */}
                  {/* LEFT COLUMN: Calendar & Date Selection (lg:col-span-5)        */}
                  {/* ============================================================== */}
                  <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-0">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                      {/* Calendar Section Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-red-800" />
                          <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            કેલેન્ડર તારીખ પસંદ કરો (Event Date) *
                          </span>
                        </div>

                        {/* Single vs Multi-Date Mode Toggle - iOS Segmented Control */}
                        <div className="inline-flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/80 text-[11px] font-bold shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              setDateSelectionMode("SINGLE");
                              if (selectedDates.length > 1) {
                                setSelectedDates([selectedDates[0]]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
                              dateSelectionMode === "SINGLE"
                                ? "bg-white text-slate-900 shadow-xs font-black scale-[1.02]"
                                : "text-slate-600 hover:text-slate-900 font-semibold"
                            }`}
                            title="એક તારીખ પસંદગી મોડ (Single Date Mode)"
                          >
                            ૧ તારીખ
                          </button>
                          <button
                            type="button"
                            onClick={() => setDateSelectionMode("MULTIPLE")}
                            className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
                              dateSelectionMode === "MULTIPLE"
                                ? "bg-white text-slate-900 shadow-xs font-black scale-[1.02]"
                                : "text-slate-600 hover:text-slate-900 font-semibold"
                            }`}
                            title="બહુવિધ તારીખો પસંદગી મોડ (Multi-Date Mode)"
                          >
                            મલ્ટી-તારીખ
                          </button>
                        </div>
                      </div>

                      {/* Month / Year Navigator */}
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={prevCalMonth}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold transition cursor-pointer"
                          title="ગત મહિનો (Previous Month)"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="text-center">
                          <div className="text-xs font-black text-slate-900">
                            {MONTH_NAMES_GU[calMonth]} {calYear}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={goToCalToday}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="આજની તારીખ"
                          >
                            આજે
                          </button>
                          <button
                            type="button"
                            onClick={nextCalMonth}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold transition cursor-pointer"
                            title="આગામી મહિનો (Next Month)"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 7-Day Month Grid */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        {/* Day of week headers */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1 pb-1 border-b border-slate-100">
                          {CAL_WEEK_DAYS.map((wd) => (
                            <div key={wd.en} className="text-[10px] font-black text-slate-500 uppercase">
                              <span>{wd.gu}</span>
                            </div>
                          ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {Array.from({ length: firstDayOfCalWeek }).map((_, idx) => (
                            <div key={`cal-pad-${idx}`} className="h-8 sm:h-9" />
                          ))}

                          {Array.from({ length: daysInCalMonth }).map((_, idx) => {
                            const dayNum = idx + 1;
                            const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                            const isSelected = selectedDates.includes(dayStr);
                            const isToday = todayDateStr === dayStr;

                            const dayBookings = bookings.filter((b) => {
                              if (b.status === "CANCELLED") return false;
                              const start = b.startDate ? String(b.startDate).split("T")[0] : "";
                              const end = b.endDate ? String(b.endDate).split("T")[0] : start;
                              return dayStr >= start && dayStr <= end;
                            });
                            const bookedCount = dayBookings.length;

                            return (
                              <button
                                key={dayStr}
                                type="button"
                                onClick={() => handleCalendarDayClick(dayStr)}
                                className={`h-8 sm:h-9 rounded-lg flex flex-col items-center justify-center relative transition cursor-pointer select-none ${isSelected
                                  ? "bg-red-800 text-white font-black shadow-xs ring-2 ring-red-400 scale-[1.04]"
                                  : isToday
                                    ? "border border-blue-500 bg-blue-50/70 font-black text-blue-900 hover:bg-red-50"
                                    : "hover:bg-slate-100 font-bold text-slate-800 text-xs"
                                  }`}
                              >
                                <span className="text-[11px] sm:text-xs leading-none">{dayNum}</span>
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {isSelected ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  ) : bookedCount > 0 ? (
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${bookedCount >= (facilities.length || 8)
                                        ? "bg-rose-500"
                                        : "bg-amber-500"
                                        }`}
                                      title={`${bookedCount} સુવિધા બુક થયેલ`}
                                    />
                                  ) : (
                                    <span className="w-1 h-1 rounded-full bg-emerald-400/80" title="ઉપલબ્ધ" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Date Presets - Secondary Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            const tStr = new Date().toISOString().split("T")[0];
                            if (dateSelectionMode === "SINGLE") setSelectedDates([tStr]);
                            else addDate(tStr);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          + આજે (Today)
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(1)}
                          className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          + આવતીકાલ
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(2)}
                          className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          + ૨ દિવસ
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(3)}
                          className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          + ૩ દિવસ
                        </button>
                        {selectedDates.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDates([])}
                            className="px-2.5 py-1 rounded-xl bg-slate-200/90 text-slate-700 hover:bg-slate-300/90 shadow-2xs active:scale-95 transition-all cursor-pointer ml-auto"
                          >
                            સાફ
                          </button>
                        )}
                      </div>

                      {/* Selected Dates Chips */}
                      {selectedDates.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>પસંદ કરેલી તારીખો ({selectedDates.length}):</span>
                            <span className="text-[10px] text-red-800 font-extrabold bg-red-100 px-2 py-0.5 rounded-full">
                              {selectedDates.length} દિવસ
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {selectedDates.map((dStr) => {
                              const isCurrentActive = dStr === currentActiveDate;
                              const facCount = (dateFacilityMap[dStr] || []).length;
                              return (
                                <div
                                  key={dStr}
                                  onClick={() => setActiveDate(dStr)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold shadow-2xs transition cursor-pointer ${isCurrentActive
                                    ? "bg-red-800 text-white border-red-950 ring-2 ring-amber-400"
                                    : "bg-white text-slate-700 border-slate-300 hover:border-red-400 hover:bg-red-50"
                                    }`}
                                >
                                  <span>{formatDateGu(dStr)}</span>
                                  <span
                                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${isCurrentActive
                                      ? "bg-amber-300 text-red-950"
                                      : facCount > 0
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                      }`}
                                  >
                                    {facCount} સુવિધા
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDate(dStr);
                                    }}
                                    className={`hover:opacity-75 font-black text-xs ml-0.5 cursor-pointer ${isCurrentActive ? "text-amber-200" : "text-slate-400 hover:text-red-700"
                                      }`}
                                    title="કાઢી નાખો (Remove)"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Real-time Generated Bookings & Conflict Review */}
                    <div className="space-y-2.5">
                      {bookingItems.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 font-bold flex items-center gap-2">
                          <Info className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>કેલેન્ડરમાંથી તારીખ, જમણી બાજુથી સુવિધા અને સમય પસંદ કરો.</span>
                        </div>
                      ) : hasAnyConflict ? (
                        <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-2xl text-xs text-rose-950 font-bold flex items-start gap-2 shadow-xs">
                          <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-xs text-rose-900">
                              ⚠️ સમય ટકરાવ: {conflictingItemsCount} સ્લોટ્સમાં ટકરાવ છે!
                            </div>
                            <div className="text-[11px] text-rose-800 mt-0.5">
                              લાલ રંગમાં દર્શાવેલ સુવિધા/સ્લોટ પહેલેથી બુક થયેલ છે.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-xs text-emerald-950 font-bold flex items-center gap-2 shadow-2xs">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-black text-emerald-900 text-xs">
                            ✓ તમામ {bookingItems.length} સ્લોટ્સ ઉપલબ્ધ છે (કોઈ ટકરાવ નથી)
                          </span>
                        </div>
                      )}

                      {/* Generated Items Review Mini List Grouped by Date */}
                      {bookingItems.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                          <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                              <FileText className="w-3.5 h-3.5 text-slate-600" />
                              બુકિંગ સમીક્ષા ({bookingItems.length})
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-slate-700 block">
                                ભાડું: ₹{totalFacilityRent.toLocaleString("en-IN")}
                              </span>
                              <span className="text-[10px] text-amber-900 font-extrabold block">
                                + ડિપોઝિટ: ₹{effectiveDeposit.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                            {selectedDates.map((dStr) => {
                              const itemsForDate = bookingItems.filter((it) => it.startDate === dStr);
                              const isCurrentActive = dStr === currentActiveDate;
                              return (
                                <div
                                  key={`summary-box-${dStr}`}
                                  className={`p-2 rounded-xl border transition ${isCurrentActive
                                    ? "border-red-500 bg-red-50/40 ring-1 ring-red-400"
                                    : "border-slate-200 bg-white"
                                    }`}
                                >
                                  <div
                                    onClick={() => setActiveDate(dStr)}
                                    className="flex items-center justify-between pb-1.5 border-b border-slate-100 cursor-pointer"
                                  >
                                    <span className="font-black text-xs text-red-900 flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5 text-red-700" />
                                      {formatDateGu(dStr)}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                      {itemsForDate.length} બુકિંગ
                                    </span>
                                  </div>

                                  {itemsForDate.length === 0 ? (
                                    <div
                                      onClick={() => setActiveDate(dStr)}
                                      className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1.5 cursor-pointer flex items-center justify-between"
                                    >
                                      <span>સુવિધા પસંદ કરવાની બાકી</span>
                                      <span className="text-red-700 font-extrabold underline">પસંદ કરો ➔</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 mt-1.5">
                                      {itemsForDate.map((item, idx) => (
                                        <div
                                          key={`${item.facilityId}-${item.slot}-${idx}`}
                                          className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs transition ${item.conflict.isConflict
                                            ? "bg-rose-100/90 text-rose-950 font-bold border border-rose-300"
                                            : "bg-slate-50 text-slate-800"
                                            }`}
                                        >
                                          <div className="min-w-0">
                                            <div className="font-extrabold truncate text-xs">{item.facilityName}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">{item.slot}</div>
                                            {item.conflict.isConflict && (
                                              <div className="text-[10px] text-rose-700 font-black">
                                                ટકરાવ ({item.conflict.bookedBy})
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right shrink-0">
                                            {item.conflict.isConflict ? (
                                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300">
                                                ટકરાવ
                                              </span>
                                            ) : (
                                              <span className="font-black text-slate-900 text-xs">
                                                ₹{item.baseRent.toLocaleString("en-IN")}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* RIGHT COLUMN: Name & Details -> Facilities -> Timings         */}
                  {/* ============================================================== */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* SECTION 1: Applicant Details */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                          <User className="w-4 h-4 text-red-800" />
                          ૧. અરજદારની વિગતો (Applicant & Function Details)
                        </span>
                        <span className="text-[11px] font-bold text-red-800">* ફરજિયાત માહિતી</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            અરજદારનું પૂરું નામ (Applicant Full Name) *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="દા.ત. રમેશભાઈ પટેલ"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-red-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            મોબાઇલ નંબર (10-Digit Mobile Number) *
                          </label>
                          <input
                            type="tel"
                            required
                            placeholder="10-digit mobile number"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-red-700 outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            પ્રસંગનો પ્રકાર (Function Type) *
                          </label>
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {[
                              { id: "Wedding", label: "💍 Wedding" },
                              { id: "Family Function", label: "👨‍👩‍👧‍👦 Family" },
                              { id: "Besnu", label: "🙏 Besnu" },
                              { id: "Other", label: "✨ Other" },
                            ].map((fOpt) => (
                              <button
                                key={fOpt.id}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, eventType: fOpt.id }))}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                  formData.eventType === fOpt.id
                                    ? "bg-red-800 text-white border-red-900 shadow-2xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {fOpt.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Wedding, Family Function, Besnu, Other..."
                            value={formData.eventType}
                            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-red-700 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            આધાર નંબર (Aadhar / ID Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="12-digit Aadhar"
                            value={formData.customerAadhar}
                            onChange={(e) => setFormData({ ...formData, customerAadhar: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            સરનામું / મૂળ ગામ (Native Village)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Nikol / Amreli"
                            value={formData.customerAddress}
                            onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ============================================================== */}
                    {/* SECTION 2: DATE-WISE FACILITY & TIMING CARDS (One Per Date)    */}
                    {/* ============================================================== */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-1">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-red-800" />
                          ૨. તારીખ મુજબ સુવિધાઓ અને સમય પસંદ કરો ({selectedDates.length} તારીખ)
                        </span>
                        {dateCopySuccess && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                            સુવિધાઓ બાકીની તારીખોમાં કોપી થઈ ગઈ!
                          </span>
                        )}
                      </div>

                      {selectedDates.length === 0 ? (
                        <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center space-y-2">
                          <Calendar className="w-8 h-8 text-amber-700 mx-auto" />
                          <div className="text-sm font-bold text-amber-950">ડાબી બાજુ કેલેન્ડરમાંથી તારીખ પસંદ કરો</div>
                          <div className="text-xs text-amber-800">
                            તમે કેલેન્ડરમાંથી જેટલી તારીખો પસંદ કરશો તે દરેક તારીખ માટે અલગ-અલગ સુવિધા અને સમય અહીં દેખાશે.
                          </div>
                        </div>
                      ) : (
                        selectedDates.map((dateStr, dateIdx) => {
                          const facIds = dateFacilityMap[dateStr] || [];
                          const dtTimings = getDateTimings(dateStr);
                          const dtScope = getDateTimingScope(dateStr);
                          const dtPlotPurpose = getDatePlotPurpose(dateStr);

                          return (
                            <div
                              key={`date-card-${dateStr}`}
                              className="bg-white rounded-2xl border-2 border-slate-300 hover:border-slate-400 p-4 sm:p-5 shadow-xs space-y-3.5 transition"
                            >
                              {/* Date Card Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-slate-100">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-8 h-8 rounded-xl bg-red-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                                    {dateIdx + 1}
                                  </span>
                                  <div>
                                    <div className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                                      <Calendar className="w-4 h-4 text-red-800" />
                                      <span>{formatDateGu(dateStr)}</span>
                                    </div>
                                    <div className="text-[11px] font-bold mt-0.5">
                                      {facIds.length > 0 ? (
                                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                          ✓ {facIds.length} સુવિધા પસંદ કરેલ છે
                                        </span>
                                      ) : (
                                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                          ⚠️ આ તારીખ માટે સુવિધા પસંદ કરવાની બાકી છે
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Actions for this Date */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => selectAllRoomsForDate(dateStr)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                                  >
                                    ✓ બધા રૂમ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => selectAllHallsForDate(dateStr)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                                  >
                                    ✓ બંને હોલ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => selectAllFacilitiesForDate(dateStr)}
                                    className="px-2 py-1 rounded-lg bg-red-800 text-white hover:bg-red-700 transition cursor-pointer"
                                  >
                                    બધું (All)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearAllFacilitiesForDate(dateStr)}
                                    className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                                  >
                                    સાફ
                                  </button>
                                  {selectedDates.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => copyDateToAllOthers(dateStr)}
                                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-2xs"
                                      title="આ તારીખની સુવિધાઓ અને સમય બાકીની બધી તારીખોમાં કોપી કરો"
                                    >
                                      📋 આ બાકીમાં કોપી કરો
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* ૮ સુવિધાઓ (8 Facilities) */}
                              <div className="space-y-3">
                                {/* 1. Outside Party Plot */}
                                {facilities.filter((f) => f.type === "PLOT").length > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                      <span>🌿 આઉટસાઇડ પાર્ટી પ્લોટ (Outside Party Plot)</span>
                                    </div>
                                    {facilities
                                      .filter((f) => f.type === "PLOT")
                                      .map((fac) => {
                                        const isChecked = facIds.includes(fac.id);
                                        const currentFn = getDateFacilityFunction(dateStr, fac.id);
                                        const currentRent =
                                          currentFn === "WEDDING"
                                            ? fac.weddingRent || fac.baseRent || 51000
                                            : fac.familyRent || fac.baseRent || 21000;
                                        return (
                                          <div
                                            key={`${dateStr}-${fac.id}`}
                                            className={`p-3 rounded-xl border-2 transition ${isChecked
                                              ? "border-red-600 bg-red-50/50 shadow-xs"
                                              : "border-slate-200 bg-white hover:border-slate-300"
                                              }`}
                                          >
                                            <label className="flex items-start justify-between gap-3 cursor-pointer">
                                              <div className="flex items-start gap-3">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleFacilityForDate(dateStr, fac.id)}
                                                  className="w-5 h-5 mt-0.5 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                                                />
                                                <div>
                                                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                                                    <span>{fac.name}</span>
                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                                                      {fac.code}
                                                    </span>
                                                  </div>
                                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                                    ક્ષમતા: {fac.capacity} Persons • ડિપોઝિટ: ₹{(fac.cautionDeposit || 0).toLocaleString("en-IN")}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="text-right shrink-0">
                                                <span className="text-xs sm:text-sm font-black text-red-800 block">
                                                  {currentRent > 0 ? `₹${currentRent.toLocaleString("en-IN")}` : "Rate Pending"}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                  {currentFn === "WEDDING" ? "Wedding Tariff" : `${getFunctionLabel(currentFn)} Tariff`}
                                                </span>
                                              </div>
                                            </label>

                                            {/* Outside Party Plot Purpose Selector for this Date */}
                                            {isChecked && (
                                              <div className="mt-2.5 pt-2.5 border-t border-red-200/60 bg-white/80 p-2 rounded-lg space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-[10px] font-bold text-amber-950 block">
                                                    આ તારીખ માટે પાર્ટી પ્લોટ ઉપયોગનો પ્રકાર:
                                                  </span>
                                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                                    {getFunctionLabel(currentFn)}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                                                  {[
                                                    { id: "WEDDING", label: "💍 Wedding", gu: "લગ્ન પ્રસંગ", rent: fac.weddingRent || 51000 },
                                                    { id: "FAMILY", label: "👨‍👩‍👧‍👦 Family", gu: "પારિવારિક", rent: fac.familyRent || 21000 },
                                                    { id: "BESNU", label: "🙏 Besnu", gu: "બેસણું", rent: fac.familyRent || 21000 },
                                                    { id: "OTHER", label: "✨ Other", gu: "અન્ય પ્રસંગ", rent: fac.familyRent || 21000 },
                                                  ].map((fOpt) => {
                                                    const isSel = currentFn === fOpt.id;
                                                    return (
                                                      <button
                                                        key={fOpt.id}
                                                        type="button"
                                                        onClick={() => setDateFacilityFunction(dateStr, fac.id, fOpt.id as any)}
                                                        className={`p-1.5 rounded-lg border text-left transition cursor-pointer ${
                                                          isSel
                                                            ? "bg-red-800 text-white border-red-900 shadow-xs"
                                                            : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                                                        }`}
                                                      >
                                                        <div className="font-bold text-[11px] truncate">{fOpt.label}</div>
                                                        <div className="text-[9px] opacity-80">{fOpt.gu}</div>
                                                        <div className="text-[10px] opacity-90 font-mono mt-0.5 font-bold">
                                                          ₹{fOpt.rent.toLocaleString("en-IN")}
                                                        </div>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}

                                {/* 2. Community Halls */}
                                {facilities.filter((f) => f.type === "HALL").length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                      🏛️ કોમ્યુનિટી હોલ (Community Halls)
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {facilities
                                        .filter((f) => f.type === "HALL")
                                        .map((fac) => {
                                          const isChecked = facIds.includes(fac.id);
                                          const isGroundHall = isGroundFloorHall(fac);
                                          const dtGroundHallAc = isGroundHall ? getDateGroundHallAc(dateStr) : null;
                                          return (
                                            <div
                                              key={`${dateStr}-${fac.id}`}
                                              className={`p-2.5 rounded-xl border-2 transition ${isChecked
                                                ? "border-red-600 bg-red-50/50 shadow-xs"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                }`}
                                            >
                                              <label className="flex items-center justify-between gap-2 cursor-pointer">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleFacilityForDate(dateStr, fac.id)}
                                                    className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                                                  />
                                                  <div className="min-w-0">
                                                    <div className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1.5">
                                                      <span>{fac.name}</span>
                                                      {isGroundHall && isChecked && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                                          dtGroundHallAc === "AC"
                                                            ? "bg-blue-100 text-blue-800 border-blue-200"
                                                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                        }`}>
                                                          {dtGroundHallAc === "AC" ? "❄️ AC" : "🍃 Non-AC"}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                      {fac.capacity} Persons {isGroundHall ? "• AC / Non-AC" : ""}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                  {(() => {
                                                    const hallRent = fac.baseRent || (fac.code === "HALL-GROUND-FLOOR" ? 150000 : 31000);
                                                    return (
                                                      <span className="text-xs font-black text-slate-800 block">
                                                        ₹{hallRent.toLocaleString("en-IN")}
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                              </label>

                                              {/* Ground Floor Hall AC / Non-AC & Function Selector */}
                                              {isGroundHall && isChecked && (
                                                <div className="mt-2.5 pt-2 border-t border-red-200/70 bg-white/95 p-2 rounded-xl space-y-2 shadow-2xs">
                                                  <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                      <span className="text-[10px] font-bold text-slate-700">
                                                        હોલ સુવિધા પ્રકાર (Hall Option):
                                                      </span>
                                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                        {dtGroundHallAc === "AC" ? "❄️ AC પસંદિત" : "🍃 Non-AC પસંદિત"}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          setDateGroundHallAc(dateStr, "AC");
                                                        }}
                                                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                                                          dtGroundHallAc === "AC"
                                                            ? "bg-blue-700 text-white border-blue-800 shadow-xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                                        }`}
                                                      >
                                                        <span>❄️ AC</span>
                                                        {dtGroundHallAc === "AC" && <span className="text-[9px]">✓</span>}
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          setDateGroundHallAc(dateStr, "NON_AC");
                                                        }}
                                                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                                                          dtGroundHallAc === "NON_AC"
                                                            ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                                        }`}
                                                      >
                                                        <span>🍃 Non-AC</span>
                                                        {dtGroundHallAc === "NON_AC" && <span className="text-[9px]">✓</span>}
                                                      </button>
                                                    </div>
                                                  </div>

                                                  <div className="pt-1.5 border-t border-slate-200">
                                                    <div className="flex items-center justify-between mb-1">
                                                      <span className="text-[10px] font-bold text-slate-700">
                                                        પ્રસંગ પ્રકાર (Function Type):
                                                      </span>
                                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                        {getFunctionLabel(getDateFacilityFunction(dateStr, fac.id))}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                                                      {[
                                                        { id: "WEDDING", label: "💍 Wedding", gu: "લગ્ન" },
                                                        { id: "FAMILY", label: "👨‍👩‍👧‍👦 Family", gu: "પારિવારિક" },
                                                        { id: "BESNU", label: "🙏 Besnu", gu: "બેસણું" },
                                                        { id: "OTHER", label: "✨ Other", gu: "અન્ય" },
                                                      ].map((fOpt) => {
                                                        const isSel = getDateFacilityFunction(dateStr, fac.id) === fOpt.id;
                                                        return (
                                                          <button
                                                            key={fOpt.id}
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              e.stopPropagation();
                                                              setDateFacilityFunction(dateStr, fac.id, fOpt.id as any);
                                                            }}
                                                            className={`py-1 px-1.5 rounded-lg border text-center font-bold text-[10px] transition cursor-pointer ${
                                                              isSel
                                                                ? "bg-red-800 text-white border-red-900 shadow-xs"
                                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                                            }`}
                                                          >
                                                            <div>{fOpt.label}</div>
                                                            <div className="text-[8px] opacity-80">{fOpt.gu}</div>
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* Multipurpose Hall Function Selector */}
                                              {!isGroundHall && isChecked && (
                                                <div className="mt-2.5 pt-2 border-t border-red-200/70 bg-white/95 p-2 rounded-xl space-y-1.5 shadow-2xs">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-slate-700">
                                                      પ્રસંગ પ્રકાર (Function Type):
                                                    </span>
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                      {getFunctionLabel(getDateFacilityFunction(dateStr, fac.id))}
                                                    </span>
                                                  </div>
                                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                                                    {[
                                                      { id: "WEDDING", label: "💍 Wedding", gu: "લગ્ન" },
                                                      { id: "FAMILY", label: "👨‍👩‍👧‍👦 Family", gu: "પારિવારિક" },
                                                      { id: "BESNU", label: "🙏 Besnu", gu: "બેસણું" },
                                                      { id: "OTHER", label: "✨ Other", gu: "અન્ય" },
                                                    ].map((fOpt) => {
                                                      const isSel = getDateFacilityFunction(dateStr, fac.id) === fOpt.id;
                                                      return (
                                                        <button
                                                          key={fOpt.id}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setDateFacilityFunction(dateStr, fac.id, fOpt.id as any);
                                                          }}
                                                          className={`py-1 px-1.5 rounded-lg border text-center font-bold text-[10px] transition cursor-pointer ${
                                                            isSel
                                                              ? "bg-red-800 text-white border-red-900 shadow-xs"
                                                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                                          }`}
                                                        >
                                                          <div>{fOpt.label}</div>
                                                          <div className="text-[8px] opacity-80">{fOpt.gu}</div>
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}

                                {/* 3. Dormitories */}
                                {facilities.filter((f) => f.type === "DORMITORY").length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                      🛏️ ડોર્મિટરી (Dormitories)
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {facilities
                                        .filter((f) => f.type === "DORMITORY")
                                        .map((fac) => {
                                          const isChecked = facIds.includes(fac.id);
                                          return (
                                            <label
                                              key={`${dateStr}-${fac.id}`}
                                              className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition cursor-pointer ${isChecked
                                                ? "border-red-600 bg-red-50/50 shadow-xs"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                }`}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleFacilityForDate(dateStr, fac.id)}
                                                  className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                                                />
                                                <div className="min-w-0">
                                                  <div className="font-extrabold text-xs text-slate-900 truncate">
                                                    {fac.name}
                                                  </div>
                                                  <div className="text-[10px] text-slate-500">
                                                    {fac.capacity} Beds
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <span className="text-xs font-black text-slate-800 block">
                                                  ₹{(fac.baseRent || (fac.code === "DORM-42-BEDS" ? 16000 : 11000)).toLocaleString("en-IN")}
                                                </span>
                                              </div>
                                            </label>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}

                                {/* 4. AC Guest Rooms */}
                                {facilities.filter((f) => f.type === "ROOM").length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                      <span>🚪 એસી ગેસ્ટ રૂમ (AC Guest Rooms)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      {facilities
                                        .filter((f) => f.type === "ROOM")
                                        .map((fac) => {
                                          const isChecked = facIds.includes(fac.id);
                                          return (
                                            <label
                                              key={`${dateStr}-${fac.id}`}
                                              className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition cursor-pointer ${isChecked
                                                ? "border-red-600 bg-red-50/50 shadow-xs"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleFacilityForDate(dateStr, fac.id)}
                                                  className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                                                />
                                                <div className="min-w-0">
                                                  <div className="font-extrabold text-xs text-slate-900 truncate">
                                                    {fac.name}
                                                  </div>
                                                  <div className="text-[10px] text-slate-500">
                                                    {fac.capacity} Beds
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <span className="text-[11px] font-black text-slate-800 block">
                                                  ₹{(fac.baseRent || (fac.code === "ROOM-6BED" ? 2500 : 3000)).toLocaleString("en-IN")}
                                                </span>
                                              </div>
                                            </label>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* સમય સ્લોટ્સ (Time Slots for this date) */}
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-200">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-red-800" />
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                      સમય સ્લોટ્સ (Time Slots for {dateStr}):
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      dtTimings.length > 0
                                        ? "bg-red-100 text-red-800 border-red-300"
                                        : "bg-amber-100 text-amber-800 border-amber-300"
                                    }`}>
                                      {dtTimings.length > 0 ? `${dtTimings.length} સ્લોટ પસંદ` : "સમય પસંદ કરો"}
                                    </span>
                                  </div>

                                  <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => setDateTimingScope(dateStr, "SAME_ALL")}
                                      className={`px-2 py-0.5 rounded transition cursor-pointer ${dtScope === "SAME_ALL"
                                        ? "bg-red-800 text-white shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                      બધી સુવિધાઓ માટે સરખો સમય
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDateTimingScope(dateStr, "CUSTOM_PER_FACILITY")}
                                      className={`px-2 py-0.5 rounded transition cursor-pointer ${dtScope === "CUSTOM_PER_FACILITY"
                                        ? "bg-red-800 text-white shadow-2xs"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                      સુવિધા મુજબ અલગ સમય
                                    </button>
                                  </div>
                                </div>

                                {dtScope === "SAME_ALL" ? (
                                  <div className="space-y-2">
                                    {dtTimings.length === 0 && (
                                      <div className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                        <span>આ તારીખ માટે ઉપરથી આખો દિવસ, ઝડપી સ્લોટ અથવા ચોક્કસ સમય પસંદ કરો.</span>
                                      </div>
                                    )}
                                    {/* Option 1: Whole Day */}
                                    <label
                                      className={`p-2.5 rounded-xl border-2 flex items-start gap-2.5 transition cursor-pointer ${dtTimings.includes(WHOLE_DAY_SLOT_LABEL)
                                        ? "border-red-600 bg-red-50/50 shadow-2xs"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={dtTimings.includes(WHOLE_DAY_SLOT_LABEL)}
                                        onChange={() => toggleDateTimingSlot(dateStr, WHOLE_DAY_SLOT_LABEL)}
                                        className="w-4 h-4 mt-0.5 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                          <span>૧. આખો દિવસ / 24 Hours (Whole Day)</span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                                            09:00 AM થી બીજા દિવસે 08:00 AM
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                          ચેક-ઇન સવારે 09:00 AM → ચેક-આઉટ બીજા દિવસે સવારે 08:00 AM (24 કલાક સંપૂર્ણ સાઇકલ)
                                        </div>
                                      </div>
                                    </label>

                                    {/* Option 2: Custom Hourly Timing */}
                                    <div className="p-2.5 rounded-xl border border-blue-200 bg-white space-y-2">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-blue-950 flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5 text-blue-700" />
                                          ૨. ચોક્કસ કસ્ટમ સમય ઉમેરો (Custom Timing):
                                        </span>

                                        {/* Prominent 24-Hour Interactive Clock Button */}
                                        <button
                                          type="button"
                                          onClick={() => openClockForDate(dateStr)}
                                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-800 via-red-700 to-amber-900 hover:from-red-700 hover:to-amber-800 active:scale-95 text-white font-extrabold text-[11px] shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Clock className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                                          <span>🕒 ૨૪ કલાક ઘડિયાળમાંથી પસંદ કરો (Open 24h Clock)</span>
                                        </button>
                                      </div>

                                      {/* Quick Presets */}
                                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">ઝડપી સ્લોટ:</span>
                                        {TIMING_PRESETS.map((preset) => {
                                          const presetStr = `${preset.from} - ${preset.to}`;
                                          const isChecked = dtTimings.includes(presetStr);
                                          return (
                                            <button
                                              key={`${dateStr}-${preset.label}`}
                                              type="button"
                                              onClick={() => toggleDateTimingSlot(dateStr, presetStr)}
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${isChecked
                                                ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                                                : "bg-slate-50 hover:bg-blue-100 text-slate-700 border-slate-200"
                                                }`}
                                            >
                                              {isChecked ? "✓ " : "+ "}{preset.from} - {preset.to}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {/* From / To dropdowns */}
                                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-600">શરૂ:</span>
                                          <select
                                            id={`dt-st-${dateStr}`}
                                            defaultValue="12:00 PM"
                                            className="bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 font-bold outline-none"
                                          >
                                            {STANDARD_HOURS.map((hr) => (
                                              <option key={`st-${dateStr}-${hr}`} value={hr}>{hr}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-600">અંત:</span>
                                          <select
                                            id={`dt-en-${dateStr}`}
                                            defaultValue="02:00 PM"
                                            className="bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 font-bold outline-none"
                                          >
                                            {STANDARD_HOURS.map((hr) => (
                                              <option key={`en-${dateStr}-${hr}`} value={hr}>{hr}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const stEl = document.getElementById(`dt-st-${dateStr}`) as HTMLSelectElement;
                                            const enEl = document.getElementById(`dt-en-${dateStr}`) as HTMLSelectElement;
                                            if (stEl && enEl) {
                                              addDateCustomSlot(dateStr, stEl.value, enEl.value);
                                            }
                                          }}
                                          className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>ઉમેરો</span>
                                        </button>

                                        {/* Display custom slots pills */}
                                        {dtTimings.filter((s) => s !== WHOLE_DAY_SLOT_LABEL).map((slotStr) => (
                                          <span
                                            key={`${dateStr}-${slotStr}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-950 font-bold text-[10px]"
                                          >
                                            <span>{slotStr}</span>
                                            <button
                                              type="button"
                                              onClick={() => toggleDateTimingSlot(dateStr, slotStr)}
                                              className="text-blue-500 hover:text-red-700 font-bold cursor-pointer"
                                            >
                                              ✕
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Per Facility timing on this date */
                                  <div className="space-y-2">
                                    {facIds.length === 0 ? (
                                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs font-bold text-amber-900">
                                        ⚠️ ઉપરથી પહેલા સુવિધાઓ પસંદ કરો, જેથી તેનો સમય નક્કી કરી શકાય.
                                      </div>
                                    ) : (
                                      facIds.map((facId) => {
                                        const fac = facilities.find((f) => f.id === facId);
                                        if (!fac) return null;
                                        const currentSlots = getDateFacilitySlots(dateStr, facId);
                                        const isWholeDay = currentSlots.includes(WHOLE_DAY_SLOT_LABEL);

                                        return (
                                          <div key={`fac-time-${dateStr}-${fac.id}`} className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                                            <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                                              <span className="flex items-center gap-1">
                                                <Building className="w-3 h-3 text-red-800" />
                                                {fac.name} ({fac.code})
                                              </span>
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                currentSlots.length > 0
                                                  ? "text-red-800 bg-red-50 border-red-200"
                                                  : "text-amber-800 bg-amber-50 border-amber-300"
                                              }`}>
                                                {currentSlots.length > 0 ? `${currentSlots.length} સ્લોટ પસંદ` : "સમય પસંદ કરો"}
                                              </span>
                                            </div>

                                            {currentSlots.length === 0 && (
                                              <div className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                                <span>આ સુવિધા માટે ઉપરથી ઝડપી સ્લોટ અથવા નીચેથી ચોક્કસ સમય પસંદ કરો.</span>
                                              </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                                              <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={isWholeDay}
                                                  onChange={() => toggleFacilityCustomTimingForDate(dateStr, fac.id, WHOLE_DAY_SLOT_LABEL)}
                                                  className="w-3.5 h-3.5 rounded text-red-800"
                                                />
                                                <span className="font-bold text-[11px]">આખો દિવસ (09 AM થી 08 AM)</span>
                                              </label>

                                              {TIMING_PRESETS.map((preset) => {
                                                const pStr = `${preset.from} - ${preset.to}`;
                                                const isPChecked = currentSlots.includes(pStr);
                                                return (
                                                  <button
                                                    key={`fac-p-${dateStr}-${fac.id}-${preset.label}`}
                                                    type="button"
                                                    onClick={() => toggleFacilityCustomTimingForDate(dateStr, fac.id, pStr)}
                                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${isPChecked
                                                      ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                                                      : "bg-slate-50 hover:bg-blue-100 text-slate-700 border-slate-200"
                                                      }`}
                                                  >
                                                    {isPChecked ? "✓ " : "+ "}{preset.from} - {preset.to}
                                                  </button>
                                                );
                                              })}
                                            </div>

                                            {/* Custom Timing Dropdowns & Interactive Clock for this Facility */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-blue-950 flex items-center gap-1">
                                                  <Clock className="w-3 h-3 text-blue-700" />
                                                  ચોક્કસ સમય:
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => openClockForFacility(dateStr, fac.id, fac.name)}
                                                  className="px-2 py-0.5 rounded-lg bg-red-800 hover:bg-red-700 active:scale-95 text-white font-extrabold text-[10px] shadow-2xs transition flex items-center gap-1 cursor-pointer"
                                                >
                                                  <Clock className="w-3 h-3 text-amber-300 stroke-[2.5]" />
                                                  <span>🕒 ૨૪ કલાક ઘડિયાળ</span>
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-500 font-bold">શરૂ:</span>
                                                <select
                                                  id={`fac-st-${dateStr}-${fac.id}`}
                                                  defaultValue="12:00 PM"
                                                  className="bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 font-bold outline-none text-xs text-slate-800"
                                                >
                                                  {STANDARD_HOURS.map((hr) => (
                                                    <option key={`st-${dateStr}-${fac.id}-${hr}`} value={hr}>{hr}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-500 font-bold">અંત:</span>
                                                <select
                                                  id={`fac-en-${dateStr}-${fac.id}`}
                                                  defaultValue="02:00 PM"
                                                  className="bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 font-bold outline-none text-xs text-slate-800"
                                                >
                                                  {STANDARD_HOURS.map((hr) => (
                                                    <option key={`en-${dateStr}-${fac.id}-${hr}`} value={hr}>{hr}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const stEl = document.getElementById(`fac-st-${dateStr}-${fac.id}`) as HTMLSelectElement;
                                                  const enEl = document.getElementById(`fac-en-${dateStr}-${fac.id}`) as HTMLSelectElement;
                                                  if (stEl && enEl) {
                                                    addFacilityCustomTimingSlotForDate(dateStr, fac.id, stEl.value, enEl.value);
                                                  }
                                                }}
                                                className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 active:scale-95 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                              >
                                                <Plus className="w-3 h-3" />
                                                <span>+ ઉમેરો</span>
                                              </button>
                                            </div>

                                            {/* Selected Custom Slots for this Facility */}
                                            {currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL).length > 0 && (
                                              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-100">
                                                <span className="text-[10px] font-bold text-blue-900">પસંદ કરેલ સ્લોટ્સ:</span>
                                                {currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL).map((slotStr) => (
                                                  <span
                                                    key={`fac-slot-${dateStr}-${fac.id}-${slotStr}`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 border border-blue-300 text-blue-950 text-[10px] font-bold shadow-2xs"
                                                  >
                                                    <span>{slotStr}</span>
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleFacilityCustomTimingForDate(dateStr, fac.id, slotStr)}
                                                      className="text-blue-500 hover:text-red-700 ml-0.5 font-bold cursor-pointer"
                                                      title="કાઢી નાખો (Remove)"
                                                    >
                                                      ✕
                                                    </button>
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* SECTION 4: Add-on Services: Cleaning & Waste Collection */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center">
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        ૪. વધારાની સેવાઓ (Optional Add-on Trust Services):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {services.map((srv) => {
                          const isChecked = formData.selectedServices.includes(srv.code);
                          return (
                            <label
                              key={srv.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${isChecked
                                ? "bg-amber-100/60 border-amber-300 font-bold text-amber-950"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100/50"
                                }`}
                            >
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleServiceToggle(srv.code)}
                                  className="rounded text-red-800 focus:ring-red-700 cursor-pointer"
                                />
                                <span>{srv.name}</span>
                              </div>
                              <span className="text-slate-900 font-extrabold">
                                + ₹{srv.price.toLocaleString("en-IN")}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION 5: Non-Stackable Discount Rules */}
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center">
                          <Percent className="w-3.5 h-3.5 mr-1 text-red-800" />
                          ૫. ટ્રસ્ટી અને દાતા ડિસ્કાઉન્ટ (Trustee & Room Donor Discount Policy):
                        </span>
                        <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                          Non-Stackable
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            ડિસ્કાઉન્ટ કેટેગરી પસંદ કરો (Select Discount Category):
                          </label>
                          <select
                            value={formData.discountCode}
                            onChange={(e) => handleDiscountChange(e.target.value)}
                            className="w-full text-xs bg-white border border-amber-300 rounded-xl p-2.5 text-slate-800 font-semibold outline-none"
                          >
                            <option value="NONE">No Discount (Standard Community Member Rate)</option>
                            {discounts.map((d) => (
                              <option key={d.code} value={d.code}>
                                {d.name} ({d.percentage}% Off)
                              </option>
                            ))}
                            <option value="MANUAL_OVERRIDE">Authorized Admin Override (Custom %)</option>
                          </select>
                        </div>

                        {formData.discountCode === "MANUAL_OVERRIDE" && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Override Percentage & Audit Reason:
                            </label>
                            <div className="flex space-x-2">
                              <input
                                type="number"
                                placeholder="%"
                                min="0"
                                max="100"
                                value={formData.discountPercent}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    discountPercent: Number(e.target.value),
                                  })
                                }
                                className="w-20 text-xs bg-white border border-amber-300 rounded-xl p-2 font-bold outline-none"
                              />
                              <input
                                type="text"
                                required
                                placeholder="Mandatory Audit Reason"
                                value={formData.discountOverrideReason}
                                onChange={(e) =>
                                  setFormData({ ...formData, discountOverrideReason: e.target.value })
                                }
                                className="flex-1 text-xs bg-white border border-amber-300 rounded-xl p-2 text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4-Column Financial Summary Grid (સમાજ હિસાબ પદ્ધતિ - ડિપોઝિટ કોલમ નેટ પહેલાં) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50/90 border border-amber-200/90 mt-2.5 shadow-2xs">
                        {/* 1. Base Rent Column */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            ૧. મૂળ ભાડું (Base)
                          </span>
                          <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums block mt-0.5">
                            ₹{totalFacilityRent.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {bookingItems.length} બુકિંગ સ્લોટ
                          </span>
                        </div>

                        {/* 2. Total with Discount Column */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            ૨. ડિસ્કાઉન્ટ બાદ ભાડું
                          </span>
                          <span className="text-sm sm:text-base font-black text-blue-900 tabular-nums block mt-0.5">
                            ₹{finalTotalAmount.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-blue-600 block mt-0.5">
                            {totalDiscountAmount > 0
                              ? `-₹${totalDiscountAmount.toLocaleString("en-IN")} (${currentDiscountPercent}%)`
                              : "૦% ડિસ્કાઉન્ટ"}
                          </span>
                        </div>

                        {/* 3. Caution Deposit Column - Prominently BEFORE Net! */}
                        <div className="bg-amber-50/90 p-2.5 rounded-xl border-2 border-amber-300 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                              ૩. ડિપોઝિટ (Deposit)
                            </span>
                            {customDeposit !== null && (
                              <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold">
                                કસ્ટમ
                              </span>
                            )}
                          </div>
                          <span className="text-sm sm:text-base font-black text-amber-950 tabular-nums block mt-0.5">
                            ₹{effectiveDeposit.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                            રીફંડેબલ ડિપોઝિટ
                          </span>
                        </div>

                        {/* 4. Net Column - After Deposit! */}
                        <div className="bg-gradient-to-br from-amber-100 via-amber-200/80 to-amber-300/60 p-2.5 rounded-xl border-2 border-amber-400 shadow-xs">
                          <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block">
                            ૪. ચૂકવવાપાત્ર નેટ (Net)
                          </span>
                          <span className="text-base sm:text-lg font-black text-red-950 tabular-nums block mt-0.5">
                            ₹{netPayableWithDeposit.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-amber-900 font-bold block mt-0.5">
                            ભાડું + ડિપોઝિટ
                          </span>
                        </div>
                      </div>

                      {/* Detailed Step-by-Step Financial Breakdown Preview */}
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2 mt-2 shadow-2xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>કુલ મૂળ સુવિધા ભાડું (Total Base Rent - {bookingItems.length} Bookings):</span>
                          <span className="font-bold text-slate-800">
                            ₹{totalFacilityRent.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {totalDiscountAmount > 0 && (
                          <div className="flex justify-between items-center text-emerald-700 font-semibold">
                            <span>ડિસ્કાઉન્ટ (Discount {currentDiscountPercent}%):</span>
                            <span>- ₹{totalDiscountAmount.toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        {totalServicesAmount > 0 && (
                          <div className="flex justify-between items-center text-blue-700 font-semibold">
                            <span>વધારાની સેવાઓ (Add-on Services Total):</span>
                            <span>+ ₹{totalServicesAmount.toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-slate-700 font-bold pt-1 border-t border-slate-100">
                          <span>કુલ સુવિધા ભાડું (Total Facility Rent):</span>
                          <span className="text-slate-900">
                            ₹{finalTotalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Caution Deposit Row - Explicitly Placed BEFORE NET */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-300">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-amber-950">
                              🛡️ પરત મળવાપાત્ર ડિપોઝિટ (Refundable Caution Deposit):
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline">(નેટ પહેલાં)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-900">₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={customDeposit !== null ? customDeposit : totalDepositAmount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCustomDeposit(val === "" ? 0 : Number(val));
                                }}
                                className="w-28 pl-6 pr-2 py-1 text-xs font-black bg-white border border-amber-400 rounded-lg text-amber-950 outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="ડિપોઝિટ"
                              />
                            </div>
                            {customDeposit !== null && (
                              <button
                                type="button"
                                onClick={() => setCustomDeposit(null)}
                                title="સ્વચાલિત ડિપોઝિટ પર ફરી સેટ કરો"
                                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                              >
                                રીસેટ
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Final Net Payable Row */}
                        <div className="flex justify-between items-center text-slate-900 font-black text-sm pt-2.5 border-t-2 border-slate-300 bg-gradient-to-r from-red-50/50 via-amber-50/50 to-transparent p-2.5 rounded-xl">
                          <div>
                            <span className="text-slate-900 font-black text-sm block">
                              કુલ ચૂકવવાપાત્ર નેટ રકમ (Net Payable Amount):
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal block">
                              (સુવિધા ભાડું ₹{finalTotalAmount.toLocaleString("en-IN")} + ડિપોઝિટ ₹{effectiveDeposit.toLocaleString("en-IN")})
                            </span>
                          </div>
                          <span className="text-red-900 text-lg font-black font-mono">
                            ₹{netPayableWithDeposit.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 6: Payment Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ચૂકવણી સ્થિતિ (Payment Status)
                        </label>
                        <select
                          value={formData.paymentStatus}
                          onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold outline-none"
                        >
                          <option value="PENDING">🟡 ચૂકવણી બાકી (Pending / Unpaid)</option>
                          <option value="PAID_CASH">🟢 પૂર્ણ રોકડ ચુકવણી (Paid Cash)</option>
                          <option value="PAID_ONLINE">🟢 પૂર્ણ ઓનલાઇન ચુકવણી (Paid Online)</option>
                          <option value="PARTIAL">🟡 આંશિક ચુકવણી (Partial)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ચૂકવણી પદ્ધતિ (Payment Method)
                        </label>
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold outline-none"
                        >
                          <option value="CASH_AT_OFFICE">Cash at Office (રોકડ)</option>
                          <option value="CHEQUE">Cheque (ચેક)</option>
                          <option value="OFFLINE_UPI">Offline UPI / QR</option>
                          <option value="NEFT_RTGS">NEFT / Bank Transfer</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          રસીદ / ચેક / UTR રેફરન્સ (Receipt Reference)
                        </label>
                        <input
                          type="text"
                          placeholder="દા.ત. REC-2026-001 અથવા Cheque No."
                          value={formData.paymentRefNo}
                          onChange={(e) => setFormData({ ...formData, paymentRefNo: e.target.value })}
                          className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  {/* End of Right Column (lg:col-span-7) */}

                </div>
              </div>
              {/* End of Scrollable 2-Column Body */}

              {/* Modal Sticky Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 shadow-lg">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold px-2.5 py-1 rounded-lg bg-red-100 text-red-900 border border-red-200">
                    📅 {selectedDates.length} તારીખ
                  </span>
                  <span className="font-extrabold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800">
                    🏢 {Array.from(new Set(bookingItems.map((it) => it.facilityId))).length} સુવિધા
                  </span>
                  <span className="font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300">
                    ભાડું: ₹{finalTotalAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="font-extrabold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                    🛡️ ડિપોઝિટ: ₹{effectiveDeposit.toLocaleString("en-IN")}
                  </span>
                  <span className="font-black text-red-900 text-sm ml-1 bg-red-50 px-3 py-1 rounded-lg border border-red-200 shadow-2xs">
                    નેટ રકમ: ₹{netPayableWithDeposit.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="bg-slate-50 border border-slate-200/90 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-[0.98] text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel (રદ કરો)
                  </button>
                  <button
                    type="submit"
                    disabled={
                      creating ||
                      hasAnyConflict ||
                      bookingItems.length === 0 ||
                      selectedDates.length === 0
                    }
                    className="group bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] border border-blue-400/30 transition-all duration-200 cursor-pointer flex items-center gap-2"
                  >
                    {creating ? (
                      "બુકિંગ સેવ થઈ રહ્યું છે..."
                    ) : (
                      <>
                        <span className="w-4 h-4 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center shadow-2xs transition-all">
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        </span>
                        <span>
                          {bookingItems.length > 1
                            ? `તમામ ${bookingItems.length} બુકિંગ કન્ફર્મ કરો (Confirm & Book ${bookingItems.length} Entries)`
                            : "બુકિંગ કન્ફર્મ કરો (Confirm & Save Booking)"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Senior-Friendly Delete Confirmation Modal with Smart Delete (Party Matching) */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border-2 border-red-200 space-y-5 text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-red-200">
              <Trash2 className="w-8 h-8 sm:w-10 sm:h-10 text-red-700 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs sm:text-sm font-extrabold text-red-800 uppercase tracking-wider bg-red-50 px-3 py-1 rounded-full border border-red-200 inline-block">
                બુકિંગ રદ કરવાની ખાતરી (Cancel & Delete Booking)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight pt-1">
                શું તમે આ બુકિંગ રદ કરવા માંગો છો?
              </h2>
              <p className="text-sm sm:text-base font-semibold text-slate-600">
                Cancel Booking for{" "}
                <span className="font-extrabold text-slate-950 underline decoration-red-400">
                  {bookingToDelete.customerName}
                </span>{" "}
                ({bookingToDelete.customerPhone})?
              </p>
            </div>

            {/* Smart Linking & Delete Options if Multiple Bookings Belong to this Party */}
            {relatedDeleteBookings.length > 0 ? (
              <div className="space-y-3 text-left">
                {/* Smart Linking Banner */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                        ⚡
                      </span>
                      <div>
                        <span className="font-black text-amber-950 text-xs sm:text-sm block">
                          સ્માર્ટ લિંકિંગ: આ અરજદારના અન્ય {relatedDeleteBookings.length} સંબંધિત બુકિંગ્સ શોધાયા!
                        </span>
                        <span className="text-[10px] text-amber-800 font-semibold block">
                          આ જ અરજદાર / ફોન નંબર ({bookingToDelete.customerPhone}) સાથે જોડાયેલા કુલ {relatedDeleteBookings.length + 1} બુકિંગ્સ છે.
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
                      કુલ {relatedDeleteBookings.length + 1} બુકિંગ્સ
                    </span>
                  </div>

                  {/* Mode Selector: Smart Delete vs Manual Delete */}
                  <div className="space-y-2 pt-1">
                    {/* Option 1: Smart Delete All */}
                    <label
                      onClick={() => setDeleteMode("SMART_ALL")}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition shadow-2xs ${
                        deleteMode === "SMART_ALL"
                          ? "bg-red-50/90 border-red-500 ring-2 ring-red-400/40"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "SMART_ALL"}
                        onChange={() => setDeleteMode("SMART_ALL")}
                        className="w-5 h-5 text-red-600 mt-0.5 focus:ring-red-500 cursor-pointer shrink-0"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-1.5 font-black text-slate-950">
                          <span>⚡ સ્માર્ટ ડીલીટ (Smart Delete)</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-800 font-bold rounded-full">
                            સૂચિત
                          </span>
                        </div>
                        <span className="font-bold text-red-900 block mt-0.5">
                          આ અરજદારના તમામ {relatedDeleteBookings.length + 1} બુકિંગ્સ એકસાથે રદ કરો
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          (એક-એક કરીને ડિલીટ કરવાની જરૂર નથી — એક જ ક્લિકથી આ પાર્ટીના તમામ બુકિંગ્સ રદ થઈ સ્લોટ્સ ખાલી થશે)
                        </span>
                      </div>
                    </label>

                    {/* Option 2: Manual Single Delete */}
                    <label
                      onClick={() => setDeleteMode("SINGLE")}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition shadow-2xs ${
                        deleteMode === "SINGLE"
                          ? "bg-slate-100/90 border-slate-600 ring-2 ring-slate-400/40"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "SINGLE"}
                        onChange={() => setDeleteMode("SINGLE")}
                        className="w-5 h-5 text-slate-700 mt-0.5 focus:ring-slate-500 cursor-pointer shrink-0"
                      />
                      <div className="text-xs">
                        <span className="font-black text-slate-950 block">
                          🗑️ મેન્યુઅલ ડીલીટ (Manual Single Delete)
                        </span>
                        <span className="font-bold text-slate-700 block mt-0.5">
                          માત્ર આ એક જ બુકિંગ (#{bookingToDelete.bookingNumber}) રદ કરો
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          (બાકીના અન્ય {relatedDeleteBookings.length} બુકિંગ્સ સુરક્ષિત રહેશે)
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Chips of Related Bookings */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                      {deleteMode === "SMART_ALL"
                        ? `આ તમામ ${relatedDeleteBookings.length + 1} બુકિંગ્સ રદ થશે:`
                        : "સંબંધિત અન્ય બુકિંગ નંબરો (યથાવત રહેશે):"}
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      <span className="text-[10px] font-mono font-bold text-red-950 bg-white border border-red-300 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                        <span>{bookingToDelete.bookingNumber}</span>
                        <span className="font-sans font-semibold text-red-700">
                          ({bookingToDelete.facilityName || bookingToDelete.facility?.name || "Facility"} • હાલનું)
                        </span>
                      </span>
                      {relatedDeleteBookings.map((rb: any) => (
                        <span
                          key={rb.id}
                          className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 bg-white border ${
                            deleteMode === "SMART_ALL"
                              ? "text-red-900 border-red-200"
                              : "text-slate-700 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              deleteMode === "SMART_ALL" ? "bg-red-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{rb.bookingNumber}</span>
                          <span className="font-sans font-normal text-slate-600">
                            ({rb.facility?.name || rb.facilityName || "Facility"} •{" "}
                            {new Date(rb.startDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                            )
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Booking Card when no related bookings exist */
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-left space-y-2 text-sm sm:text-base">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold text-xs sm:text-sm">બુકિંગ નંબર (No):</span>
                  <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                    {bookingToDelete.bookingNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold text-xs sm:text-sm">સુવિધા (Facility):</span>
                  <span className="font-bold text-slate-900 text-right max-w-[240px] truncate">
                    {bookingToDelete.facilityName || bookingToDelete.facility?.name || "Facility"}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold text-xs sm:text-sm">તારીખ (Event Date):</span>
                  <span className="font-black text-red-950">
                    {new Date(bookingToDelete.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold text-xs sm:text-sm">મોબાઇલ (Phone):</span>
                  <span className="font-mono font-bold text-slate-900">{bookingToDelete.customerPhone}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 font-medium">
              નોંધ: રદ કર્યા પછી પસંદ કરેલ તારીખો ફરીથી બીજા લોકો માટે ખાલી (Open) થઈ જશે.
            </p>

            {/* Big Chunky Action Buttons for Elders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={() => {
                  setBookingToDelete(null);
                  setRelatedDeleteBookings([]);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                <CheckCircle className="w-5 h-5 text-emerald-200" />
                <span>રાખો (Keep Booking)</span>
              </button>

              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={() => confirmDeleteBooking()}
                className="w-full py-3.5 px-4 rounded-2xl bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                {isDeletingBooking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>રદ થઈ રહ્યું છે...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 text-red-200" />
                    <span>
                      {deleteMode === "SMART_ALL" && relatedDeleteBookings.length > 0
                        ? `⚡ તમામ ${relatedDeleteBookings.length + 1} બુકિંગ્સ રદ કરો (Smart Delete)`
                        : "રદ કરો (Yes, Delete)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Senior-Friendly Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border-2 border-red-200 space-y-5 text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-red-200">
              <Trash2 className="w-8 h-8 sm:w-10 sm:h-10 text-red-700 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs sm:text-sm font-extrabold text-red-800 uppercase tracking-wider bg-red-50 px-3 py-1 rounded-full border border-red-200 inline-block">
                મલ્ટીપલ બુકિંગ રદ કરવાની ખાતરી (Bulk Delete Confirmation)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight pt-1">
                શું તમે પસંદ કરેલ તમામ {selectedBookingIds.length} બુકિંગ્સ રદ કરવા માંગો છો?
              </h2>
              <p className="text-sm sm:text-base font-semibold text-slate-600">
                Are you sure you want to permanently delete all{" "}
                <span className="font-extrabold text-red-900 underline decoration-red-400">
                  {selectedBookingIds.length}
                </span>{" "}
                selected bookings?
              </p>
            </div>

            {/* Selected Bookings List */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-left max-h-56 overflow-y-auto divide-y divide-slate-200">
              {bookings
                .filter((b) => selectedBookingIds.includes(b.id))
                .map((b) => (
                  <div key={b.id} className="py-2 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-red-900 mr-2">
                        {b.bookingNumber}
                      </span>
                      <span className="font-bold text-slate-900">{b.customerName}</span>
                      <span className="text-slate-500 block text-[11px] truncate">
                        {b.facilityName || b.facility?.name} •{" "}
                        {new Date(b.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        • {b.slot}
                      </span>
                    </div>
                    <span className="font-black text-slate-900 text-xs shrink-0">
                      ₹{(b.totalAmount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
            </div>

            <p className="text-xs text-slate-500 font-medium">
              નોંધ: આ {selectedBookingIds.length} બુકિંગ્સ રદ કર્યા પછી સંબંધિત તમામ તારીખો ફરીથી અન્ય લોકો માટે ખાલી (Open) થઈ જશે.
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                <CheckCircle className="w-5 h-5 text-emerald-200" />
                <span>ના, રહેવા દો (Keep All)</span>
              </button>

              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={confirmBulkDeleteBookings}
                className="w-full py-3.5 px-4 rounded-2xl bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                <Trash2 className="w-5 h-5 text-red-200" />
                <span>
                  {isBulkDeleting
                    ? "રદ થઈ રહ્યું છે..."
                    : `હા, તમામ ${selectedBookingIds.length} બુકિંગ કાઢી નાખો`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Interactive Clock Modal for Custom Timings (સમાજ સમયપત્રક મુજબ) */}
      <InteractiveClockModal
        isOpen={clockModalOpen}
        onClose={() => setClockModalOpen(false)}
        onAddSlot={handleClockAddSlot}
        dateStr={clockModalDate}
        facilityName={clockModalFacName}
      />
    </div>
  );
}
