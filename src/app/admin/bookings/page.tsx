"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
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
} from "lucide-react";

export default function BookingsManagementPage() {
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
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([
    new Date().toISOString().split("T")[0],
  ]);
  const [newDateInput, setNewDateInput] = useState<string>("");
  const [timingScope, setTimingScope] = useState<"SAME_ALL" | "CUSTOM_PER_FACILITY">("SAME_ALL");
  const [selectedTimings, setSelectedTimings] = useState<string[]>([WHOLE_DAY_SLOT_LABEL]);
  const [customStartTime, setCustomStartTime] = useState<string>("12:00 PM");
  const [customEndTime, setCustomEndTime] = useState<string>("02:00 PM");
  const [customSlotsList, setCustomSlotsList] = useState<string[]>([]);
  const [facilityTimingMap, setFacilityTimingMap] = useState<Record<string, string[]>>({});
  const [plotPurpose, setPlotPurpose] = useState<"WEDDING" | "FAMILY">("WEDDING");

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true") {
        setShowCreateModal(true);
        const dateParam = params.get("date");
        if (dateParam) {
          setSelectedDates([dateParam]);
          setFormData((prev) => ({
            ...prev,
            startDate: dateParam,
            endDate: dateParam,
          }));
        }
        const facParam = params.get("facilityId");
        if (facParam) {
          setSelectedFacilityIds([facParam]);
        }
      }
    }
    const refreshWhileVisible = () => {
      if (document.visibilityState === "visible") {
        refreshBookings();
        refreshFacilities();
      }
    };
    const refreshFacilitiesWhileVisible = () => {
      if (document.visibilityState === "visible") refreshFacilities();
    };
    const timer = window.setInterval(refreshWhileVisible, 5000);
    const facilitiesTimer = window.setInterval(refreshFacilitiesWhileVisible, 15000);
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
        if (facData.facilities.length > 0) {
          setSelectedFacilityIds((prev) => (prev.length > 0 ? prev : [facData.facilities[0].id]));
        }
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

  const toggleFacility = (facId: string) => {
    setSelectedFacilityIds((prev) =>
      prev.includes(facId) ? prev.filter((id) => id !== facId) : [...prev, facId]
    );
  };

  const selectAllRooms = () => {
    const roomIds = facilities.filter((f) => f.type === "ROOM").map((f) => f.id);
    setSelectedFacilityIds((prev) => Array.from(new Set([...prev, ...roomIds])));
  };

  const selectAllHalls = () => {
    const hallIds = facilities.filter((f) => f.type === "HALL").map((f) => f.id);
    setSelectedFacilityIds((prev) => Array.from(new Set([...prev, ...hallIds])));
  };

  const selectAllDorms = () => {
    const dormIds = facilities.filter((f) => f.type === "DORMITORY").map((f) => f.id);
    setSelectedFacilityIds((prev) => Array.from(new Set([...prev, ...dormIds])));
  };

  const selectAllFacilities = () => {
    setSelectedFacilityIds(facilities.map((f) => f.id));
  };

  const clearAllFacilities = () => {
    setSelectedFacilityIds([]);
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
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const removeDate = (dateStr: string) => {
    setSelectedDates((prev) => prev.filter((d) => d !== dateStr));
  };

  const addDate = (dateStr: string) => {
    if (!dateStr) return;
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) return prev;
      return [...prev, dateStr].sort();
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
    setSelectedDates((prev) => Array.from(new Set([...prev, ...newDates])).sort());
  };

  const toggleTimingSlot = (slotLabel: string) => {
    setSelectedTimings((prev) =>
      prev.includes(slotLabel)
        ? prev.filter((s) => s !== slotLabel)
        : [...prev, slotLabel]
    );
  };

  const addCustomSlot = (from: string, to: string) => {
    const customSlot = `${from} - ${to}`;
    if (!customSlotsList.includes(customSlot)) {
      setCustomSlotsList((prev) => [...prev, customSlot]);
    }
    if (!selectedTimings.includes(customSlot)) {
      setSelectedTimings((prev) => [...prev, customSlot]);
    }
  };

  const removeCustomSlot = (slotStr: string) => {
    setCustomSlotsList((prev) => prev.filter((s) => s !== slotStr));
    setSelectedTimings((prev) => prev.filter((s) => s !== slotStr));
  };

  const toggleFacilityCustomTiming = (facId: string, slotStr: string) => {
    setFacilityTimingMap((prev) => {
      const current =
        prev[facId] !== undefined
          ? prev[facId]
          : selectedTimings.length > 0
          ? [...selectedTimings]
          : [WHOLE_DAY_SLOT_LABEL];
      const updated = current.includes(slotStr)
        ? current.filter((s) => s !== slotStr)
        : [...current, slotStr];
      return { ...prev, [facId]: updated };
    });
  };

  const addFacilityCustomTimingSlot = (facId: string, from: string, to: string) => {
    const slotStr = `${from} - ${to}`;
    setFacilityTimingMap((prev) => {
      const current =
        prev[facId] !== undefined
          ? prev[facId]
          : selectedTimings.length > 0
          ? [...selectedTimings]
          : [WHOLE_DAY_SLOT_LABEL];
      if (current.includes(slotStr)) return prev;
      return { ...prev, [facId]: [...current, slotStr] };
    });
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

  // Real-time Cross-Product Generator & Multi-Conflict Checker
  const bookingItems = useMemo(() => {
    if (selectedFacilityIds.length === 0 || selectedDates.length === 0) return [];

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

    for (const facId of selectedFacilityIds) {
      const fac = facilities.find((f) => f.id === facId);
      if (!fac) continue;

      let baseRent = fac.baseRent || 0;
      if (fac.code === "PLOT-OUTSIDE" || fac.type === "PLOT") {
        baseRent =
          plotPurpose === "WEDDING"
            ? fac.weddingRent || fac.baseRent || 0
            : fac.familyRent || fac.baseRent || 0;
      }
      const cautionDeposit = fac.cautionDeposit || 0;

      let timingsForFac: string[] = [];
      if (timingScope === "SAME_ALL") {
        timingsForFac = selectedTimings.length > 0 ? selectedTimings : [WHOLE_DAY_SLOT_LABEL];
      } else {
        const specific = facilityTimingMap[facId];
        timingsForFac =
          specific !== undefined
            ? specific
            : selectedTimings.length > 0
            ? selectedTimings
            : [WHOLE_DAY_SLOT_LABEL];
      }

      for (const dateStr of selectedDates) {
        for (const slotLabel of timingsForFac) {
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
    selectedFacilityIds,
    selectedDates,
    timingScope,
    selectedTimings,
    facilityTimingMap,
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

    if (selectedFacilityIds.length === 0) {
      setCreateError("કૃપા કરીને ઓછામાં ઓછી એક સુવિધા પસંદ કરો (Please select at least one facility).");
      return;
    }

    if (selectedDates.length === 0) {
      setCreateError("કૃપા કરીને ઓછામાં ઓછી એક તારીખ પસંદ કરો (Please select at least one date).");
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

      setShowCreateModal(false);
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

    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        refreshBookings();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update booking status");
      }
    } catch (err) {
      console.error(err);
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

  const selectedFacilityObj = facilities.find(
    (f) => f.id === (selectedFacilityIds[0] || formData.facilityId)
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
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isSuperAdmin ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"
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
              onClick={() => {
                setCreateError("");
                setShowCreateModal(true);
              }}
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
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
                    categoryFilter === tab.id
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
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                facilityFilter === "ALL"
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
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${
                      isSelected
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
            Showing <span className="text-slate-900 font-bold">{sortedBookings.length}</span> of {bookings.length} reservations
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
                        sortedBookings.length > 0 &&
                        sortedBookings.every((b) => selectedBookingIds.includes(b.id))
                      }
                      onChange={() => toggleSelectAll(sortedBookings.map((b) => b.id))}
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
              {sortedBookings.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
                    No booking records found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedBookings.map((b) => {
                  const isSelected = selectedBookingIds.includes(b.id);
                  return (
                    <tr
                      key={b.id}
                      className={`transition ${
                        isSelected
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
                          className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                            b.status === "CONFIRMED"
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
                          className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-md border ${
                            b.status === "CONFIRMED"
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
          {sortedBookings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No booking records found matching your filters.
            </div>
          ) : (
            sortedBookings.map((b) => {
              const isSelected = selectedBookingIds.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`p-3.5 sm:p-4 space-y-3 transition ${
                    isSelected ? "bg-red-50/80 border-l-4 border-l-red-600" : "bg-white hover:bg-slate-50/70"
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
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        b.status === "CONFIRMED"
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
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      detailBooking.status === "CONFIRMED"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-800 to-amber-900 text-white p-4 sm:p-5 flex items-center justify-between sticky top-0 z-20 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400 text-red-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Super Admin Only
                  </span>
                  <span className="text-xs text-amber-200 font-bold">
                    મલ્ટી-સુવિધા • મલ્ટી-તારીખ • મલ્ટી-સમય ચેકબોક્સ
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  નવું બુકિંગ નોંધણી (New Multi-Booking Entry)
                </h3>
                <p className="text-xs text-amber-100/90">
                  શ્રી સૌરાષ્ટ્ર પટેલ સમાજ, નિકોલ - નરોડા | અમદાવાદ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="m-4 sm:m-5 p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="p-4 sm:p-6 space-y-5">
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

              {/* SECTION 2: Facility Selection with Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <Building className="w-4 h-4 text-red-800" />
                      ૨. સુવિધાઓ પસંદ કરો (Select Facilities via Checkboxes) *
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                      {selectedFacilityIds.length} પસંદ
                    </span>
                  </div>

                  {/* Quick Shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={selectAllRooms}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      ✓ બધા એસી રૂમ (All Rooms)
                    </button>
                    <button
                      type="button"
                      onClick={selectAllHalls}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      ✓ બંને હોલ (Both Halls)
                    </button>
                    <button
                      type="button"
                      onClick={selectAllDorms}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      ✓ બધી ડોર્મિટરી
                    </button>
                    <button
                      type="button"
                      onClick={selectAllFacilities}
                      className="px-2 py-1 rounded-lg bg-red-800 text-white hover:bg-red-700 transition cursor-pointer"
                    >
                      બધું (All)
                    </button>
                    <button
                      type="button"
                      onClick={clearAllFacilities}
                      className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                    >
                      સાફ (Clear)
                    </button>
                  </div>
                </div>

                {/* Outside Party Plot */}
                {facilities.filter((f) => f.type === "PLOT").length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                      <span>🌿 આઉટસાઇડ પાર્ટી પ્લોટ (Outside Party Plot - Dual Pricing)</span>
                    </div>
                    {facilities
                      .filter((f) => f.type === "PLOT")
                      .map((fac) => {
                        const isChecked = selectedFacilityIds.includes(fac.id);
                        const currentRent =
                          plotPurpose === "WEDDING"
                            ? fac.weddingRent || fac.baseRent || 0
                            : fac.familyRent || fac.baseRent || 0;
                        return (
                          <div
                            key={fac.id}
                            className={`p-3 rounded-xl border-2 transition ${
                              isChecked
                                ? "border-red-600 bg-red-50/50 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <label className="flex items-start justify-between gap-3 cursor-pointer">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFacility(fac.id)}
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
                                  {plotPurpose === "WEDDING" ? "Wedding Tariff" : "Family Tariff"}
                                </span>
                              </div>
                            </label>

                            {/* Outside Party Plot Purpose Selector */}
                            {isChecked && (
                              <div className="mt-3 pt-3 border-t border-red-200/60 bg-white/80 p-2.5 rounded-lg space-y-2">
                                <span className="text-[11px] font-bold text-amber-950 block">
                                  પાર્ટી પ્લોટ ઉપયોગનો પ્રકાર (Select Purpose & Tariff):
                                </span>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => handlePlotPurposeChange("WEDDING")}
                                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                                      plotPurpose === "WEDDING"
                                        ? "bg-red-800 text-white border-red-900 shadow-xs"
                                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    <div className="font-bold">💍 Wedding Function (લગ્ન પ્રસંગ)</div>
                                    <div className="text-[11px] opacity-90 mt-0.5">
                                      {fac.weddingRent && fac.weddingRent > 0
                                        ? `₹${fac.weddingRent.toLocaleString("en-IN")}`
                                        : "Rate Pending"}
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handlePlotPurposeChange("FAMILY")}
                                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                                      plotPurpose === "FAMILY"
                                        ? "bg-red-800 text-white border-red-900 shadow-xs"
                                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    <div className="font-bold">👨‍👩‍👧‍👦 Family Function (પારિવારિક)</div>
                                    <div className="text-[11px] opacity-90 mt-0.5">
                                      {fac.familyRent && fac.familyRent > 0
                                        ? `₹${fac.familyRent.toLocaleString("en-IN")}`
                                        : "Rate Pending"}
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

                {/* Community Halls */}
                {facilities.filter((f) => f.type === "HALL").length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      🏛️ કોમ્યુનિટી હોલ (Community Halls)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {facilities
                        .filter((f) => f.type === "HALL")
                        .map((fac) => {
                          const isChecked = selectedFacilityIds.includes(fac.id);
                          return (
                            <label
                              key={fac.id}
                              className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition cursor-pointer ${
                                isChecked
                                  ? "border-red-600 bg-red-50/50 shadow-xs"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFacility(fac.id)}
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

                {/* Dormitories */}
                {facilities.filter((f) => f.type === "DORMITORY").length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      🛏️ ડોર્મિટરી (Dormitories)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {facilities
                        .filter((f) => f.type === "DORMITORY")
                        .map((fac) => {
                          const isChecked = selectedFacilityIds.includes(fac.id);
                          return (
                            <label
                              key={fac.id}
                              className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition cursor-pointer ${
                                isChecked
                                  ? "border-red-600 bg-red-50/50 shadow-xs"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFacility(fac.id)}
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

                {/* AC Guest Rooms */}
                {facilities.filter((f) => f.type === "ROOM").length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>🚪 એસી ગેસ્ટ રૂમ (AC Guest Rooms)</span>
                      <button
                        type="button"
                        onClick={selectAllRooms}
                        className="text-[10px] text-red-800 hover:underline font-bold cursor-pointer"
                      >
                        ✓ બધા ૩ રૂમ પસંદ કરો
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {facilities
                        .filter((f) => f.type === "ROOM")
                        .map((fac) => {
                          const isChecked = selectedFacilityIds.includes(fac.id);
                          return (
                            <label
                              key={fac.id}
                              className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition cursor-pointer ${
                                isChecked
                                  ? "border-red-600 bg-red-50/50 shadow-xs"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFacility(fac.id)}
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

              {/* SECTION 3: Event Dates Selection with Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <Calendar className="w-4 h-4 text-red-800" />
                      ૩. પ્રસંગની તારીખો પસંદ કરો (Select Event Dates via Checkboxes) *
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                      {selectedDates.length} તારીખ પસંદ
                    </span>
                  </div>

                  {/* Quick Day Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => addDate(new Date().toISOString().split("T")[0])}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      + આજે (Today)
                    </button>
                    <button
                      type="button"
                      onClick={() => addRelativeDays(1)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      + આવતીકાલ (Next Day)
                    </button>
                    <button
                      type="button"
                      onClick={() => addRelativeDays(2)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      + ૨ દિવસ (2 Days)
                    </button>
                    <button
                      type="button"
                      onClick={() => addRelativeDays(3)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                    >
                      + ૩ દિવસ (3 Days)
                    </button>
                  </div>
                </div>

                {/* Inline Date Adder */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    className="text-xs bg-white border border-slate-300 rounded-xl p-2 text-slate-800 font-semibold focus:ring-2 focus:ring-red-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addDate(newDateInput)}
                    disabled={!newDateInput}
                    className="px-3.5 py-2 rounded-xl bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>તારીખ ઉમેરો (+ Add Date)</span>
                  </button>
                </div>

                {/* Dates Checkbox List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {selectedDates.map((dStr) => {
                    const isChecked = selectedDates.includes(dStr);
                    return (
                      <div
                        key={dStr}
                        className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition ${
                          isChecked
                            ? "border-red-600 bg-red-50/50 shadow-xs"
                            : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDate(dStr)}
                            className="w-4 h-4 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                          />
                          <span className="font-extrabold text-xs text-slate-900 truncate">
                            {formatDateGu(dStr)}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeDate(dStr)}
                          className="text-slate-400 hover:text-red-700 text-xs font-bold p-1 rounded transition cursor-pointer"
                          title="કાઢી નાખો (Remove)"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: Time Slot & Timings Selection with Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock className="w-4 h-4 text-red-800" />
                      ૪. સમય સ્લોટ્સ (Select Time Slots via Checkboxes) *
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                      {selectedTimings.length} સ્લોટ પસંદ
                    </span>
                  </div>

                  {/* Timing Scope Toggle */}
                  <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-300 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setTimingScope("SAME_ALL")}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        timingScope === "SAME_ALL"
                          ? "bg-red-800 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      બધી સુવિધાઓ માટે સરખો સમય (Same for all)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimingScope("CUSTOM_PER_FACILITY")}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        timingScope === "CUSTOM_PER_FACILITY"
                          ? "bg-red-800 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      સુવિધા મુજબ અલગ સમય (Per Facility)
                    </button>
                  </div>
                </div>

                {timingScope === "SAME_ALL" ? (
                  <div className="space-y-3">
                    {/* Option 1: Whole Day / 24 Hours */}
                    <label
                      className={`p-3.5 rounded-xl border-2 flex items-start gap-3 transition cursor-pointer ${
                        selectedTimings.includes(WHOLE_DAY_SLOT_LABEL)
                          ? "border-red-600 bg-red-50/50 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTimings.includes(WHOLE_DAY_SLOT_LABEL)}
                        onChange={() => toggleTimingSlot(WHOLE_DAY_SLOT_LABEL)}
                        className="w-4 h-4 mt-0.5 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                          <span>૧. આખો દિવસ / 24 Hours (Whole Day)</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                            09:00 AM થી બીજા દિવસે 08:00 AM
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                          ચેક-ઇન પ્રસંગના દિવસે સવારે 09:00 AM થી ચેક-આઉટ બીજા દિવસે સવારે 08:00 AM સુધી (24 કલાક પૂરા)
                        </div>
                      </div>
                    </label>

                    {/* Option 2: Custom Hourly Timing Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-950 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-700" />
                          ૨. ચોક્કસ કસ્ટમ સમય ઉમેરો (Add Custom Timing Slot):
                        </span>
                        <span className="text-xs font-mono font-bold bg-blue-50 text-blue-900 px-2.5 py-0.5 rounded-full border border-blue-200">
                          {customStartTime} થી {customEndTime}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            શરૂ થવાનો સમય (From Time):
                          </label>
                          <select
                            value={customStartTime}
                            onChange={(e) => setCustomStartTime(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-900 outline-none"
                          >
                            {STANDARD_HOURS.map((hr) => (
                              <option key={`c-from-${hr}`} value={hr}>{hr}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            પૂરો થવાનો સમય (To Time):
                          </label>
                          <select
                            value={customEndTime}
                            onChange={(e) => setCustomEndTime(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-900 outline-none"
                          >
                            {STANDARD_HOURS.map((hr) => (
                              <option key={`c-to-${hr}`} value={hr}>{hr}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => addCustomSlot(customStartTime, customEndTime)}
                            className="w-full px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>આ સમય ઉમેરો (+ Add)</span>
                          </button>
                        </div>
                      </div>

                      {/* Quick presets */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 mr-1 uppercase">ઝડપી સ્લોટ:</span>
                        {TIMING_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setCustomStartTime(preset.from);
                              setCustomEndTime(preset.to);
                              addCustomSlot(preset.from, preset.to);
                            }}
                            className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-900 text-slate-700 border border-slate-200 transition cursor-pointer"
                          >
                            + {preset.from} - {preset.to}
                          </button>
                        ))}
                      </div>

                      {/* Added custom slots pills with checkbox */}
                      {customSlotsList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1.5">
                          <span className="text-[11px] font-bold text-slate-600">ઉમેરેલ કસ્ટમ સ્લોટ્સ:</span>
                          {customSlotsList.map((slotStr) => {
                            const isChecked = selectedTimings.includes(slotStr);
                            return (
                              <div
                                key={slotStr}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                                  isChecked
                                    ? "bg-blue-100 border-blue-400 text-blue-950 shadow-2xs"
                                    : "bg-slate-100 border-slate-300 text-slate-500"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleTimingSlot(slotStr)}
                                  className="w-3.5 h-3.5 rounded text-blue-700 cursor-pointer"
                                />
                                <span>{slotStr}</span>
                                <button
                                  type="button"
                                  onClick={() => removeCustomSlot(slotStr)}
                                  className="text-slate-400 hover:text-red-700 ml-1 text-xs font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Custom Timing Per Facility (ONLY 2 TIMINGS: WHOLE DAY & CUSTOM) */
                  <div className="space-y-3">
                    <div className="text-[11px] text-slate-700 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      ℹ️ દરેક સુવિધા માટે માત્ર બે વિકલ્પો ઉપલબ્ધ છે: ૧. આખો દિવસ (09:00 AM થી બીજા દિવસે 08:00 AM) અથવા ૨. ચોક્કસ કસ્ટમ સમય
                    </div>
                    {selectedFacilityIds.map((facId) => {
                      const fac = facilities.find((f) => f.id === facId);
                      if (!fac) return null;
                      const currentSlots =
                        facilityTimingMap[facId] !== undefined
                          ? facilityTimingMap[facId]
                          : selectedTimings.length > 0
                          ? selectedTimings
                          : [WHOLE_DAY_SLOT_LABEL];
                      const isWholeDay = currentSlots.includes(WHOLE_DAY_SLOT_LABEL);
                      const facilityCustomSlots = currentSlots.filter((s) => s !== WHOLE_DAY_SLOT_LABEL);

                      return (
                        <div key={fac.id} className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-xs text-slate-900 pb-1.5 border-b border-slate-100">
                            <span className="flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-red-800" />
                              {fac.name} ({fac.code})
                            </span>
                            <span className="text-[11px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              {currentSlots.length} સ્લોટ પસંદ
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {/* Option 1: Whole Day */}
                            <label
                              className={`p-3 rounded-xl border-2 flex items-start gap-2.5 transition cursor-pointer ${
                                isWholeDay
                                  ? "border-red-600 bg-red-50/50 shadow-2xs"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isWholeDay}
                                onChange={() => toggleFacilityCustomTiming(fac.id, WHOLE_DAY_SLOT_LABEL)}
                                className="w-4 h-4 mt-0.5 rounded text-red-800 focus:ring-red-700 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                  <span>૧. આખો દિવસ / 24 Hours (Whole Day)</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                                    09:00 AM થી બીજા દિવસે 08:00 AM
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                                  ચેક-ઇન સવારે 09:00 AM → ચેક-આઉટ બીજા દિવસે સવારે 08:00 AM (24 કલાક સંપૂર્ણ સાઇકલ)
                                </div>
                              </div>
                            </label>

                            {/* Option 2: Custom Timing */}
                            <div className="p-3 rounded-xl border-2 border-blue-200 bg-blue-50/30 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-blue-700" />
                                  ૨. ચોક્કસ સમય (Custom Timing - કલાક મુજબ):
                                </span>
                                <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                  {facilityCustomSlots.length > 0
                                    ? `${facilityCustomSlots.length} કસ્ટમ સ્લોટ પસંદ`
                                    : "કસ્ટમ સમય પસંદ કરો"}
                                </span>
                              </div>

                              {/* Quick Presets for this facility */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">ઝડપી સ્લોટ:</span>
                                {TIMING_PRESETS.map((preset) => {
                                  const presetSlot = `${preset.from} - ${preset.to}`;
                                  const isSelected = currentSlots.includes(presetSlot);
                                  return (
                                    <button
                                      key={`${fac.id}-${preset.label}`}
                                      type="button"
                                      onClick={() => toggleFacilityCustomTiming(fac.id, presetSlot)}
                                      className={`text-[11px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                        isSelected
                                          ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                                          : "bg-white hover:bg-blue-100 text-slate-700 border-slate-300"
                                      }`}
                                    >
                                      {isSelected ? "✓ " : "+ "}{preset.from} - {preset.to}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* From / To time dropdowns for this facility */}
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-bold text-slate-600">શરૂ:</span>
                                  <select
                                    id={`fac-start-${fac.id}`}
                                    defaultValue="12:00 PM"
                                    className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 outline-none"
                                  >
                                    {STANDARD_HOURS.map((hr) => (
                                      <option key={`fac-st-${fac.id}-${hr}`} value={hr}>{hr}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-bold text-slate-600">અંત:</span>
                                  <select
                                    id={`fac-end-${fac.id}`}
                                    defaultValue="02:00 PM"
                                    className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 outline-none"
                                  >
                                    {STANDARD_HOURS.map((hr) => (
                                      <option key={`fac-en-${fac.id}-${hr}`} value={hr}>{hr}</option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const stEl = document.getElementById(`fac-start-${fac.id}`) as HTMLSelectElement;
                                    const enEl = document.getElementById(`fac-end-${fac.id}`) as HTMLSelectElement;
                                    if (stEl && enEl) {
                                      addFacilityCustomTimingSlot(fac.id, stEl.value, enEl.value);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>આ સમય ઉમેરો (+ Add)</span>
                                </button>
                              </div>

                              {/* Render selected custom timing chips */}
                              {facilityCustomSlots.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[11px] font-bold text-blue-900">પસંદ કરેલ સ્લોટ્સ:</span>
                                  {facilityCustomSlots.map((slotStr) => (
                                    <span
                                      key={`${fac.id}-${slotStr}`}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-100 border border-blue-300 text-blue-950 text-xs font-bold shadow-2xs"
                                    >
                                      <span>{slotStr}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleFacilityCustomTiming(fac.id, slotStr)}
                                        className="text-blue-500 hover:text-red-700 ml-1 font-bold cursor-pointer"
                                        title="કાઢી નાખો (Remove)"
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 5: Real-time Generated Bookings & Conflict Review */}
              <div className="space-y-2.5">
                {/* Status Alert Banner */}
                {bookingItems.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 font-bold flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>કૃપા કરીને ઓછામાં ઓછી ૧ સુવિધા, ૧ તારીખ અને ૧ સમય સ્લોટ પસંદ કરો જેથી બુકિંગ એન્ટ્રીઝ જનરેટ થાય.</span>
                  </div>
                ) : hasAnyConflict ? (
                  <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl text-xs text-rose-950 font-bold flex items-start gap-2.5 shadow-xs">
                    <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-sm text-rose-900">
                        ⚠️ સમય ટકરાવ (Time Conflict Found): {conflictingItemsCount} બુકિંગ સ્લોટ્સમાં ટકરાવ છે!
                      </div>
                      <div className="text-[11px] text-rose-800 mt-0.5">
                        નીચે લાલ રંગમાં દર્શાવેલ સુવિધા અથવા સ્લોટ પહેલેથી બુક થયેલ છે. કૃપા કરીને અન્ય ખાલી સમય અથવા તારીખ પસંદ કરો.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-xs text-emerald-950 font-bold flex items-center gap-2.5 shadow-2xs">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-black text-emerald-900">
                        ✓ ઉત્તમ! તમામ {bookingItems.length} બુકિંગ સ્લોટ્સ ઉપલબ્ધ છે (કોઈ સમય ટકરાવ નથી).
                      </span>
                    </div>
                  </div>
                )}

                {/* Generated Items Review Box */}
                {bookingItems.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-600" />
                        ૫. જનરેટ થયેલ બુકિંગ સમીક્ષા ({bookingItems.length} Bookings to be created)
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        કુલ મૂળ ભાડું: ₹{totalFacilityRent.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {bookingItems.map((item, idx) => (
                        <div
                          key={`${item.facilityId}-${item.startDate}-${item.slot}-${idx}`}
                          className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                            item.conflict.isConflict
                              ? "bg-rose-50/80 text-rose-950 font-bold"
                              : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.conflict.isConflict ? "bg-rose-600 ring-2 ring-rose-200" : "bg-emerald-600"
                              }`}
                            ></span>
                            <div className="min-w-0">
                              <div className="font-extrabold truncate">
                                {item.facilityName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-semibold">
                                {formatDateGu(item.startDate)} •{" "}
                                <span className="text-slate-700 font-bold">{item.slot}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {item.conflict.isConflict ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                                <AlertCircle className="w-3 h-3" />
                                {item.conflict.reason} ({item.conflict.bookedBy})
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900">
                                  ₹{item.baseRent.toLocaleString("en-IN")}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ✓ ઉપલબ્ધ
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 6: Add-on Services: Cleaning & Waste Collection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  ૬. વધારાની સેવાઓ (Optional Add-on Trust Services):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {services.map((srv) => {
                    const isChecked = formData.selectedServices.includes(srv.code);
                    return (
                      <label
                        key={srv.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                          isChecked
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

              {/* SECTION 7: Non-Stackable Discount Rules */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center">
                    <Percent className="w-3.5 h-3.5 mr-1 text-red-800" />
                    ૭. ટ્રસ્ટી અને દાતા ડિસ્કાઉન્ટ (Trustee & Room Donor Discount Policy):
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

              {/* SECTION 8: Payment Method */}
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

              {/* SECTION 9: Modal Footer & Submission */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 sticky bottom-0 bg-white p-3 z-10 shadow-lg rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={
                    creating ||
                    hasAnyConflict ||
                    bookingItems.length === 0 ||
                    selectedFacilityIds.length === 0 ||
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
                          ? `તમામ ${bookingItems.length} બુકિંગ કન્ફર્મ કરો (Confirm & Create ${bookingItems.length} Bookings)`
                          : "બુકિંગ કન્ફર્મ કરો (Confirm & Save Booking)"}
                      </span>
                    </>
                  )}
                </button>
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
