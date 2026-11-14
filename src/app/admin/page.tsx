"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Building,
  PlusCircle,
  ArrowRight,
  FileText,
  Phone,
  XCircle,
  AlertCircle,
  CalendarDays,
  Shield,
  Layers,
  History,
} from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
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
      if (userData.user) {
        if (userData.user.role === "VIEW_ONLY_ADMIN") {
          router.replace("/admin/calendar");
          return;
        }
        setCurrentUser(userData.user);
      }
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSuper = currentUser?.role === "SUPER_ADMIN";

  // Calculations for KPI Cards
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = bookings.filter((b) => {
    const s = new Date(b.startDate);
    const e = new Date(b.endDate || b.startDate);
    return s <= todayEnd && e >= todayStart && b.status !== "CANCELLED";
  });

  const upcomingBookings = [...bookings]
    .filter((b) => new Date(b.startDate) >= todayStart && b.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const pendingBookings = bookings.filter((b) => b.status === "PENDING_APPROVAL");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full overflow-hidden border-2 border-white/70 shadow-sm bg-white">
            <Image
              src="/images/sardar-vallabhbhai-patel.jpg"
              alt="Sardar Vallabhbhai Patel"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                ॥ ૐ નમઃ શિવાય ॥ Shree Saurashtra Patel Samaj, Nikol - Naroda
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              Private Admin Booking Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Logged in as <strong>{currentUser?.name}</strong> ({currentUser?.email}) •{" "}
              <span className={isSuper ? "text-amber-300 font-bold" : "text-slate-300"}>
                {isSuper ? "Super Administrator (Full Modify & Audit Access)" : "View-Only Administrator"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSuper && (
            <Link
              href="/admin/bookings"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow transition flex items-center"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              New Booking Entry
            </Link>
          )}
          <Link
            href="/admin/calendar"
            className="bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-2 rounded-xl text-xs border border-white/20 transition flex items-center"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Booking Calendar
          </Link>
        </div>
      </div>

      {/* KPI Cards: Required Dashboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total</span>
            <CalendarDays className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-slate-900">{bookings.length}</div>
            <span className="text-[10px] text-slate-400">All registered</span>
          </div>
        </div>

        {/* Today */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-blue-900">{todayBookings.length}</div>
            <span className="text-[10px] text-blue-600 font-medium">In session / active</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Upcoming</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-purple-900">{upcomingBookings.length}</div>
            <span className="text-[10px] text-purple-600 font-medium">Scheduled ahead</span>
          </div>
        </div>

        {/* Confirmed */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-emerald-900">{confirmedBookings.length}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Approved events</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-amber-900">{pendingBookings.length}</div>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting approval</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cancelled</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-rose-900">{cancelledBookings.length}</div>
            <span className="text-[10px] text-rose-500 font-medium">Voided records</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upcoming Bookings & Facility Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Bookings List (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Upcoming Scheduled Bookings</h2>
              <p className="text-xs text-slate-500">Chronological list of upcoming functions & stays</p>
            </div>
            <Link
              href="/admin/bookings"
              className="text-xs font-bold text-red-800 hover:text-red-700 flex items-center"
            >
              All Bookings <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {upcomingBookings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No upcoming bookings scheduled.
              </div>
            ) : (
              upcomingBookings.slice(0, 6).map((b) => (
                <div
                  key={b.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-extrabold text-red-900 bg-red-100 px-2 py-0.5 rounded">
                        {b.bookingNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{b.customerName}</span>
                      <span className="text-[11px] text-slate-500">({b.eventType})</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "PENDING_APPROVAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                      <span className="font-semibold text-slate-800 flex items-center">
                        <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {b.facility?.name}
                      </span>
                      <span className="flex items-center text-slate-600">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {new Date(b.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        • {b.slot}
                      </span>
                      {b.customerPhone && (
                        <span className="flex items-center text-slate-500">
                          <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {b.customerPhone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    <Link
                      href={`/admin/bookings/${b.id}/receipt`}
                      target="_blank"
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition flex items-center"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1 text-slate-600" />
                      Slip
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Facility-wise Booking Overview (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Facility Breakdown</h2>
              <p className="text-xs text-slate-500">Active physical facilities ({facilities.length})</p>
            </div>
            <Link
              href="/admin/facilities"
              className="text-xs font-bold text-red-800 hover:text-red-700"
            >
              Manage
            </Link>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {facilities.map((fac) => {
              const facBookings = bookings.filter((b) => b.facilityId === fac.id);
              const confirmedCount = facBookings.filter((b) => b.status === "CONFIRMED").length;

              return (
                <div
                  key={fac.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                      {fac.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 uppercase">
                      {fac.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Capacity: <strong>{fac.capacity}</strong>
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {confirmedCount} Confirmed ({facBookings.length} Total)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
