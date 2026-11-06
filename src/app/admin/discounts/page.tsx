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
} from "lucide-react";

export default function DiscountsAndServicesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Discount Modal
  const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
  const [discountForm, setDiscountForm] = useState({
    name: "",
    percentage: 0,
    description: "",
    isActive: true,
  });

  // Edit Service Modal
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    price: 0,
    description: "",
    isActive: true,
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      percentage: d.percentage,
      description: d.description || "",
      isActive: d.isActive,
    });
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/discounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDiscount.id, ...discountForm }),
      });
      if (res.ok) {
        setEditingDiscount(null);
        setMsg("Discount policy updated successfully.");
        fetchData();
        setTimeout(() => setMsg(""), 3500);
      }
    } catch (err) {
      alert("Failed to update discount rule");
    } finally {
      setSaving(false);
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
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
            Tariff & Policy Configuration
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Discounts & Add-on Services
          </h1>
          <p className="text-xs text-slate-500">
            Manage official trustee and donor discount policies and optional cleaning and food disposal services.
          </p>
        </div>

        {msg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center">
            <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
            {msg}
          </div>
        )}
      </div>

      {/* 1. Discount Management Section */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Percent className="w-5 h-5 text-red-800" />
            <h2 className="text-lg font-bold text-slate-900">
              Samaj Discount Rules (Non-Stackable)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Applies to facility rent only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {discounts.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-200 uppercase tracking-wider">
                    {d.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      d.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {d.isActive ? "Active Policy" : "Disabled"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{d.name}</h3>
                  <div className="mt-1 flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-red-900">
                      {d.percentage}%
                    </span>
                    <span className="text-xs text-slate-500">Off Facility Rent</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
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

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                {currentUser?.role === "SUPER_ADMIN" ? (
                  <button
                    onClick={() => handleEditDiscountClick(d)}
                    className="text-xs font-bold text-red-800 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition flex items-center"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit Rate
                  </button>
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
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
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

      {/* Edit Discount Modal */}
      {editingDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Discount Policy</h3>
              <button
                onClick={() => setEditingDiscount(null)}
                className="text-white/70 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Policy Name *
                </label>
                <input
                  type="text"
                  required
                  value={discountForm.name}
                  onChange={(e) =>
                    setDiscountForm({ ...discountForm, name: e.target.value })
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Discount Percentage (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Eligibility Notes
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2">
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
                  className="w-4 h-4 text-red-800 rounded"
                />
                <label htmlFor="discActive" className="text-xs font-semibold text-slate-700">
                  Enable this discount rule for bookings
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDiscount(null)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition"
                >
                  {saving ? "Saving..." : "Save Discount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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

