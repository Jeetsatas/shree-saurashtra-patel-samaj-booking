"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, CheckCircle, Building, AlertCircle } from "lucide-react";

export default function AdminSettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    trustName: "",
    address: "",
    phone: "",
    email: "",
    officeHours: "",
    gstNumber: "",
    trustRegNo: "",
    rules: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [userRes, setRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/settings"),
      ]);
      if (userRes.ok) {
        const uData = await userRes.json();
        setCurrentUser(uData.user);
      }
      const data = await setRes.json();
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert("Only the Super Admin is authorized to change trust settings.");
      return;
    }
    setSaving(true);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSuccessMsg("Trust settings and contact details updated successfully!");
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
          Trust Profile & Configurations
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
          Trust Settings
        </h1>
        <p className="text-xs text-slate-500">
          Official trust title, office address, contact phone numbers, GST status, and rules.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl text-xs font-semibold text-emerald-800 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Trust Official Name *
          </label>
          <input
            type="text"
            required
            value={settings.trustName}
            onChange={(e) => setSettings({ ...settings, trustName: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Public Trust Reg. Number (Charity Commissioner)
            </label>
            <input
              type="text"
              value={settings.trustRegNo || ""}
              onChange={(e) => setSettings({ ...settings, trustRegNo: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              GST Number (Stage 1 Status)
            </label>
            <input
              type="text"
              placeholder="Pending Registration / Enter GSTIN when received"
              value={settings.gstNumber || ""}
              onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium"
            />
            <span className="text-[10px] text-amber-700 block mt-1">
              Currently pending; enter once received to automatically reflect on vouchers.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Nikol Office Address *
          </label>
          <textarea
            rows={2}
            required
            value={settings.address}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Numbers (Office / Helpline) *
            </label>
            <input
              type="text"
              required
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Office Timings *
            </label>
            <input
              type="text"
              required
              value={settings.officeHours}
              onChange={(e) => setSettings({ ...settings, officeHours: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Samaj Niyamavali & Hall Guidelines (Printed on Slips)
          </label>
          <textarea
            rows={4}
            value={settings.rules || ""}
            onChange={(e) => setSettings({ ...settings, rules: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
          ></textarea>
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          {isSuperAdmin ? (
            <button
              type="submit"
              disabled={saving}
              className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow transition flex items-center"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "Saving Changes..." : "Save Settings"}
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-semibold italic">
              Trust settings can only be altered by the Super Admin.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

