"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Edit2,
  Users,
  CheckCircle,
  XCircle,
  Sparkles,
  Save,
  X,
  Layers,
  Clock,
  Image as ImageIcon,
  Calendar,
  Filter,
} from "lucide-react";

export default function FacilitiesManagementPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Edit / Add Modal
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "HALL",
    resourceGroup: "",
    capacity: 100,
    floor: "Ground Floor",
    description: "",
    amenities: "",
    photos: "",
    baseRent: 0,
    weddingRent: 0,
    familyRent: 0,
    cautionDeposit: 0,
    cleaningCharge: 0,
    isRateConfigured: false,
    bookingDuration: "Full Day",
    availableSlots: "",
    bookingUnit: "ENTIRE_FACILITY",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, facRes, bookRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/facilities"),
        fetch("/api/bookings"),
      ]);
      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }
      const facData = await facRes.json();
      const bookData = await bookRes.json();

      if (facData.facilities) setFacilities(facData.facilities);
      if (bookData.bookings) setBookings(bookData.bookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const handleOpenAdd = () => {
    setEditingFacility(null);
    setFormData({
      name: "",
      code: `FAC-${facilities.length + 1}`,
      type: "HALL",
      resourceGroup: `RESOURCE_FAC_${facilities.length + 1}`,
      capacity: 100,
      floor: "Ground Floor",
      description: "",
      amenities: "Air Conditioning, Sound System, Chairs",
      photos: "",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Full Day / Slot Basis",
      availableSlots: "",
      bookingUnit: "ENTIRE_FACILITY",
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (f: any) => {
    setEditingFacility(f);
    setFormData({
      name: f.name,
      code: f.code,
      type: f.type,
      resourceGroup: f.resourceGroup || `RESOURCE_${f.code}`,
      capacity: f.capacity,
      floor: f.floor || "",
      description: f.description || "",
      amenities: f.amenities || "",
      photos: f.photos || "",
      baseRent: f.baseRent || 0,
      weddingRent: f.weddingRent || 0,
      familyRent: f.familyRent || 0,
      cautionDeposit: f.cautionDeposit || 0,
      cleaningCharge: f.cleaningCharge || 0,
      isRateConfigured: f.isRateConfigured ?? (f.baseRent > 0 || f.weddingRent > 0 || f.familyRent > 0),
      bookingDuration: f.bookingDuration || "",
      availableSlots: f.availableSlots || "",
      bookingUnit: f.bookingUnit || "ENTIRE_FACILITY",
      isActive: f.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingFacility) {
        // Update
        const res = await fetch("/api/facilities", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingFacility.id, ...formData }),
        });
        if (res.ok) {
          setShowModal(false);
          fetchData();
        }
      } else {
        // Create
        const res = await fetch("/api/facilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          setShowModal(false);
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Booking stats for a facility
  const getFacilityStats = (facId: string, resGroup: string) => {
    const facBookings = bookings.filter(
      (b) => b.facilityId === facId || (resGroup && b.resourceGroup === resGroup)
    );
    const confirmed = facBookings.filter((b) => b.status === "CONFIRMED").length;
    const pending = facBookings.filter((b) => b.status === "PENDING_APPROVAL").length;
    const cancelled = facBookings.filter((b) => b.status === "CANCELLED").length;
    return { confirmed, pending, cancelled, total: facBookings.length };
  };

  const displayedFacilities = facilities.filter((f) => {
    if (filterType === "ALL") return true;
    return f.type === filterType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
            Infrastructure Configuration
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Halls, Party Plots, Dormitories & Rooms
          </h1>
          <p className="text-xs text-slate-500">
            Manage physical inventory, shared calendar groups, pricing, capacities, and time slots.
          </p>
        </div>

        {isSuperAdmin ? (
          <button
            onClick={handleOpenAdd}
            className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center self-start md:self-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Facility
          </button>
        ) : (
          <span className="text-xs bg-slate-100 text-slate-600 border border-slate-300 font-semibold px-3 py-2 rounded-lg self-start md:self-auto flex items-center">
            View-Only Access
          </span>
        )}
      </div>

      {/* Category Tabs (Synchronized with Frontend) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              onClick={() => setFilterType(tab.id)}
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

        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold px-2.5 py-1 rounded-lg flex items-center">
          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          {facilities.length} Facilities Active & Synced
        </span>
      </div>

      {/* Facilities Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedFacilities.map((fac) => {
          const stats = getFacilityStats(fac.id, fac.resourceGroup);
          const hasRate = fac.isRateConfigured && fac.baseRent > 0;

          return (
            <div
              key={fac.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 ${
                !fac.isActive ? "border-slate-300 opacity-70 bg-slate-50/70" : "border-slate-200"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 uppercase tracking-wider">
                    {fac.type} • {fac.code}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{fac.floor}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {fac.name}
                  </h3>
                  {fac.resourceGroup && (
                    <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block border border-amber-200">
                      Shared Calendar Group: <strong>{fac.resourceGroup}</strong>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {fac.description || "No description provided."}
                </p>

                {/* Capacity & Pricing Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Capacity:
                    </span>
                    <span className="font-bold text-slate-800">
                      {fac.capacity} {fac.bookingUnit === "PER_BED" ? "Beds" : "Persons / Guests"}
                    </span>
                  </div>

                  {fac.type === "PLOT" || fac.code === "PLOT-OUTSIDE" ? (
                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Dual Event Tariffs:
                      </span>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600">💍 Wedding Functions:</span>
                        {fac.weddingRent && fac.weddingRent > 0 ? (
                          <span className="font-extrabold text-slate-900">₹{fac.weddingRent.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Rate Not Configured
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600">🎉 Family Functions:</span>
                        {fac.familyRent && fac.familyRent > 0 ? (
                          <span className="font-extrabold text-slate-900">₹{fac.familyRent.toLocaleString("en-IN")}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Rate Not Configured
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Tariff:</span>
                      {hasRate ? (
                        <span className="font-extrabold text-slate-900">
                          ₹{fac.baseRent.toLocaleString("en-IN")}{" "}
                          <span className="text-[10px] font-normal text-slate-500">
                            {fac.bookingUnit === "PER_BED" ? "/ bed" : "/ booking"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                          Rate Not Configured (Contact Admin)
                        </span>
                      )}
                    </div>
                  )}

                  {fac.bookingDuration && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        Slots:
                      </span>
                      <span className="text-slate-700 font-medium truncate max-w-[180px]">
                        {fac.bookingDuration}
                      </span>
                    </div>
                  )}
                </div>

                {/* Booking Status Counts */}
                <div className="grid grid-cols-3 gap-1 text-center bg-slate-100/60 p-2 rounded-lg text-[10px]">
                  <div>
                    <span className="text-emerald-700 font-bold block">{stats.confirmed}</span>
                    <span className="text-slate-500">Confirmed</span>
                  </div>
                  <div>
                    <span className="text-amber-700 font-bold block">{stats.pending}</span>
                    <span className="text-slate-500">Pending</span>
                  </div>
                  <div>
                    <span className="text-rose-700 font-bold block">{stats.cancelled}</span>
                    <span className="text-slate-500">Cancelled</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold flex items-center ${
                    fac.isActive ? "text-emerald-700" : "text-slate-400"
                  }`}
                >
                  {fac.isActive ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Disabled
                    </>
                  )}
                </span>
                <button
                  onClick={() => handleOpenEdit(fac)}
                  className="text-xs font-bold text-red-800 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition flex items-center"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  {isSuperAdmin ? "Edit Details & Pricing" : "View Details"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-base font-bold">
                {editingFacility ? `Edit: ${editingFacility.name}` : "Add New Facility"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Facility Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Multipurpose Hall / Outside Party Plot"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Facility Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingFacility}
                    placeholder="HALL-1"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  >
                    <option value="HALL">Banquet / Multipurpose Hall</option>
                    <option value="PLOT">Party Plot (Open Ground)</option>
                    <option value="DORMITORY">Dormitory</option>
                    <option value="ROOM">AC Room / Suite</option>
                  </select>
                </div>
              </div>

              {/* Physical Resource Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Shared Physical Resource Group (For Shared Calendars)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RESOURCE_PARTY_PLOT or leave blank for unique"
                  value={formData.resourceGroup}
                  onChange={(e) => setFormData({ ...formData, resourceGroup: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Facilities with the same Resource Group share the same physical space and cannot have overlapping bookings.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Capacity (Persons / Beds) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: Number(e.target.value) })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Booking Basis / Unit
                  </label>
                  <select
                    value={formData.bookingUnit}
                    onChange={(e) => setFormData({ ...formData, bookingUnit: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  >
                    <option value="ENTIRE_FACILITY">Entire Facility / Hall / Plot</option>
                    <option value="PER_BED">Per Bed Basis (Dormitories)</option>
                    <option value="ENTIRE_ROOM">Entire Room Basis (AC Rooms)</option>
                  </select>
                </div>
              </div>

              {/* Dual Pricing for Party Plot */}
              {(formData.type === "PLOT" || formData.code === "PLOT-OUTSIDE") && (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Outside Party Plot Dual Event Tariffs</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Set separate tariffs for Wedding Functions vs. Family Functions for this single physical plot.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        💍 Wedding Functions Tariff (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.weddingRent}
                        onChange={(e) =>
                          setFormData({ ...formData, weddingRent: Number(e.target.value) })
                        }
                        className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-red-700"
                        placeholder="e.g. 51000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        🎉 Family Functions Tariff (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.familyRent}
                        onChange={(e) =>
                          setFormData({ ...formData, familyRent: Number(e.target.value) })
                        }
                        className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-red-700"
                        placeholder="e.g. 31000"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Standard / Base Rent (₹) — Enter 0 if not configured
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.baseRent}
                    onChange={(e) =>
                      setFormData({ ...formData, baseRent: Number(e.target.value) })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    If 0, public view displays &apos;Rate Not Configured / Contact Admin&apos;.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Caution Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.cautionDeposit}
                    onChange={(e) =>
                      setFormData({ ...formData, cautionDeposit: Number(e.target.value) })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Booking Duration & Slot Timings Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Whole Day (6 AM - 12 AM), Morning (6 AM - 2 PM), Afternoon (3 PM - 12 AM)"
                  value={formData.bookingDuration}
                  onChange={(e) => setFormData({ ...formData, bookingDuration: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amenities (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="AC, Generator, Sound System, Elevator, RO Water"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="facActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-red-800 rounded"
                />
                <label htmlFor="facActive" className="text-xs font-semibold text-slate-700">
                  Enable facility for public availability and bookings
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {isSuperAdmin ? "Cancel" : "Close"}
                </button>
                {isSuperAdmin && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition"
                  >
                    {saving ? "Saving..." : "Save Facility"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
