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
      const facData = await facRes.json();
      const bookData = await bookRes.json();
      const userData = await userRes.json();

      if (facData.facilities) setFacilities(facData.facilities);
      if (bookData.bookings) setBookings(bookData.bookings);
      if (userData.user) setCurrentUser(userData.user);
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Booking & Availability Calendar
          </h1>
          <p className="text-xs text-slate-500">
            {isSuper
              ? "Multi-view calendar for Outside Party Plot, Multipurpose Hall, Dormitories, and AC Suites."
              : "Click on any date to inspect booked facilities, applicant names, slots, and availability status."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Mode Switcher (Month, Week, Day) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode("MONTH")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "MONTH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("WEEK")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "WEEK" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("DAY")}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === "DAY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day
            </button>
          </div>

          {/* Month / Date Navigation */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold text-slate-800 hover:bg-white rounded-lg transition"
            >
              {viewMode === "MONTH" && `${monthNames[month]} ${year}`}
              {viewMode === "WEEK" && `Week of ${currentWeekDays[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`}
              {viewMode === "DAY" && currentDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isSuper && (
            <Link
              href="/admin/bookings"
              className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Booking
            </Link>
          )}
        </div>
      </div>

      {/* Category Tabs & Direct Facility Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Category Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
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
                  setFilterType(tab.id);
                  setSelectedFacilityId("ALL");
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
                  filterType === tab.id
                    ? "bg-red-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
              className="inline-flex items-center text-xs font-bold text-red-800 hover:text-red-950 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition"
            >
              ✕ Show All Facilities
            </button>
          )}
        </div>

        {/* Direct Facility Cards */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              onClick={() => {
                setSelectedFacilityId("ALL");
                setFilterType("ALL");
              }}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
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
              <div className="mt-1.5">
                <div className="font-extrabold text-xs">All Facilities</div>
                <div className="text-[10px] opacity-75">Combined Master View</div>
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
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-red-800 text-white border-red-900 shadow-md ring-2 ring-red-600"
                      : "bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
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
                      {isPlot ? "Party Plot" : isDorm ? "Dorm" : isRoom ? "Room" : "Hall"}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </div>

                  <div className="mt-1.5">
                    <div className="font-bold text-xs leading-tight line-clamp-1">
                      {f.name.replace("Dormitory — ", "")}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? "text-amber-200" : "text-slate-500"}`}>
                      {isPlot ? "1500 Persons • Wedding & Family" : `${f.capacity} ${isDorm || isRoom ? "Beds" : "Persons"}`}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100 mb-2">
              <span className="text-red-600">Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[75px] bg-slate-50/50 rounded-lg"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayDate = new Date(year, month, dayNum);
                const dayBookings = getBookingsForDay(dayNum);
                const isBooked = dayBookings.length > 0;
                const isSelected = selectedDate && selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDate(dayDate)}
                    className={`min-h-[75px] p-1.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-400"
                        : isBooked
                        ? "bg-rose-50/50 border-rose-200 hover:bg-rose-100/50"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{dayNum}</span>
                      {isBooked ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {isBooked ? (
                        <div className="space-y-0.5">
                          {dayBookings.slice(0, 2).map((b, idx) => (
                            <div
                              key={idx}
                              className="text-[9px] font-semibold bg-rose-200/80 text-rose-900 px-1 py-0.5 rounded truncate"
                              title={`${b.customerName} - ${b.eventType}`}
                            >
                              {b.customerName.split(" ")[0]}: {b.eventType}
                            </div>
                          ))}
                          {dayBookings.length > 2 && (
                            <span className="text-[9px] text-rose-700 font-bold block text-right">
                              +{dayBookings.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-700 font-medium text-center">
                          Open
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Inspector (1 Col) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Day Inspector</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
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

            <div className="flex-1 space-y-3 overflow-y-auto">
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">No Bookings on this Day</p>
                  <p className="text-[11px] text-slate-500">
                    All trust facilities are completely open and available.
                  </p>
                  {isSuper && (
                    <Link
                      href="/admin/bookings"
                      className="inline-flex items-center text-xs text-red-800 font-bold hover:underline pt-2"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Create Booking for this Date
                    </Link>
                  )}
                </div>
              ) : (
                selectedDayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-red-900 bg-red-100 px-2 py-0.5 rounded">
                        {b.bookingNumber}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{b.customerName}</h4>
                      <p className="text-[11px] text-slate-600 font-medium">{b.eventType}</p>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-rose-100">
                      <div className="flex items-center">
                        <Building className="w-3 h-3 mr-1.5 text-slate-400" />
                        <span>{b.facility?.name}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1.5 text-slate-400" />
                        <span>Slot: {b.slot}</span>
                      </div>
                      {b.customerPhone && (
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                          <span>{b.customerPhone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/admin/bookings/${b.id}/receipt`}
                        target="_blank"
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-300 flex items-center"
                      >
                        <FileText className="w-3 h-3 mr-1 text-slate-500" />
                        Print Voucher
                      </Link>
                    </div>
                  </div>
                ))
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
