"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
    endDate: new Date().toISOString().split("T")[0],
    slot: "WHOLE_DAY",
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Booking Detail Modal State
  const [detailBooking, setDetailBooking] = useState<any | null>(null);

  // Export State
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [userRes, bookRes, facRes, discRes, servRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/bookings"),
        fetch("/api/facilities"),
        fetch("/api/discounts"),
        fetch("/api/services"),
      ]);

      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }

      const bookData = await bookRes.json();
      const facData = await facRes.json();
      const discData = await discRes.json();
      const servData = await servRes.json();

      if (bookData.bookings) setBookings(bookData.bookings);
      if (facData.facilities) {
        setFacilities(facData.facilities);
        if (facData.facilities.length > 0 && !formData.facilityId) {
          const firstFac = facData.facilities[0];
          setFormData((prev) => ({
            ...prev,
            facilityId: firstFac.id,
            facilityAmount: firstFac.baseRent || 0,
            depositAmount: firstFac.cautionDeposit || 0,
            totalAmount: firstFac.baseRent || 0,
          }));
        }
      }
      if (discData.discounts) setDiscounts(discData.discounts);
      if (servData.services) setServices(servData.services);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshBookings = async () => {
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (data.bookings) setBookings(data.bookings);
    } catch (err) {
      console.error(err);
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const canExportData = isSuperAdmin || Boolean(currentUser?.canExport);

  const handleFacilityChange = (facId: string) => {
    const fac = facilities.find((f) => f.id === facId);
    let base = fac ? fac.baseRent : 0;
    if (fac?.code === "PLOT-OUTSIDE" || fac?.type === "PLOT") {
      const isWedding =
        (formData.eventType || "").toLowerCase().includes("wedding") ||
        (formData.eventType || "").toLowerCase().includes("lagna") ||
        (formData.eventType || "").toLowerCase().includes("wedd");
      base = isWedding
        ? fac.weddingRent || fac.baseRent || 0
        : fac.familyRent || fac.baseRent || 0;
    }
    const dep = fac ? fac.cautionDeposit : 0;

    let defaultSlot = "FULL_DAY";
    if (fac?.code === "HALL-MULTIPURPOSE") {
      defaultSlot = "WHOLE_DAY";
    } else if (fac?.type === "ROOM" || fac?.type === "DORMITORY") {
      defaultSlot = "NIGHT_STAY";
    }

    recalcFinancials(
      base,
      formData.discountCode,
      formData.discountPercent,
      formData.discountOverridden,
      formData.selectedServices,
      dep,
      facId,
      defaultSlot
    );
  };

  const handlePlotPurposeChange = (purpose: "WEDDING" | "FAMILY") => {
    const fac = facilities.find((f) => f.id === formData.facilityId);
    if (!fac) return;
    const base =
      purpose === "WEDDING"
        ? fac.weddingRent || fac.baseRent || 0
        : fac.familyRent || fac.baseRent || 0;
    const newEventType =
      purpose === "WEDDING"
        ? "Wedding"
        : "Family Function / Sagai";
    setFormData((prev) => ({
      ...prev,
      eventType: newEventType,
    }));
    recalcFinancials(
      base,
      formData.discountCode,
      formData.discountPercent,
      formData.discountOverridden,
      formData.selectedServices,
      formData.depositAmount,
      formData.facilityId,
      formData.slot
    );
  };

  const handleDiscountChange = (code: string) => {
    if (code === "NONE") {
      recalcFinancials(
        formData.facilityAmount,
        "NONE",
        0,
        false,
        formData.selectedServices,
        formData.depositAmount,
        formData.facilityId,
        formData.slot
      );
    } else if (code === "MANUAL_OVERRIDE") {
      recalcFinancials(
        formData.facilityAmount,
        "MANUAL_OVERRIDE",
        formData.discountPercent,
        true,
        formData.selectedServices,
        formData.depositAmount,
        formData.facilityId,
        formData.slot
      );
    } else {
      const rule = discounts.find((d) => d.code === code);
      const percent = rule ? rule.percentage : 0;
      recalcFinancials(
        formData.facilityAmount,
        code,
        percent,
        false,
        formData.selectedServices,
        formData.depositAmount,
        formData.facilityId,
        formData.slot
      );
    }
  };

  const handleServiceToggle = (serviceCode: string) => {
    let updated = [...formData.selectedServices];
    if (updated.includes(serviceCode)) {
      updated = updated.filter((c) => c !== serviceCode);
    } else {
      updated.push(serviceCode);
    }
    recalcFinancials(
      formData.facilityAmount,
      formData.discountCode,
      formData.discountPercent,
      formData.discountOverridden,
      updated,
      formData.depositAmount,
      formData.facilityId,
      formData.slot
    );
  };

  const recalcFinancials = (
    baseFac: number,
    discCode: string,
    discPct: number,
    isOverridden: boolean,
    chosenServices: string[],
    deposit: number,
    facId?: string,
    slotName?: string
  ) => {
    const discAmount = (baseFac * discPct) / 100;

    let servTotal = 0;
    chosenServices.forEach((code) => {
      const s = services.find((serv) => serv.code === code);
      if (s) servTotal += s.price;
    });

    const netTotal = Math.max(0, baseFac - discAmount) + servTotal;

    setFormData((prev) => ({
      ...prev,
      ...(facId && { facilityId: facId }),
      ...(slotName && { slot: slotName }),
      facilityAmount: baseFac,
      discountCode: discCode,
      discountPercent: discPct,
      discountAmount: discAmount,
      discountOverridden: isOverridden,
      selectedServices: chosenServices,
      servicesAmount: servTotal,
      totalAmount: netTotal,
      depositAmount: deposit,
    }));
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to create bookings.");
      return;
    }

    setCreating(true);
    setCreateError("");

    const selectedServiceObjs = formData.selectedServices.map((code) => {
      const s = services.find((srv) => srv.code === code);
      return { name: s?.name || code, code, price: s?.price || 0 };
    });

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          selectedServices: selectedServiceObjs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create booking");
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

  const handleDeleteBooking = async (id: string) => {
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to cancel or delete bookings.");
      return;
    }

    if (!confirm("Are you sure you want to cancel and delete this booking record?")) return;
    try {
      const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        refreshBookings();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete booking");
      }
    } catch (err) {
      console.error(err);
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

  const selectedFacilityObj = facilities.find((f) => f.id === formData.facilityId);

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

      {/* Bookings Container: Responsive Dual-View (Cards for Mobile/Tablet, Full Table for Desktop) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 1. Desktop & iPad Landscape Table View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No booking records found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
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
                          onClick={() => handleDeleteBooking(b.id)}
                          title="Cancel & Delete Booking"
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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
            sortedBookings.map((b) => (
              <div key={b.id} className="p-3.5 sm:p-4 space-y-3 bg-white hover:bg-slate-50/70 transition">
                {/* Card Header: Booking # & Status */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setDetailBooking(b)}
                    className="text-xs font-black text-red-900 bg-red-100/90 hover:bg-red-200 px-2.5 py-1 rounded-lg flex items-center tracking-wide"
                  >
                    {b.bookingNumber}
                  </button>
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
                      onClick={() => handleDeleteBooking(b.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 active:text-rose-700 rounded-xl border border-slate-200 min-h-[40px] min-w-[40px] flex items-center justify-center"
                      title="Delete Booking"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Booking Details Modal (For All Administrators) */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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

      {/* New Booking Modal with Discount & Addon Services (Super Admin Only) */}
      {showCreateModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="bg-red-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-base font-bold">New Booking Entry (With Discounts & Add-ons)</h3>
                <p className="text-xs text-amber-200">
                  Shree Saurashtra Leuva Patel Samaj, Nikol - Naroda
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="m-5 p-3.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="p-5 sm:p-6 space-y-4">
              {/* Facility Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Facility *
                </label>
                <select
                  required
                  value={formData.facilityId}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold focus:ring-2 focus:ring-red-700"
                >
                  <optgroup label="Outside Party Plot (Dual Pricing)">
                    {facilities
                      .filter((f) => f.type === "PLOT")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}) — {f.capacity} Persons (Wedding: ₹{f.weddingRent || 0} / Family: ₹{f.familyRent || 0})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Halls">
                    {facilities
                      .filter((f) => f.type === "HALL")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}) — {f.capacity} Persons {f.baseRent > 0 ? `(₹${f.baseRent.toLocaleString("en-IN")})` : "(Rate Pending)"}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Dormitories">
                    {facilities
                      .filter((f) => f.type === "DORMITORY")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}) — {f.capacity} Beds {f.baseRent > 0 ? `(₹${f.baseRent.toLocaleString("en-IN")}/bed)` : "(Rate Pending)"}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="AC Guest Rooms">
                    {facilities
                      .filter((f) => f.type === "ROOM")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}) — {f.capacity} Beds {f.baseRent > 0 ? `(₹${f.baseRent.toLocaleString("en-IN")})` : "(Rate Pending)"}
                        </option>
                      ))}
                  </optgroup>
                </select>

                {/* Outside Party Plot Dual Rate Purpose Selector */}
                {selectedFacilityObj?.type === "PLOT" && (
                  <div className="mt-2.5 bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-amber-950 block">
                      Outside Party Plot Booking Purpose & Tariff:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handlePlotPurposeChange("WEDDING")}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          (formData.eventType || "").toLowerCase().includes("wedding") ||
                          (formData.eventType || "").toLowerCase().includes("lagna") ||
                          (formData.eventType || "").toLowerCase().includes("wedd")
                            ? "bg-red-800 text-white border-red-900 shadow-xs"
                            : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                      >
                        <div className="font-bold">💍 Wedding Function</div>
                        <div className="text-[11px] opacity-90 mt-0.5">
                          {selectedFacilityObj.weddingRent && selectedFacilityObj.weddingRent > 0
                            ? `₹${selectedFacilityObj.weddingRent.toLocaleString("en-IN")}`
                            : "Rate Pending"}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlotPurposeChange("FAMILY")}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          !(
                            (formData.eventType || "").toLowerCase().includes("wedding") ||
                            (formData.eventType || "").toLowerCase().includes("lagna") ||
                            (formData.eventType || "").toLowerCase().includes("wedd")
                          )
                            ? "bg-red-800 text-white border-red-900 shadow-xs"
                            : "bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                        }`}
                      >
                        <div className="font-bold">👨‍👩‍👧‍👦 Family Function</div>
                        <div className="text-[11px] opacity-90 mt-0.5">
                          {selectedFacilityObj.familyRent && selectedFacilityObj.familyRent > 0
                            ? `₹${selectedFacilityObj.familyRent.toLocaleString("en-IN")}`
                            : "Rate Pending"}
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Applicant Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Applicant / Community Member Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              {/* Aadhar & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Aadhar / ID Card Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Aadhar Number (Optional)"
                    value={formData.customerAadhar}
                    onChange={(e) => setFormData({ ...formData, customerAadhar: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Applicant Address / Native Village
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nikol, Ahmedabad / Amreli"
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>
              </div>

              {/* Function Type & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Function Type *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wedding, Sagai, Birthday"
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate: e.target.value,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={formData.slot}
                    onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold"
                  >
                    {selectedFacilityObj?.code === "HALL-MULTIPURPOSE" ? (
                      <>
                        <option value="WHOLE_DAY">Whole Day (6:00 AM - 12:00 Midnight)</option>
                        <option value="MORNING_SLOT">Morning Slot (6:00 AM - 2:00 PM)</option>
                        <option value="AFTERNOON_SLOT">Afternoon Slot (3:00 PM - 12:00 Midnight)</option>
                      </>
                    ) : selectedFacilityObj?.type === "ROOM" || selectedFacilityObj?.type === "DORMITORY" ? (
                      <>
                        <option value="NIGHT_STAY">Night Stay (24 Hours)</option>
                        <option value="DAY_REST">Day Rest (8 Hours)</option>
                      </>
                    ) : (
                      <>
                        <option value="WHOLE_DAY">Whole Day / Full Event</option>
                        <option value="MORNING">Morning Only</option>
                        <option value="EVENING">Evening Only</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Add-on Services: Cleaning & Waste Collection */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Optional Add-on Trust Services:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {services.map((srv) => {
                    const isChecked = formData.selectedServices.includes(srv.code);
                    return (
                      <label
                        key={srv.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
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
                            className="rounded text-red-800 focus:ring-red-700"
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

              {/* Non-Stackable Discount Rules */}
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center">
                    <Percent className="w-3.5 h-3.5 mr-1 text-red-800" />
                    Trustee & Room Donor Discount Policy:
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                    Non-Stackable
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Select Discount Category
                    </label>
                    <select
                      value={formData.discountCode}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 text-slate-800 font-semibold"
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
                            recalcFinancials(
                              formData.facilityAmount,
                              "MANUAL_OVERRIDE",
                              Number(e.target.value),
                              true,
                              formData.selectedServices,
                              formData.depositAmount
                            )
                          }
                          className="w-20 text-xs bg-white border border-amber-300 rounded-lg p-2 font-bold"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Mandatory Audit Reason"
                          value={formData.discountOverrideReason}
                          onChange={(e) =>
                            setFormData({ ...formData, discountOverrideReason: e.target.value })
                          }
                          className="flex-1 text-xs bg-white border border-amber-300 rounded-lg p-2 text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial Breakdown Preview */}
                <div className="bg-white p-3 rounded-lg border border-amber-200 text-xs space-y-1 mt-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Facility Charge:</span>
                    <span className="font-semibold text-slate-800">
                      ₹{formData.facilityAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {formData.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount ({formData.discountPercent}%):</span>
                      <span>- ₹{formData.discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {formData.servicesAmount > 0 && (
                    <div className="flex justify-between text-blue-700 font-semibold">
                      <span>Add-on Services Total:</span>
                      <span>+ ₹{formData.servicesAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-slate-200">
                    <span>Final Payable Amount:</span>
                    <span className="text-red-900">
                      ₹{formData.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Refundable Caution Deposit:</span>
                    <span>₹{formData.depositAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  >
                    <option value="CASH_AT_OFFICE">Cash at Office</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OFFLINE_UPI">Offline UPI / QR</option>
                    <option value="NEFT_RTGS">NEFT / Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Receipt / Cheque / UTR Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Reference number"
                    value={formData.paymentRefNo}
                    onChange={(e) => setFormData({ ...formData, paymentRefNo: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition"
                >
                  {creating ? "Confirming Booking..." : "Confirm & Save Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
