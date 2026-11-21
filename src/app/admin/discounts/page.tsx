"use client";

import React, { useState, useEffect } from "react";
import {
  Percent,
  Sparkles,
  Edit2,
  CheckCircle,
  Save,
  AlertCircle,
  Shield,
  Layers,
  Plus,
  Trash2,
  X,
  Tag,
} from "lucide-react";

export default function DiscountsAndServicesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Discount Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    percentage: 10,
    description: "",
    isActive: true,
  });

  // Edit Discount Modal
  const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
  const [discountForm, setDiscountForm] = useState({
    name: "",
    code: "",
    percentage: 0,
    description: "",
    isActive: true,
  });

  // Delete Discount Confirmation Dialog
  const [deleteConfirmDiscount, setDeleteConfirmDiscount] = useState<any | null>(null);

  // Edit Service Modal
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    price: 0,
    description: "",
    isActive: true,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, discRes, servRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/discounts"),
        fetch("/api/services"),
      ]);

      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }
      const discData = await discRes.json();
      const servData = await servRes.json();

      if (discData.discounts) setDiscounts(discData.discounts);
      if (servData.services) setServices(servData.services);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDiscountClick = (d: any) => {
    setEditingDiscount(d);
    setDiscountForm({
      name: d.name,
      code: d.code,
      percentage: d.percentage,
      description: d.description || "",
      isActive: d.isActive,
    });
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create discount rule");
      }
      setShowCreateModal(false);
      setMsg(`New discount "${data.discount?.name}" added successfully.`);
      fetchData();
      setTimeout(() => setMsg(""), 4000);
    } catch (err: any) {
      setErrMsg(err.message || "Failed to create discount rule");
      alert(err.message || "Failed to create discount rule");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount) return;
    setSaving(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/discounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDiscount.id, ...discountForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update discount rule");
      }
      setEditingDiscount(null);
      setMsg("Discount policy updated successfully.");
      fetchData();
      setTimeout(() => setMsg(""), 3500);
    } catch (err: any) {
      setErrMsg(err.message || "Failed to update discount rule");
      alert(err.message || "Failed to update discount rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDiscount = async () => {
    if (!deleteConfirmDiscount) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discounts?id=${deleteConfirmDiscount.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete discount rule");
      }
      setDiscounts((prev) => prev.filter((d) => d.id !== deleteConfirmDiscount.id));
      setDeleteConfirmDiscount(null);
      setMsg("Discount rule removed successfully.");
      setTimeout(() => setMsg(""), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to delete discount rule");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditServiceClick = (s: any) => {
    setEditingService(s);
    setServiceForm({
      name: s.name,
      price: s.price,
      description: s.description || "",
      isActive: s.isActive,
    });
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setSaving(true);
    try {
      const res = await fetch("/api/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingService.id, ...serviceForm }),
      });
      if (res.ok) {
        setEditingService(null);
        setMsg("Add-on service rate updated successfully.");
        fetchData();
        setTimeout(() => setMsg(""), 3500);
      }
    } catch (err) {
      alert("Failed to update service");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">
            Tariff & Policy Configuration
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Discounts & Add-on Services
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage official trustee and donor discount policies and optional cleaning and food disposal services.
          </p>
        </div>

        {msg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center shadow-sm">
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
            {msg}
          </div>
        )}
      </div>

      {/* 1. Discount Management Section */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-800 shrink-0">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Samaj Discount Rules (સમાજ ડિસ્કાઉન્ટ નીતિ)
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Non-stackable trust policies applied to facility rent only
              </span>
            </div>
          </div>

          {currentUser?.role === "SUPER_ADMIN" && (
            <button
              onClick={() => {
                setCreateForm({
                  name: "",
                  code: "",
                  percentage: 10,
                  description: "",
                  isActive: true,
                });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0066cc] hover:bg-[#0055b3] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Discount (નવું ડિસ્કાઉન્ટ)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {discounts.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-200 uppercase tracking-wider font-mono">
                    {d.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      d.isActive
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {d.isActive ? "Active Policy" : "Disabled"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{d.name}</h3>
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-3xl font-black text-red-900 tracking-tight">
                      {d.percentage}%
                    </span>
                    <span className="text-xs font-medium text-slate-500">Off Facility Rent</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed min-h-[32px]">
                  {d.description || "Official trust discount entitlement for authorized applicants."}
                </p>

                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                  <div className="font-semibold flex items-center">
                    <Shield className="w-3.5 h-3.5 mr-1 text-amber-700" />
                    Policy Enforcement:
                  </div>
                  <div>• Single discount only (No multiple stacking)</div>
                  <div>• Does not discount cleaning or food disposal add-ons</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {currentUser?.role === "SUPER_ADMIN" ? (
                  <>
                    <button
                      onClick={() => setDeleteConfirmDiscount(d)}
                      className="text-xs font-semibold text-slate-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition flex items-center gap-1"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={() => handleEditDiscountClick(d)}
                      className="text-xs font-bold text-[#0066cc] hover:text-[#0055b3] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Details (વિગત સુધારો)</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold italic">
                    Read-Only Policy
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Add-on Services Section */}
      <section className="space-y-4 pt-4">
        <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Optional Add-on Services
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Does not block facility availability
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider font-mono">
                    {s.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      s.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.isActive ? "Available Service" : "Disabled"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{s.name}</h3>
                  <div className="mt-1 flex items-baseline space-x-1">
                    {s.price > 0 ? (
                      <>
                        <span className="text-2xl font-black text-slate-900">
                          ₹{s.price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-500">per booking</span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md">
                        Rate Not Configured (Contact Admin)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {s.description}
                </p>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600">
                  <span className="font-semibold block text-slate-700">Billing Notice:</span>
                  Included as a separate line item on the booking slip.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                {currentUser?.role === "SUPER_ADMIN" ? (
                  <button
                    onClick={() => handleEditServiceClick(s)}
                    className="text-xs font-bold text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 transition flex items-center"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Configure Service Charge
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold italic">
                    Read-Only Service
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CREATE Discount Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#0066cc] flex items-center justify-center text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Add New Discount Rule</h3>
                  <p className="text-[11px] text-slate-300">નવું ડિસ્કાઉન્ટ નીતિ ઉમેરો</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDiscount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Discount Policy Name (ડિસ્કાઉન્ટનું નામ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Life Member / આજીવન સભ્ય અથવા Trustee Option 3"
                  value={createForm.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoCode = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 20);
                    setCreateForm({
                      ...createForm,
                      name: val,
                      code: createForm.code ? createForm.code : autoCode,
                    });
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Discount Percentage (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      required
                      min="0"
                      max="100"
                      value={createForm.percentage}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          percentage: Number(e.target.value),
                        })
                      }
                      className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold focus:bg-white focus:border-[#0066cc] outline-none pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unique Code (કૉડ) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LIFE_MEMBER"
                    value={createForm.code}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "_"),
                      })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono font-bold focus:bg-white focus:border-[#0066cc] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Eligibility Notes (વિગત અને પાત્રતા)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Official discount for registered donor families and trust executives."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="createDiscActive"
                  checked={createForm.isActive}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[#0066cc] rounded accent-[#0066cc]"
                />
                <label htmlFor="createDiscActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Enable this discount rule immediately for bookings (તરત જ સક્રિય કરો)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? "Creating..." : "+ Add Discount (ઉમેરો)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT Discount Modal */}
      {editingDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Edit Discount Policy</h3>
                  <p className="text-[11px] text-slate-300">ડિસ્કાઉન્ટ વિગતોમાં સુધારો કરો</p>
                </div>
              </div>
              <button
                onClick={() => setEditingDiscount(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Policy Name (ડિસ્કાઉન્ટનું નામ) *
                </label>
                <input
                  type="text"
                  required
                  value={discountForm.name}
                  onChange={(e) =>
                    setDiscountForm({ ...discountForm, name: e.target.value })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Discount Percentage (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      required
                      min="0"
                      max="100"
                      value={discountForm.percentage}
                      onChange={(e) =>
                        setDiscountForm({
                          ...discountForm,
                          percentage: Number(e.target.value),
                        })
                      }
                      className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold focus:bg-white focus:border-[#0066cc] outline-none pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rule Code (કૉડ) *
                  </label>
                  <input
                    type="text"
                    required
                    value={discountForm.code}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "_"),
                      })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono font-bold focus:bg-white focus:border-[#0066cc] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Eligibility Notes (વિગત અને પાત્રતા)
                </label>
                <textarea
                  rows={2}
                  value={discountForm.description}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="discActive"
                  checked={discountForm.isActive}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[#0066cc] rounded accent-[#0066cc]"
                />
                <label htmlFor="discActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Enable this discount rule for bookings (બુકિંગમાં સક્રિય રાખો)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDiscount(null)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes (સાચવો)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE Discount Confirmation Dialog */}
      {deleteConfirmDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Discount Rule?
              </h3>
              <p className="text-xs text-slate-500">
                શું તમે આ ડિસ્કાઉન્ટ નીતિ ખરેખર કાઢી નાખવા માંગો છો?
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-900">
                {deleteConfirmDiscount.name}
              </p>
              <p className="text-sm font-extrabold text-red-800 mt-0.5">
                {deleteConfirmDiscount.percentage}% Off Facility Rent
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Code: {deleteConfirmDiscount.code}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Note: Existing booking slips will keep their applied discount amount for historical audit records.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDiscount(null)}
                disabled={deleting}
                className="w-full text-xs font-bold py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
              >
                Keep (રાખો)
              </button>
              <button
                type="button"
                onClick={handleDeleteDiscount}
                disabled={deleting}
                className="w-full text-xs font-bold py-2.5 px-3 bg-red-700 hover:bg-red-800 text-white rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete (કાઢી નાખો)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold">Configure Add-on Service</h3>
              <button
                onClick={() => setEditingService(null)}
                className="text-white/70 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, name: e.target.value })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fixed Service Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={serviceForm.price}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      price: Number(e.target.value),
                    })
                  }
                  placeholder="Enter 0 if rate not configured yet"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  If set to 0, it will display as &apos;Rate not configured / Contact Admin&apos;.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="servActive"
                  checked={serviceForm.isActive}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-red-800 rounded"
                />
                <label htmlFor="servActive" className="text-xs font-semibold text-slate-700">
                  Make this service selectable during bookings
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition"
                >
                  {saving ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
