"use client";

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [facRes, bookRes, userRes] = await Promise.all([
        fetch("/api/facilities"),
        fetch("/api/bookings"),
        fetch("/api/auth/me"),
      ]);
      const [facData, bookData, userData] = await Promise.all([
        facRes.ok ? facRes.json() : Promise.resolve({ facilities: [] }),
        bookRes.ok ? bookRes.json() : Promise.resolve({ bookings: [] }),
        userRes.ok ? userRes.json() : Promise.resolve({ user: null }),
      ]);

      if (facData?.facilities) setFacilities(facData.facilities);
      if (bookData?.bookings) setBookings(bookData.bookings);
      if (userData?.user) setCurrentUser(userData.user);
    } catch (err) {
      console.error(err);
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

      const matches = targetStr >= startStr && targetStr <= endStr;
      return matches && b.status !== "CANCELLED";
    });
  };

  const getBookingsForDay = (dayNum: number) => {
    return getBookingsForDate(new Date(year, month, dayNum));
  };

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

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
          {/* View Mode Switcher (Month, Week, Day) */}
          <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode("MONTH")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition min-h-[36px] sm:min-h-0 flex items-center justify-center ${
                viewMode === "MONTH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition min-h-[36px] sm:min-h-0 flex items-center justify-center ${
                viewMode === "WEEK" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("DAY")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition min-h-[36px] sm:min-h-0 flex items-center justify-center ${
                viewMode === "DAY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day
            </button>
          </div>

          {/* Month / Date Navigation */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200">
            <button
              onClick={prevMonth}
              aria-label="Previous Period"
              className="p-1 sm:p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition shadow-xs min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-slate-800 hover:bg-white rounded-lg transition whitespace-nowrap min-h-[36px] flex items-center justify-center"
            >
              {viewMode === "MONTH" && `${monthNames[month]} ${year}`}
              {viewMode === "WEEK" && `Week of ${currentWeekDays[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`}
              {viewMode === "DAY" && currentDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </button>
            <button
              onClick={nextMonth}
              aria-label="Next Period"
              className="p-1 sm:p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition shadow-xs min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isSuper && (
            <Link
              href="/admin/bookings?new=true"
              className="bg-red-800 hover:bg-red-700 active:scale-95 text-white text-xs sm:text-sm font-black px-3.5 sm:px-4 py-2 rounded-xl shadow-md transition flex items-center min-h-[38px] border border-amber-400/40"
            >
              <Plus className="w-4 h-4 mr-1.5 text-amber-300 stroke-[3]" />
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
                className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-full transition whitespace-nowrap flex-shrink-0 min-h-[32px] ${
                  filterType === tab.id
                    ? "bg-red-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300"
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
              className="inline-flex items-center text-[11px] sm:text-xs font-bold text-red-800 hover:text-red-950 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition self-start sm:self-auto flex-shrink-0"
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
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-sm font-black text-slate-700 pb-2 sm:pb-3 border-b-2 border-slate-200 mb-2 sm:mb-3">
              <span className="text-red-700 font-black"><span className="sm:hidden">રવિ</span><span className="hidden sm:inline">રવિ (Sun)</span></span>
              <span><span className="sm:hidden">સોમ</span><span className="hidden sm:inline">સોમ (Mon)</span></span>
              <span><span className="sm:hidden">મંગળ</span><span className="hidden sm:inline">મંગળ (Tue)</span></span>
              <span><span className="sm:hidden">બુધ</span><span className="hidden sm:inline">બુધ (Wed)</span></span>
              <span><span className="sm:hidden">ગુરુ</span><span className="hidden sm:inline">ગુરુ (Thu)</span></span>
              <span><span className="sm:hidden">શુક્ર</span><span className="hidden sm:inline">શુક્ર (Fri)</span></span>
              <span><span className="sm:hidden">શનિ</span><span className="hidden sm:inline">શનિ (Sat)</span></span>
            </div>

            <div className="mb-2 flex items-center justify-end gap-3 text-[10px] font-bold text-slate-600 sm:mb-3 sm:text-xs" aria-label="Calendar availability legend">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                Booked
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[54px] sm:min-h-[76px] md:min-h-[88px] bg-slate-50/60 rounded-xl border border-dashed border-slate-200/80"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayDate = new Date(year, month, dayNum);
                const dayBookings = getBookingsForDay(dayNum);
                const isBooked = dayBookings.length > 0;
                const isSelected = selectedDate && selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

                return (
                  <button
                    type="button"
                    key={`day-${dayNum}`}
                    aria-label={`${dayDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}: ${isBooked ? `${dayBookings.length} booking${dayBookings.length === 1 ? "" : "s"}` : "available"}`}
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
                    className={`min-w-0 min-h-[54px] sm:min-h-[76px] md:min-h-[92px] p-1 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 transition cursor-pointer flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      isBooked
                        ? `bg-rose-200 border-rose-400 text-rose-950 ${isSelected ? "ring-4 ring-amber-400/70 border-amber-500 shadow-md" : "hover:bg-rose-300 hover:border-rose-500"}`
                        : `bg-emerald-200 border-emerald-400 text-emerald-950 ${isSelected ? "ring-4 ring-amber-400/70 border-amber-500 shadow-md" : "hover:bg-emerald-300 hover:border-emerald-500"}`
                    }`}
                  >
                    <span className="text-sm font-black leading-none sm:text-lg md:text-xl">{dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Inspector */}
          <div
            id="day-inspector-section"
            className="bg-white rounded-3xl border-2 border-slate-200 shadow-md p-4 sm:p-6 space-y-4 flex flex-col scroll-mt-20"
          >
            <div className="border-b-2 border-slate-100 pb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  તારીખ વિગત (Day Details)
                </span>
                {selectedDayBookings.length > 0 ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-300">
                    🔴 {selectedDayBookings.length} બુકિંગ છે
                  </span>
                ) : (
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🟢 ખાલી છે (Open)
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Select a day"}
              </h3>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto">
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-10 space-y-3 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 p-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
                    <CheckCircle className="w-8 h-8 text-emerald-600 stroke-[2.2]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base sm:text-lg font-black text-slate-900">
                      આ દિવસે કોઈ બુકિંગ નથી
                    </h4>
                    <p className="text-xs sm:text-sm font-semibold text-slate-500">
                      તમામ હોલ અને પ્લોટ સંપૂર્ણ ખાલી અને ઉપલબ્ધ છે.
                    </p>
                  </div>
                  {isSuper && (
                    <Link
                      href={`/admin/bookings?new=true&date=${selectedDate ? selectedDate.toISOString().split("T")[0] : ""}`}
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition space-x-1.5 mt-2 min-h-[44px]"
                    >
                      <Plus className="w-4 h-4 text-amber-300 stroke-[3]" />
                      <span>આ તારીખ માટે નવું બુકિંગ કરો</span>
                    </Link>
                  )}
                </div>
              ) : (
                selectedDayBookings.map((b) => {
                  const cleanPhone = b.customerPhone?.replace(/\D/g, "") || "";
                  const waMessage = `શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ-નરોડા)\nજય શ્રી ખોડિયાર 🙏\n\nઆપનું બુકિંગ કન્ફર્મ થયેલ છે:\n• બુકિંગ નંબર: ${b.bookingNumber}\n• અરજદાર: ${b.customerName}\n• સુવિધા: ${b.facility?.name || ""}\n• પ્રસંગ: ${b.eventType}\n• તારીખ: ${new Date(b.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}\n• સમય: ${b.slot}\n\nશ્રી સૌરાષ્ટ્ર પટેલ સમાજ ટ્રસ્ટ, નિકોલ-નરોડા, અમદાવાદ.`;

                  return (
                    <div
                      key={b.id}
                      className="p-4 sm:p-5 rounded-2xl border-2 border-red-200 bg-red-50/50 space-y-3.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-red-200/60">
                        <span className="text-xs sm:text-sm font-black text-red-900 bg-red-200/90 px-3 py-1 rounded-lg font-mono border border-red-300">
                          {b.bookingNumber}
                        </span>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {b.status}
                        </span>
                      </div>

                      {/* Applicant & Event Details */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          અરજદારનું નામ (Applicant)
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                          {b.customerName}
                        </h4>
                        <p className="text-xs sm:text-sm font-bold text-red-800 mt-0.5">
                          🎉 {b.eventType} ({b.slot})
                        </p>
                      </div>

                      {/* Facility & Phone Info */}
                      <div className="bg-white/95 rounded-xl p-3 border border-red-200/70 space-y-2 text-xs sm:text-sm shadow-2xs">
                        <div className="flex items-center text-slate-700 font-semibold">
                          <Building className="w-4 h-4 mr-2 text-red-700 shrink-0" />
                          <span className="font-bold text-slate-900">{b.facility?.name}</span>
                        </div>
                        {b.customerPhone && (
                          <div className="flex items-center text-slate-900 pt-1.5 border-t border-slate-100">
                            <Phone className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
                            <span className="text-xs text-slate-500 mr-2 font-semibold">મોબાઇલ:</span>
                            <span className="font-mono font-black text-sm sm:text-base text-slate-950">
                              {b.customerPhone}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Elder-Friendly Action Shortcuts (Big touch targets min 44px) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {b.customerPhone && (
                          <a
                            href={`tel:${b.customerPhone}`}
                            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow transition flex items-center justify-center space-x-1.5 min-h-[44px]"
                          >
                            <Phone className="w-4 h-4" />
                            <span>ફોન કરો (Call)</span>
                          </a>
                        )}

                        {cleanPhone && (
                          <a
                            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow transition flex items-center justify-center space-x-1.5 min-h-[44px]"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>વોટ્સએપ રસીદ</span>
                          </a>
                        )}

                        <Link
                          href={`/admin/bookings/${b.id}/receipt`}
                          target="_blank"
                          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border-2 border-slate-300 font-extrabold text-xs sm:text-sm shadow-2xs transition flex items-center justify-center space-x-1.5 min-h-[44px]"
                        >
                          <Printer className="w-4 h-4 text-slate-600" />
                          <span>રસીદ પ્રિન્ટ</span>
                        </Link>
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
              const weekBookings = getBookingsForDate(dayDate);
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
                      weekBookings.map((wb) => (
                        <div
                          key={wb.id}
                          className="bg-white p-2 rounded-lg border border-rose-200 text-[10px] space-y-0.5 shadow-2xs"
                        >
                          <div className="font-bold text-slate-900 truncate">{wb.customerName}</div>
                          <div className="text-rose-700 font-semibold truncate">{wb.eventType}</div>
                          <div className="text-slate-500 truncate">{wb.facility?.name}</div>
                        </div>
                      ))
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
              const facBookings = getBookingsForDate(currentDate).filter((b) => b.facilityId === fac.id);
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
                        {facBookings.map((b) => (
                          <div key={b.id} className="text-xs text-rose-900 font-bold flex items-center">
                            <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5"></span>
                            Reserved: {b.customerName} ({b.eventType} • {b.slot})
                          </div>
                        ))}
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
