"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Building,
  Clock,
  Phone,
  CheckCircle,
  FileText,
  Filter,
  Layers,
  Check,
  CalendarDays,
  CalendarRange,
  View,
  MessageSquare,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { fetchAdminJson, getAdminCachedData } from "@/lib/admin-client-cache";
import {
  isFullDaySlot,
  formatSlotLabel,
  getSlotStartMinutes,
  getSlotPeriodInfo,
  sortBookingsFromMorningToNight,
} from "@/lib/slotUtils";

export default function AdminCalendarPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<"MONTH" | "WEEK" | "DAY">("MONTH");
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(false);
  const bookingsRefresh = useRef<Promise<void> | null>(null);
  const facilitiesRefresh = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const url = `/api/bookings?month=${m}&year=${y}`;
    const cachedFacilities = getAdminCachedData<any>("/api/facilities");
    const cachedBookings = getAdminCachedData<any>(url);
    if (cachedFacilities?.facilities) setFacilities(cachedFacilities.facilities);
    if (cachedBookings?.bookings) setBookings(cachedBookings.bookings);
    if (cachedFacilities || cachedBookings) setLoading(false);
    fetchData();
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

  // When calendar month changes, load scoped bookings for that month (skipping redundant double mount fetch)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const url = `/api/bookings?month=${m}&year=${y}`;
    const cached = getAdminCachedData<any>(url);
    if (cached?.bookings) {
      setBookings(cached.bookings);
    }
    refreshBookings(y, m);
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const refreshBookings = async (targetYear = currentDate.getFullYear(), targetMonth = currentDate.getMonth() + 1) => {
    const url = `/api/bookings?month=${targetMonth}&year=${targetYear}`;
    if (bookingsRefresh.current) return bookingsRefresh.current;
    bookingsRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>(url);
        if (data?.bookings) setBookings(data.bookings);
      } catch (err) {
        console.error("Calendar booking refresh error:", err);
      } finally {
        bookingsRefresh.current = null;
      }
    })();
    return bookingsRefresh.current;
  };

  const refreshFacilities = async () => {
    if (facilitiesRefresh.current) return facilitiesRefresh.current;
    facilitiesRefresh.current = (async () => {
      try {
        const data = await fetchAdminJson<any>("/api/facilities");
        if (data?.facilities) setFacilities(data.facilities);
      } catch (err) {
        console.error("Calendar facility refresh error:", err);
      } finally {
        facilitiesRefresh.current = null;
      }
    })();
    return facilitiesRefresh.current;
  };

  const fetchData = async () => {
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const url = `/api/bookings?month=${m}&year=${y}`;
      if (!getAdminCachedData("/api/facilities") && !getAdminCachedData(url)) {
        setLoading(true);
      }
      const [facRes, bookRes, userRes] = await Promise.allSettled([
        fetchAdminJson<any>("/api/facilities"),
        fetchAdminJson<any>(url),
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
      console.error("Calendar fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSuper = currentUser?.role === "SUPER_ADMIN";

  const displayedFacilities = facilities.filter((f) => {
    if (filterType === "ALL") return true;
    return f.type === filterType;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === "WEEK") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
      setSelectedDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      setSelectedDate(d);
    }
  };

  const nextMonth = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === "WEEK") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
      setSelectedDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      setSelectedDate(d);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const getBookingsForDate = (dateObj: Date) => {
    const targetStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    return bookings.filter((b) => {
      if (selectedFacilityId !== "ALL") {
        const selectedFac = facilities.find((f) => f.id === selectedFacilityId);
        const targetGroup = selectedFac?.resourceGroup || selectedFac?.code;
        const matchesFac = b.facilityId === selectedFacilityId;
        const matchesGroup = targetGroup && b.resourceGroup === targetGroup;
        if (!matchesFac && !matchesGroup) return false;
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

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  // Bus Seat-Style Facility Availability Engine
  const [availabilityFilter, setAvailabilityFilter] = useState<"AVAILABLE_FIRST" | "ALL" | "ONLY_AVAILABLE" | "ONLY_BOOKED">("AVAILABLE_FIRST");

  const getFacilityAvailabilityForDate = (dateObj: Date | null) => {
    if (!dateObj || facilities.length === 0) return [];

    const targetStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

    return facilities.map((fac) => {
      const targetGroup = fac.resourceGroup || fac.code;
      const facBookings = bookings.filter((b) => {
        const matchesFac = b.facilityId === fac.id;
        const matchesGroup = targetGroup && (b.resourceGroup === targetGroup || b.facility?.resourceGroup === targetGroup);
        if (!matchesFac && !matchesGroup) return false;

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

      const sortedFacBookings = sortBookingsFromMorningToNight(facBookings);
      const hasFullDay = sortedFacBookings.some((b) => isFullDaySlot(b.slot));
      const isCompletelyAvailable = sortedFacBookings.length === 0;
      const isPartiallyBooked = sortedFacBookings.length > 0 && !hasFullDay;
      const isFullyBooked = hasFullDay;

      return {
        facility: fac,
        isAvailable: isCompletelyAvailable,
        isPartiallyBooked,
        isFullyBooked,
        isBooked: sortedFacBookings.length > 0,
        bookings: sortedFacBookings,
      };
    });
  };

  const selectedDayFacilities = selectedDate ? getFacilityAvailabilityForDate(selectedDate) : [];
  const availableCount = selectedDayFacilities.filter((f) => f.isAvailable).length;
  const partialCount = selectedDayFacilities.filter((f) => f.isPartiallyBooked).length;
  const fullyBookedCount = selectedDayFacilities.filter((f) => f.isFullyBooked).length;
  const bookedCount = selectedDayFacilities.filter((f) => f.isBooked).length;

  const getFacilityEarliestStartMinutes = (item: any): number => {
    if (!item.bookings || item.bookings.length === 0) return 99999;
    return Math.min(...item.bookings.map((b: any) => getSlotStartMinutes(b.slot)));
  };

  const filteredDayFacilities = (() => {
    if (!isSuper) {
      // In View-Only Admin: strictly 2 states - Available (Green) or Booked (Red)
      if (availabilityFilter === "ONLY_AVAILABLE") {
        return selectedDayFacilities.filter((f) => f.isAvailable);
      }
      if (availabilityFilter === "ONLY_BOOKED") {
        return selectedDayFacilities
          .filter((f) => f.isBooked)
          .sort((a, b) => getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b));
      }
      if (availabilityFilter === "AVAILABLE_FIRST") {
        return [...selectedDayFacilities].sort((a, b) => {
          // Green slots first!
          if (a.isAvailable !== b.isAvailable) {
            return a.isAvailable ? -1 : 1;
          }
          if (a.isAvailable && b.isAvailable) {
            return 0;
          }
          // After green slots: sort from morning to night!
          return getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b);
        });
      }
      return [...selectedDayFacilities].sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b);
      });
    }

    // In Super Admin: Available (Green) first, then partial/booked sorted from Morning to Night!
    if (availabilityFilter === "ONLY_AVAILABLE") {
      return selectedDayFacilities.filter((f) => f.isAvailable || f.isPartiallyBooked);
    }
    if (availabilityFilter === "ONLY_BOOKED") {
      return selectedDayFacilities
        .filter((f) => f.isBooked)
        .sort((a, b) => getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b));
    }
    if (availabilityFilter === "AVAILABLE_FIRST") {
      return [...selectedDayFacilities].sort((a, b) => {
        // Green slots first!
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        if (a.isAvailable && b.isAvailable) {
          return 0;
        }
        // After green slots: sort from morning to night!
        return getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b);
      });
    }
    return [...selectedDayFacilities].sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return getFacilityEarliestStartMinutes(a) - getFacilityEarliestStartMinutes(b);
    });
  })();

  // Week calculation
  const getWeekDates = (baseDate: Date) => {
    const current = new Date(baseDate);
    const day = current.getDay();
    const diff = current.getDate() - day; // Sunday start
    const startOfWeek = new Date(current.setDate(diff));

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const currentWeekDays = getWeekDates(currentDate);

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
            {isSuper ? "Internal Availability System" : "Interactive Availability Calendar"}
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Booking & Availability Calendar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuper
              ? "Multi-view calendar for Outside Party Plot, Multipurpose Hall, Dormitories, and AC Suites."
              : "Click on any date to inspect booked facilities, applicant names, slots, and availability status."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Mode Switcher (Month, Week, Day) - iOS Segmented Control */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/90 shadow-inner">
            <button
              onClick={() => setViewMode("MONTH")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition-all duration-200 min-h-[32px] flex items-center justify-center cursor-pointer ${
                viewMode === "MONTH"
                  ? "bg-white text-slate-900 shadow-xs font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 font-semibold"
              }`}
            >
              Month (મહિનો)
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition-all duration-200 min-h-[32px] flex items-center justify-center cursor-pointer ${
                viewMode === "WEEK"
                  ? "bg-white text-slate-900 shadow-xs font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 font-semibold"
              }`}
            >
              Week (અઠવાડિયું)
            </button>
            <button
              onClick={() => setViewMode("DAY")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition-all duration-200 min-h-[32px] flex items-center justify-center cursor-pointer ${
                viewMode === "DAY"
                  ? "bg-white text-slate-900 shadow-xs font-black scale-[1.02]"
                  : "text-slate-600 hover:text-slate-900 font-semibold"
              }`}
            >
              Day (દિવસ)
            </button>
          </div>

          {/* Month / Date Navigation - Apple Style Secondary Controls */}
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              onClick={prevMonth}
              aria-label="Previous Period"
              className="p-1.5 hover:bg-white rounded-xl text-slate-600 hover:text-slate-900 transition-all shadow-2xs hover:shadow-xs min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold text-slate-800 hover:bg-white rounded-xl transition-all shadow-2xs hover:shadow-xs whitespace-nowrap min-h-[34px] flex items-center justify-center cursor-pointer active:scale-95"
            >
              {viewMode === "MONTH" && `${monthNames[month]} ${year}`}
              {viewMode === "WEEK" && `Week of ${currentWeekDays[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`}
              {viewMode === "DAY" && currentDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </button>
            <button
              onClick={nextMonth}
              aria-label="Next Period"
              className="p-1.5 hover:bg-white rounded-xl text-slate-600 hover:text-slate-900 transition-all shadow-2xs hover:shadow-xs min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isSuper && (
            <Link
              href="/admin/bookings?new=true"
              className="group bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white text-xs sm:text-sm font-black px-3.5 sm:px-4 py-2 rounded-xl shadow-sm hover:shadow-lg hover:shadow-blue-500/25 border border-blue-400/30 transition-all duration-200 flex items-center min-h-[38px]"
            >
              <span className="w-5 h-5 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center mr-2 shadow-2xs transition-all duration-200">
                <Plus className="w-3.5 h-3.5 text-white stroke-[3]" />
              </span>
              <span>+ નવું બુકિંગ (New Booking)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Category Tabs & Direct Facility Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        {/* Category Filter Tabs: Horizontal swipeable pill list */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 sm:pb-3 border-b border-slate-200">
          <div className="flex items-center overflow-x-auto no-scrollbar scroll-smooth gap-1.5 pb-1 max-w-full">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 flex items-center mr-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5 mr-1" />
              Category:
            </span>
            {[
              { id: "ALL", label: `All (${facilities.length})` },
              { id: "PLOT", label: "Outside Party Plot (1)" },
              { id: "HALL", label: "Halls (2)" },
              { id: "DORMITORY", label: "Dormitories (2)" },
              { id: "ROOM", label: "AC Guest Rooms (3)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id);
                  setSelectedFacilityId("ALL");
                }}
                className={`text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-150 whitespace-nowrap flex-shrink-0 min-h-[32px] cursor-pointer active:scale-95 ${
                  filterType === tab.id
                    ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xs font-black"
                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedFacilityId !== "ALL" && (
            <button
              onClick={() => {
                setSelectedFacilityId("ALL");
                setFilterType("ALL");
              }}
              className="inline-flex items-center text-[11px] sm:text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs active:scale-95 self-start sm:self-auto flex-shrink-0 cursor-pointer"
            >
              ✕ Show All Facilities
            </button>
          )}
        </div>

        {/* Direct Facility Cards Grid */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                setSelectedFacilityId("ALL");
                setFilterType("ALL");
              }}
              className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                selectedFacilityId === "ALL" && filterType === "ALL"
                  ? "bg-gradient-to-br from-red-800 to-amber-900 text-white border-red-900 shadow-md ring-2 ring-amber-400/50"
                  : "bg-white text-slate-800 hover:bg-slate-100 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">
                  Overview
                </span>
                {selectedFacilityId === "ALL" && filterType === "ALL" && (
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                )}
              </div>
              <div className="mt-1">
                <div className="font-extrabold text-[11px] sm:text-xs truncate">All Facilities</div>
                <div className="text-[9px] sm:text-[10px] opacity-75 truncate">Combined Master View</div>
              </div>
            </button>

            {displayedFacilities.map((f) => {
              const isSelected = selectedFacilityId === f.id;
              const isPlot = f.type === "PLOT";
              const isDorm = f.type === "DORMITORY";
              const isRoom = f.type === "ROOM";

              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFacilityId(f.id);
                    setFilterType(f.type);
                  }}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-red-800 text-white border-red-900 shadow-md ring-2 ring-red-600"
                      : "bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : isPlot
                          ? "bg-emerald-100 text-emerald-800"
                          : isDorm
                          ? "bg-blue-100 text-blue-800"
                          : isRoom
                          ? "bg-purple-100 text-purple-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isPlot ? "Plot" : isDorm ? "Dorm" : isRoom ? "Room" : "Hall"}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </div>

                  <div className="mt-1">
                    <div className="font-bold text-[11px] sm:text-xs leading-tight truncate">
                      {f.name.replace("Dormitory — ", "")}
                    </div>
                    <div className={`text-[9px] sm:text-[10px] mt-0.5 truncate ${isSelected ? "text-amber-200" : "text-slate-500"}`}>
                      {isPlot ? "1500 Persons" : `${f.capacity} ${isDorm || isRoom ? "Beds" : "Persons"}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: MONTH VIEW */}
      {viewMode === "MONTH" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar Grid (2 Cols on Desktop, Full Width on Mobile) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border-2 border-slate-200 shadow-sm p-3.5 sm:p-6">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-black text-slate-500 pb-2 border-b border-slate-100 mb-2">
              <span className="text-red-700 font-black"><span className="sm:hidden">રવિ</span><span className="hidden sm:inline">રવિ (Sun)</span></span>
              <span><span className="sm:hidden">સોમ</span><span className="hidden sm:inline">સોમ (Mon)</span></span>
              <span><span className="sm:hidden">મંગળ</span><span className="hidden sm:inline">મંગળ (Tue)</span></span>
              <span><span className="sm:hidden">બુધ</span><span className="hidden sm:inline">બુધ (Wed)</span></span>
              <span><span className="sm:hidden">ગુરુ</span><span className="hidden sm:inline">ગુરુ (Thu)</span></span>
              <span><span className="sm:hidden">શુક્ર</span><span className="hidden sm:inline">શુક્ર (Fri)</span></span>
              <span><span className="sm:hidden">શનિ</span><span className="hidden sm:inline">શનિ (Sat)</span></span>
            </div>

            {/* COLOR SCHEME & FACILITY LEGEND */}
            <div className="mb-3 p-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700 shadow-2xs">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
                <span className="text-[11px] font-black uppercase text-slate-400">સ્થિતિ:</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    🟢 ઉપલબ્ધ (ખાલી)
                  </span>
                </div>
                {isSuper && (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      🟡 આંશિક સ્લોટ બુક
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                    🔴 સંપૂર્ણ બુક
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

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[58px] sm:min-h-[78px] md:min-h-[92px] bg-slate-50/50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200/70"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayDate = new Date(year, month, dayNum);
                const dayBookings = getBookingsForDay(dayNum);
                const isBooked = dayBookings.length > 0;
                const isSelected = selectedDate && selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                const dayFacs = getFacilityAvailabilityForDate(dayDate);
                const dayAvail = dayFacs.filter((f) => f.isAvailable).length;
                const dayIsFullyBooked = dayFacs.length > 0 && dayFacs.every((f) => f.isFullyBooked);

                // Booked facility types for dots
                const bookedFacTypes = Array.from(
                  new Set(
                    dayBookings.map((b) => {
                      const fac = facilities.find((f) => f.id === b.facilityId) || b.facility;
                      return fac?.type || "";
                    }).filter(Boolean)
                  )
                );

                // Green by default for available days (as requested: "i want green color as available not white")
                let cardTheme = "bg-emerald-50/80 border-2 border-emerald-200 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-300";
                let badge = (
                  <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 shadow-2xs truncate block max-w-full">
                    🟢 ખાલી
                  </span>
                );

                if (!isSuper) {
                  // View-Only Admin: Strictly Available (green) or Booked (rose)
                  if (isBooked) {
                    cardTheme = "bg-rose-50/80 border-2 border-rose-200 text-rose-950 hover:bg-rose-100 hover:border-rose-300";
                    badge = (
                      <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300/80 shadow-2xs truncate block max-w-full">
                        🔴 બુકિંગ
                      </span>
                    );
                  }
                } else {
                  // Super Admin: Green for available, Amber for partial slots/facilities, Rose for fully booked
                  if (isBooked) {
                    if (dayIsFullyBooked) {
                      cardTheme = "bg-rose-50/80 border-2 border-rose-200 text-rose-950 hover:bg-rose-100 hover:border-rose-300";
                      badge = (
                        <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300/80 shadow-2xs truncate block max-w-full">
                          🔴 સંપૂર્ણ બુક
                        </span>
                      );
                    } else {
                      cardTheme = "bg-amber-50/80 border-2 border-amber-200 text-amber-950 hover:bg-amber-100 hover:border-amber-300";
                      badge = (
                        <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs truncate block max-w-full">
                          🟡 {dayAvail > 0 ? `${dayAvail} ખાલી` : "સમય બુક"}
                        </span>
                      );
                    }
                  }
                }

                return (
                  <button
                    type="button"
                    key={`day-${dayNum}`}
                    aria-label={`${dayDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}: ${isBooked ? `${dayBookings.length} bookings, ${dayAvail} available` : "all available"}`}
                    aria-pressed={Boolean(isSelected)}
                    onClick={() => {
                      setSelectedDate(dayDate);
                      if (typeof window !== "undefined" && window.innerWidth < 1024) {
                        const el = document.getElementById("day-inspector-section");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                      }
                    }}
                    className={`min-w-0 min-h-[58px] sm:min-h-[78px] md:min-h-[92px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 text-center ${cardTheme} ${
                      isSelected
                        ? "ring-4 ring-amber-400 border-amber-500 shadow-md scale-[1.03] z-10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs sm:text-base font-black leading-none text-slate-900 font-mono tabular-nums">
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

          {/* Selected Day Inspector — Bus-Seat Style Facility Availability Engine */}
          <div
            id="day-inspector-section"
            className="bg-white rounded-3xl border-2 border-slate-200 shadow-md p-4 sm:p-6 space-y-4 flex flex-col scroll-mt-20"
          >
            {/* Header with Gujarati + English Date */}
            <div className="border-b-2 border-slate-100 pb-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  તારીખ વિગત (DAY DETAILS)
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isSuper ? (
                    <>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 {availableCount} ખાલી
                      </span>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        🔴 {bookedCount} બુક
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 {availableCount} ખાલી
                      </span>
                      {partialCount > 0 && (
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300">
                          🟡 {partialCount} આંશિક
                        </span>
                      )}
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        🔴 {fullyBookedCount} પૂર્ણ બુક
                      </span>
                    </>
                  )}
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
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

            {/* Bus Seat Layout Overview (Mini Map) */}
            <div className="bg-[#f5f5f7] p-3 sm:p-3.5 rounded-2xl border border-[#e5e5ea] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>સુવિધા સ્થિતિ (Seat Map)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">કુલ ૮ સુવિધાઓ</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {selectedDayFacilities.map((item) => {
                  const isGreen = item.isAvailable;
                  const showAsYellow = isSuper && item.isPartiallyBooked;

                  let seatBg = "bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200";
                  let dotBg = "#ef4444";
                  let badgeText = isSuper && item.isFullyBooked ? "પૂર્ણ બુક" : "બુક";

                  if (isGreen) {
                    seatBg = "bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-200";
                    dotBg = "#10b981";
                    badgeText = "ખાલી";
                  } else if (showAsYellow) {
                    seatBg = "bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200";
                    dotBg = "#f59e0b";
                    badgeText = "સમય બુક";
                  }

                  return (
                    <button
                      key={item.facility.id}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`fac-seat-${item.facility.id}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`p-2 rounded-xl text-left border transition text-[11px] font-bold flex flex-col justify-between active:scale-95 cursor-pointer ${seatBg}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotBg }}
                        />
                        <span className="text-[9px] font-black uppercase">
                          {badgeText}
                        </span>
                      </div>
                      <span className="truncate mt-1 text-[10px] leading-tight block font-extrabold">
                        {item.facility.name.replace("Dormitory — ", "").replace("AC Room — ", "AC ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Tabs: Available First by Default */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {(isSuper
                ? [
                    { id: "AVAILABLE_FIRST", label: `🟢 ઉપલબ્ધ પ્રથમ (${availableCount + partialCount} ખાલી/આંશિક)` },
                    { id: "ONLY_AVAILABLE", label: `🟢 ફક્ત સંપૂર્ણ ખાલી (${availableCount})` },
                    { id: "ONLY_BOOKED", label: `🔴 બુક થયેલ (${bookedCount})` },
                    { id: "ALL", label: `બધી સુવિધાઓ (${selectedDayFacilities.length})` },
                  ]
                : [
                    { id: "AVAILABLE_FIRST", label: `🟢 ખાલી પ્રથમ (${availableCount} ખાલી)` },
                    { id: "ONLY_AVAILABLE", label: `🟢 ફક્ત ખાલી (${availableCount})` },
                    { id: "ONLY_BOOKED", label: `🔴 ફક્ત બુક (${bookedCount})` },
                    { id: "ALL", label: `બધી સુવિધાઓ (${selectedDayFacilities.length})` },
                  ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAvailabilityFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    availabilityFilter === tab.id
                      ? "bg-[#0066cc] text-white shadow-xs"
                      : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Facilities Cards (Sorted: Available Facilities First!) */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {filteredDayFacilities.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                  આ ફિલ્ટર મુજબ કોઈ સુવિધા નથી.
                </div>
              ) : (
                filteredDayFacilities.map((item) => {
                  const fac = item.facility;
                  const isAvail = item.isAvailable;

                  if (isAvail) {
                    return (
                      <div
                        id={`fac-seat-${fac.id}`}
                        key={fac.id}
                        className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 space-y-2.5 transition hover:shadow-sm scroll-mt-24 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-200 shrink-0"></span>
                            <h4 className="text-sm sm:text-base font-black text-emerald-950">
                              {fac.name}
                            </h4>
                          </div>
                          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400">
                            🟢 ખાલી છે (Available)
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-emerald-900 pt-1 border-t border-emerald-200/60">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-600">
                              {fac.type === "PLOT" ? "🌳 પાર્ટી પ્લોટ" : fac.type === "HALL" ? "🏛️ હોલ" : fac.type === "DORMITORY" ? "🛏️ ડોર્મિટરી" : "🚪 એસી રૂમ"}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-slate-800">
                              ક્ષમતા: {fac.capacity} {fac.bookingUnit === "PER_BED" ? "બેડ" : "માણસો"}
                            </span>
                          </div>

                          {isSuper ? (
                            <Link
                              href={`/admin/bookings?new=true&date=${selectedDate ? selectedDate.toISOString().split("T")[0] : ""}&facilityId=${fac.id}`}
                              className="group inline-flex items-center px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white font-bold text-xs shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all duration-150 border border-blue-400/30"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
                              <span>બુક કરો</span>
                            </Link>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                              ✓ ઉપલબ્ધ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Booked Facility Card (Partially Booked OR Fully Booked)
                  const showAsYellow = isSuper && item.isPartiallyBooked;

                  return (
                    <div
                      id={`fac-seat-${fac.id}`}
                      key={fac.id}
                      className={`p-4 rounded-2xl border-2 space-y-3 transition hover:shadow-sm scroll-mt-24 shadow-2xs ${
                        showAsYellow
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-rose-300 bg-rose-50/70"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between pb-2 border-b flex-wrap gap-2 ${
                          showAsYellow ? "border-amber-200/80" : "border-rose-200/70"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-3 h-3 rounded-full shrink-0 ${
                              showAsYellow
                                ? "bg-amber-500 ring-4 ring-amber-200"
                                : "bg-rose-500 ring-4 ring-rose-200"
                            }`}
                          ></span>
                          <h4
                            className={`text-sm sm:text-base font-black ${
                              showAsYellow ? "text-amber-950" : "text-rose-950"
                            }`}
                          >
                            {fac.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                              showAsYellow
                                ? "bg-amber-200 text-amber-900 border-amber-400"
                                : "bg-rose-200 text-rose-900 border-rose-400"
                            }`}
                          >
                            {showAsYellow
                              ? "🟡 સમય મુજબ બુક (બાકી સમય ખાલી)"
                              : isSuper && item.isFullyBooked
                              ? "🔴 આખો દિવસ બુક (Full Day)"
                              : "🔴 બુક થયેલ (Booked)"}
                          </span>
                          {showAsYellow && (
                            <Link
                              href={`/admin/bookings?new=true&date=${selectedDate ? selectedDate.toISOString().split("T")[0] : ""}&facilityId=${fac.id}`}
                              className="group inline-flex items-center px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] text-white font-bold text-xs shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all duration-150 border border-blue-400/30"
                            >
                              <Plus className="w-3 h-3 mr-1 stroke-[2.5]" />
                              <span>+ અન્ય સમય બુક કરો</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {item.bookings.map((b: any) => {
                          const cleanPhone = b.customerPhone?.replace(/\D/g, "") || "";
                          const waMessage = `શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ-નરોડા)\nજય શ્રી ખોડિયાર 🙏\n\nઆપનું બુકિંગ કન્ફર્મ થયેલ છે:\n• બુકિંગ નંબર: ${b.bookingNumber}\n• અરજદાર: ${b.customerName}\n• સુવિધા: ${b.facility?.name || fac.name}\n• પ્રસંગ: ${b.eventType}\n• તારીખ: ${new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}\n• સમય: ${formatSlotLabel(b.slot)}\n\nશ્રી સૌરાષ્ટ્ર પટેલ સમાજ ટ્રસ્ટ, નિકોલ-નરોડા, અમદાવાદ.`;
                          const pInfo = getSlotPeriodInfo(b.slot);

                          return (
                            <div key={b.id} className="bg-white rounded-xl p-3 sm:p-3.5 border border-rose-200 space-y-2.5 shadow-2xs">
                              <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${pInfo.badgeClass}`}>
                                    {pInfo.periodLabelGu.split(" ")[0]} {pInfo.periodName}
                                  </span>
                                  <span className="text-xs font-black text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded font-mono border border-rose-200">
                                    {b.bookingNumber}
                                  </span>
                                </div>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  {b.status}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  અરજદારનું નામ (Applicant)
                                </span>
                                <h5 className="text-sm sm:text-base font-black text-slate-900">
                                  {b.customerName}
                                </h5>
                                <p className="text-xs font-bold text-rose-700 mt-0.5">
                                  🎉 {b.eventType} ({formatSlotLabel(b.slot)})
                                </p>
                              </div>

                              {b.customerPhone && (
                                <div className="flex items-center text-slate-900 pt-1 border-t border-slate-100 text-xs">
                                  <Phone className="w-3.5 h-3.5 mr-2 text-emerald-600 shrink-0" />
                                  <span className="text-slate-500 mr-1.5 font-semibold">મોબાઇલ:</span>
                                  <span className="font-mono font-black text-sm text-slate-950">{b.customerPhone}</span>
                                </div>
                              )}

                              {/* Action buttons (Call, WhatsApp, Slip) */}
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {b.customerPhone && (
                                  <a
                                    href={`tel:${b.customerPhone}`}
                                    className="py-2 px-2 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] active:bg-[#0077ed] text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>ફોન કરો</span>
                                  </a>
                                )}
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waMessage)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>વોટ્સએપ</span>
                                  </a>
                                )}
                                <Link
                                  href={`/admin/bookings/${b.id}/receipt`}
                                  target="_blank"
                                  className="py-2 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs shadow-2xs transition flex items-center justify-center space-x-1"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                                  <span>રસીદ</span>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: WEEK VIEW */}
      {viewMode === "WEEK" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Weekly Schedule ({currentWeekDays[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – {currentWeekDays[6].toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeekDays.map((dayDate, idx) => {
              const weekBookings = sortBookingsFromMorningToNight(getBookingsForDate(dayDate));
              const isToday = new Date().toDateString() === dayDate.toDateString();

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex flex-col justify-between min-h-[160px] ${
                    isToday ? "border-amber-400 bg-amber-50/30" : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="border-b border-slate-200/80 pb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      {dayDate.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {dayDate.getDate()} {dayDate.toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1.5 flex-1">
                    {weekBookings.length === 0 ? (
                      <span className="text-[10px] text-emerald-700 font-semibold block pt-2">
                        ✓ All Facilities Open
                      </span>
                    ) : (
                      weekBookings.map((wb) => {
                        const pInfo = getSlotPeriodInfo(wb.slot);
                        return (
                          <div
                            key={wb.id}
                            className="bg-white p-2 rounded-lg border border-slate-200 text-[10px] space-y-0.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 truncate">{wb.customerName}</span>
                              <span className={`text-[8px] font-bold px-1 rounded border ${pInfo.badgeClass}`}>
                                {pInfo.periodLabelGu.split(" ")[0]}
                              </span>
                            </div>
                            <div className="text-rose-700 font-semibold truncate">{wb.eventType}</div>
                            <div className="text-slate-500 truncate">{wb.facility?.name}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: DAY VIEW */}
      {viewMode === "DAY" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Single Day Timeline</span>
              <h3 className="text-lg font-bold text-slate-900">
                {currentDate.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
            </div>
            {isSuper && (
              <Link
                href="/admin/bookings"
                className="bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center"
              >
                <Plus className="w-3 h-3 mr-1" />
                Book This Day
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {facilities.map((fac) => {
              const facBookings = sortBookingsFromMorningToNight(
                getBookingsForDate(currentDate).filter((b) => b.facilityId === fac.id)
              );
              const isOccupied = facBookings.length > 0;

              return (
                <div
                  key={fac.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOccupied ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">{fac.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                        {fac.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Capacity: {fac.capacity} {fac.bookingUnit === "PER_BED" ? "Beds" : "Persons"}
                    </p>
                  </div>

                  <div>
                    {isOccupied ? (
                      <div className="flex flex-col sm:items-end space-y-1">
                        {facBookings.map((b) => {
                          const pInfo = getSlotPeriodInfo(b.slot);
                          return (
                            <div key={b.id} className="text-xs text-rose-900 font-bold flex items-center gap-1.5">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded border ${pInfo.badgeClass}`}>
                                {pInfo.periodLabelGu.split(" ")[0]} {pInfo.periodName}
                              </span>
                              <span>
                                Reserved: {b.customerName} ({b.eventType} • {formatSlotLabel(b.slot)})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-3 py-1 rounded-lg inline-flex items-center">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Available for Reservation
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
