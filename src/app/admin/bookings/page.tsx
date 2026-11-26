"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchAdminJson, getAdminCachedData } from "@/lib/admin-client-cache";
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
} from "@/lib/slotUtils";
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
  const [currentUser, setCurrentUser] = useState<any>(null);
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
  const [formData, setFormData] = useState({
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
    paymentStatus: "PAID_CASH",
    paymentMethod: "CASH_AT_OFFICE",
    paymentRefNo: "",
    notes: "",
  });

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

  // Export State
  const [exporting, setExporting] = useState(false);
  const bookingsRefresh = useRef<Promise<void> | null>(null);
  const facilitiesRefresh = useRef<Promise<void> | null>(null);

  // Senior-Friendly Delete Modal State
  const [bookingToDelete, setBookingToDelete] = useState<any | null>(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Pagination State (Fast 25/50/100 records per page to eliminate DOM lag)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Open and Close Modal Helpers with URL Cleanup
  const openNewBookingModal = (dateParam?: string | null, facParam?: string | null) => {
    setCreateError("");
    setShowCreateModal(true);
    setDateCopySuccess(false);
    const dStr = dateParam || new Date().toISOString().split("T")[0];
    setSelectedDates([dStr]);
    setActiveDate(dStr);
    setFormData((prev) => ({
      ...prev,
      startDate: dStr,
      endDate: dStr,
    }));
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
  }, [searchParams]);

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
    const cachedBookings = getAdminCachedData<any>("/api/bookings");
    const cachedFacilities = getAdminCachedData<any>("/api/facilities");
    const cachedDiscounts = getAdminCachedData<any>("/api/discounts");
    const cachedServices = getAdminCachedData<any>("/api/services");
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
      const [userRes, bookData, facData, discData, servData] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetchAdminJson<any>("/api/bookings"),
        fetchAdminJson<any>("/api/facilities"),
        fetchAdminJson<any>("/api/discounts"),
        fetchAdminJson<any>("/api/services"),
      ]);
      const uData = userRes.ok ? await userRes.json() : { user: null };

      if (uData?.user) {
        setCurrentUser(uData.user);
      }

      if (bookData?.bookings) setBookings(bookData.bookings);
      if (facData?.facilities) {
        setFacilities(facData.facilities);
      }
      if (discData?.discounts) setDiscounts(discData.discounts);
      if (servData?.services) setServices(servData.services);
    } catch (err) {
      console.error(err);
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
    setDateTimingScopeMap((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (d !== sourceDateStr) next[d] = sourceScope;
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
    if (dateMap && dateMap["__ALL__"] && dateMap["__ALL__"].length > 0) {
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
      const current = (dateMap["__ALL__"] && dateMap["__ALL__"].length > 0)
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
      const current = (dateMap["__ALL__"] && dateMap["__ALL__"].length > 0)
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
      const current = (dateMap["__ALL__"] && dateMap["__ALL__"].length > 0)
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
    if (dateMap && dateMap[facId] !== undefined && dateMap[facId].length > 0) {
      return dateMap[facId];
    }
    if (dateMap && dateMap["__ALL__"] && dateMap["__ALL__"].length > 0) {
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
      const currentSlots = dateMap[facId] !== undefined ? dateMap[facId] : (dateMap["__ALL__"] || [WHOLE_DAY_SLOT_LABEL]);
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
      const currentSlots = dateMap[facId] !== undefined ? dateMap[facId] : (dateMap["__ALL__"] || [WHOLE_DAY_SLOT_LABEL]);
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
    }> = [];

    for (const dateStr of selectedDates) {
      const facIdsForDate = dateFacilityMap[dateStr] || [];
      const timingsForDate = dateTimeTimingMap[dateStr] || {};

      for (const facId of facIdsForDate) {
        const fac = facilities.find((f) => f.id === facId);
        if (!fac) continue;

        let baseRent = fac.baseRent || 0;
        if (fac.code === "PLOT-OUTSIDE" || fac.type === "PLOT") {
          const dtPurpose = datePlotPurposeMap[dateStr] || plotPurpose;
          baseRent =
            dtPurpose === "WEDDING"
              ? fac.weddingRent || fac.baseRent || 0
              : fac.familyRent || fac.baseRent || 0;
        }
        const cautionDeposit = fac.cautionDeposit || 0;

        const facSlots =
          timingsForDate[facId] && timingsForDate[facId].length > 0
            ? timingsForDate[facId]
            : timingsForDate["__ALL__"] && timingsForDate["__ALL__"].length > 0
              ? timingsForDate["__ALL__"]
              : selectedTimings.length > 0
                ? selectedTimings
                : [WHOLE_DAY_SLOT_LABEL];

        for (const slotLabel of facSlots) {
          const isFull = isFullDaySlot(slotLabel);
          const endDateStr = isFull ? getNextDateStr(dateStr) || dateStr : dateStr;

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

          items.push({
            facilityId: fac.id,
            facilityName: fac.name,
            facilityCode: fac.code,
            facilityType: fac.type,
            resourceGroup: fac.resourceGroup,
            startDate: dateStr,
            endDate: endDateStr,
            slot: slotLabel,
            baseRent,
            cautionDeposit,
            conflict: conflictInfo,
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
    return uniqueFacilityIds.reduce((acc, id) => {
      const fac = facilities.find((f) => f.id === id);
      return acc + (fac?.cautionDeposit || 0);
    }, 0);
  }, [bookingItems, facilities]);

  const finalTotalAmount = useMemo(() => {
    return Math.max(0, totalFacilityRent - totalDiscountAmount) + totalServicesAmount;
  }, [totalFacilityRent, totalDiscountAmount, totalServicesAmount]);

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

    const preparedItems = bookingItems.map((item) => ({
      facilityId: item.facilityId,
      startDate: item.startDate,
      endDate: item.endDate,
      slot: item.slot,
      facilityAmount: item.baseRent,
      depositAmount: item.cautionDeposit,
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
          depositAmount: totalDepositAmount,
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

  const handleDeleteClick = (b: any) => {
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to cancel or delete bookings.");
      return;
    }
    setBookingToDelete(b);
  };

  const confirmDeleteBooking = async (id: string) => {
    // Optimistic instant removal: row disappears in 0ms without waiting for network
    const previousBookings = [...bookings];
    setBookings((prev) => prev.filter((b) => b.id !== id));
    if (detailBooking?.id === id) {
      setDetailBooking(null);
    }
    setBookingToDelete(null);

    try {
      const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        // Revert on failure
        setBookings(previousBookings);
        alert(err.error || "Failed to delete booking");
      } else {
        refreshBookings();
      }
    } catch (err) {
      // Revert on network failure
      setBookings(previousBookings);
      console.error(err);
      alert("Network error: Could not delete booking.");
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
              className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg shadow-sm transition flex items-center"
              title="Download CSV export of bookings"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {exporting ? "Exporting CSV..." : "Export CSV"}
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => openNewBookingModal()}
              className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Booking
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
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${categoryFilter === tab.id
                    ? "bg-red-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                className="text-xs font-bold text-red-800 hover:text-red-950 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition"
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
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${facilityFilter === "ALL"
                ? "bg-slate-800 text-white font-bold"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${isSelected
                      ? "bg-red-800 text-white font-bold shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-4 py-2 text-xs font-black rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>પસંદ કરેલ {selectedBookingIds.length} બુકિંગ કાઢી નાખો (Delete Selected)</span>
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
                      <td className="py-3 px-4 font-extrabold text-red-900 whitespace-nowrap">
                        <button
                          onClick={() => setDetailBooking(b)}
                          className="hover:underline flex items-center"
                          title="Click to view full reservation details"
                        >
                          {b.bookingNumber}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <div>{b.facility?.name}</div>
                        <span className="text-[10px] text-amber-800 font-normal">
                          {b.facility?.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          {b.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{b.eventType}</div>
                        <div className="text-[10px] text-slate-500 font-bold">{b.slot}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {new Date(b.startDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          ₹{b.totalAmount.toLocaleString("en-IN")}
                        </div>
                        {b.discountPercent > 0 && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Discount: -₹{b.discountAmount.toLocaleString("en-IN")} ({b.discountPercent}%)
                          </div>
                        )}
                        {b.servicesAmount > 0 && (
                          <div className="text-[10px] text-blue-700 font-semibold">
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
                          title="View Full Booking Details"
                          className="inline-flex items-center text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300 transition"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Details
                        </button>

                        <Link
                          href={`/admin/bookings/${b.id}/receipt`}
                          target="_blank"
                          title="Print Official Slip"
                          className="inline-flex items-center text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300 transition"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          Slip
                        </Link>

                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeleteClick(b)}
                            title="Cancel & Delete Booking"
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                      className="flex-1 py-2 px-3 text-xs font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl border border-slate-300 transition flex items-center justify-center min-h-[40px]"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                      Details
                    </button>
                    <Link
                      href={`/admin/bookings/${b.id}/receipt`}
                      target="_blank"
                      className="flex-1 py-2 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded-xl transition flex items-center justify-center min-h-[40px] shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1.5" />
                      Print Slip
                    </Link>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteClick(b)}
                        className="p-2 text-slate-400 hover:text-rose-600 active:text-rose-700 rounded-xl border border-slate-200 min-h-[40px] min-w-[40px] flex items-center justify-center"
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
                    <div className="font-bold text-slate-900 text-sm">{detailBooking.facility?.name}</div>
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
                <Link
                  href={`/admin/bookings/${detailBooking.id}/receipt`}
                  target="_blank"
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Official Slip
                </Link>
                <button
                  onClick={() => setDetailBooking(null)}
                  className="text-xs font-semibold px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
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

                        {/* Single vs Multi-Date Mode Toggle */}
                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setDateSelectionMode("SINGLE");
                              if (selectedDates.length > 1) {
                                setSelectedDates([selectedDates[0]]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded transition cursor-pointer ${dateSelectionMode === "SINGLE"
                              ? "bg-red-800 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                              }`}
                            title="એક તારીખ પસંદગી મોડ (Single Date Mode)"
                          >
                            ૧ તારીખ
                          </button>
                          <button
                            type="button"
                            onClick={() => setDateSelectionMode("MULTIPLE")}
                            className={`px-2 py-0.5 rounded transition cursor-pointer ${dateSelectionMode === "MULTIPLE"
                              ? "bg-red-800 text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
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

                      {/* Quick Date Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            const tStr = new Date().toISOString().split("T")[0];
                            if (dateSelectionMode === "SINGLE") setSelectedDates([tStr]);
                            else addDate(tStr);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                        >
                          + આજે (Today)
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(1)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                        >
                          + આવતીકાલ
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(2)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                        >
                          + ૨ દિવસ
                        </button>
                        <button
                          type="button"
                          onClick={() => addRelativeDays(3)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                        >
                          + ૩ દિવસ
                        </button>
                        {selectedDates.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDates([])}
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer ml-auto"
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
                            <span className="font-bold text-slate-700">
                              ₹{totalFacilityRent.toLocaleString("en-IN")}
                            </span>
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
                          <input
                            type="text"
                            required
                            placeholder="Wedding, Sagai, Birthday..."
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
                                        const currentRent =
                                          dtPlotPurpose === "WEDDING"
                                            ? fac.weddingRent || fac.baseRent || 0
                                            : fac.familyRent || fac.baseRent || 0;
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
                                                  {dtPlotPurpose === "WEDDING" ? "Wedding Tariff" : "Family Tariff"}
                                                </span>
                                              </div>
                                            </label>

                                            {/* Outside Party Plot Purpose Selector for this Date */}
                                            {isChecked && (
                                              <div className="mt-2.5 pt-2.5 border-t border-red-200/60 bg-white/80 p-2 rounded-lg space-y-1.5">
                                                <span className="text-[10px] font-bold text-amber-950 block">
                                                  આ તારીખ માટે પાર્ટી પ્લોટ ઉપયોગનો પ્રકાર:
                                                </span>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                  <button
                                                    type="button"
                                                    onClick={() => setDatePlotPurpose(dateStr, "WEDDING")}
                                                    className={`p-1.5 rounded-lg border text-left transition cursor-pointer ${dtPlotPurpose === "WEDDING"
                                                      ? "bg-red-800 text-white border-red-900 shadow-xs"
                                                      : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                                                      }`}
                                                  >
                                                    <div className="font-bold text-[11px]">💍 Wedding Function (લગ્ન)</div>
                                                    <div className="text-[10px] opacity-90">
                                                      ₹{(fac.weddingRent || fac.baseRent || 0).toLocaleString("en-IN")}
                                                    </div>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => setDatePlotPurpose(dateStr, "FAMILY")}
                                                    className={`p-1.5 rounded-lg border text-left transition cursor-pointer ${dtPlotPurpose === "FAMILY"
                                                      ? "bg-red-800 text-white border-red-900 shadow-xs"
                                                      : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                                                      }`}
                                                  >
                                                    <div className="font-bold text-[11px]">👨‍👩‍👧‍👦 Family Function (પારિવારિક)</div>
                                                    <div className="text-[10px] opacity-90">
                                                      ₹{(fac.familyRent || fac.baseRent || 0).toLocaleString("en-IN")}
                                                    </div>
                                                  </button>
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
                                                    {fac.capacity} Persons
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <span className="text-xs font-black text-slate-800 block">
                                                  {fac.baseRent > 0 ? `₹${fac.baseRent.toLocaleString("en-IN")}` : "Rate Pending"}
                                                </span>
                                              </div>
                                            </label>
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
                                                  {fac.baseRent > 0 ? `₹${fac.baseRent.toLocaleString("en-IN")}` : "Rate Pending"}
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
                                                  {fac.baseRent > 0 ? `₹${fac.baseRent.toLocaleString("en-IN")}` : "Rate Pending"}
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
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                                      {dtTimings.length} સ્લોટ પસંદ
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
                                      <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-blue-950 flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-blue-700" />
                                          ૨. ચોક્કસ કસ્ટમ સમય ઉમેરો:
                                        </span>
                                        {/* Presets */}
                                        <div className="flex flex-wrap items-center gap-1">
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
                                              <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                                {currentSlots.length} સ્લોટ
                                              </span>
                                            </div>

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

                                            {/* Custom Timing Dropdowns for this Facility */}
                                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                                              <span className="text-[10px] font-bold text-blue-950 flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-blue-700" />
                                                ચોક્કસ સમય:
                                              </span>
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

                      {/* Financial Breakdown Preview */}
                      <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5 mt-2">
                        <div className="flex justify-between text-slate-600">
                          <span>કુલ મૂળ સુવિધા ભાડું (Total Base Rent - {bookingItems.length} Bookings):</span>
                          <span className="font-semibold text-slate-800">
                            ₹{totalFacilityRent.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {totalDiscountAmount > 0 && (
                          <div className="flex justify-between text-emerald-700 font-semibold">
                            <span>ડિસ્કાઉન્ટ (Discount {currentDiscountPercent}%):</span>
                            <span>- ₹{totalDiscountAmount.toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        {totalServicesAmount > 0 && (
                          <div className="flex justify-between text-blue-700 font-semibold">
                            <span>વધારાની સેવાઓ (Add-on Services Total):</span>
                            <span>+ ₹{totalServicesAmount.toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                          <span>કુલ ચૂકવવાપાત્ર રકમ (Final Payable Amount):</span>
                          <span className="text-red-900 text-base">
                            ₹{finalTotalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>પરત મળવાપાત્ર ડિપોઝિટ (Refundable Caution Deposit):</span>
                          <span>₹{totalDepositAmount.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 6: Payment Method */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <span className="font-extrabold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                    ⏱️ {bookingItems.length} બુકિંગ
                  </span>
                  <span className="font-black text-slate-900 text-sm ml-1">
                    કુલ રકમ: ₹{finalTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
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
                    className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                  >
                    {creating ? (
                      "બુકિંગ સેવ થઈ રહ્યું છે..."
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
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
      {/* Senior-Friendly Delete Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-red-200 space-y-5 text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-red-200">
              <Trash2 className="w-8 h-8 sm:w-10 sm:h-10 text-red-700 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs sm:text-sm font-extrabold text-red-800 uppercase tracking-wider bg-red-50 px-3 py-1 rounded-full border border-red-200 inline-block">
                બુકિંગ રદ કરવાની ખાતરી (Cancel Booking)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight pt-1">
                શું તમે આ બુકિંગ રદ કરવા માંગો છો?
              </h2>
              <p className="text-sm sm:text-base font-semibold text-slate-600">
                Cancel Booking for <span className="font-extrabold text-slate-950 underline decoration-red-400">{bookingToDelete.customerName}</span>?
              </p>
            </div>

            {/* High-Contrast Info Card for Seniors */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-left space-y-2 text-sm sm:text-base">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold text-xs sm:text-sm">બુકિંગ નંબર (No):</span>
                <span className="font-mono font-black text-slate-900 text-sm sm:text-base">{bookingToDelete.bookingNumber}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold text-xs sm:text-sm">સુવિધા (Facility):</span>
                <span className="font-bold text-slate-900 text-right max-w-[240px] truncate">{bookingToDelete.facilityName}</span>
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

            <p className="text-xs text-slate-500 font-medium">
              નોંધ: રદ કર્યા પછી આ તારીખ ફરીથી બીજા લોકો માટે ખાલી (Open) થઈ જશે.
            </p>

            {/* Big Chunky Action Buttons for Elders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBookingToDelete(null)}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                <CheckCircle className="w-5 h-5 text-emerald-200" />
                <span>રાખો (Keep Booking)</span>
              </button>

              <button
                type="button"
                onClick={() => confirmDeleteBooking(bookingToDelete.id)}
                className="w-full py-3.5 px-4 rounded-2xl bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-extrabold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer min-h-[52px]"
              >
                <Trash2 className="w-5 h-5 text-red-200" />
                <span>રદ કરો (Yes, Delete)</span>
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
    </div>
  );
}
