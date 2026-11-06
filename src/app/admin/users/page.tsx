"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Key,
  Mail,
  Phone,
  CheckCircle,
  Lock,
  AlertCircle,
  FileSpreadsheet,
  Shield,
  UserCheck,
  Edit2,
  Save,
} from "lucide-react";

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Change Password Modal
  const [passwordModalUser, setPasswordModalUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Edit User Modal (Super Admin only)
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    canExport: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [meRes, usersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/users"),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }

      const usersData = await usersRes.json();
      if (usersData.users) setUsers(usersData.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPassword) return;

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    setPasswordError("");

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: passwordModalUser.id,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordModalUser(null);
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMsg(`Password successfully updated for ${passwordModalUser.name} using Argon2id.`);
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenEdit = (user: any) => {
    setEditUser(user);
    setEditFormData({
      name: user.name,
      phone: user.phone || "",
      canExport: Boolean(user.canExport),
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingEdit(true);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUser.id,
          name: editFormData.name,
          phone: editFormData.phone,
          canExport: editFormData.canExport,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update administrator details");
      }

      setEditUser(null);
      fetchInitialData();
      setSuccessMsg("Administrator permissions updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleExport = async (targetUser: any) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetUser.id,
          canExport: !targetUser.canExport,
        }),
      });

      if (res.ok) {
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
              Administrator Governance
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              3 Designated Accounts
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Administrator Accounts & Permissions
          </h1>
          <p className="text-xs text-slate-500">
            Internal trust booking system operated strictly by 1 Super Admin and 2 View-Only Administrators.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3 py-2 rounded-xl text-xs font-medium flex items-center">
          <Lock className="w-4 h-4 mr-2 text-amber-700 flex-shrink-0" />
          <span>Closed Architecture: Self-registration & public sign-up disabled.</span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl text-xs font-semibold text-emerald-800 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* User Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {users.map((u, idx) => {
          const isSuper = u.role === "SUPER_ADMIN";
          const isCurrentUser = currentUser?.id === u.id;

          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between space-y-4 transition ${
                isSuper ? "border-red-200 bg-gradient-to-b from-white to-red-50/20" : "border-slate-200"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      isSuper
                        ? "bg-red-800 text-white shadow-xs"
                        : "bg-slate-800 text-white"
                    }`}
                  >
                    Account #{idx + 1}: {isSuper ? "Super Admin" : "View-Only Admin"}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      You (Active Session)
                    </span>
                  )}
                </div>

                <div className="pt-1">
                  <h3 className="text-base font-bold text-slate-900">{u.name}</h3>
                  <div className="text-xs text-slate-600 flex items-center mt-1">
                    <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    <span>{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="text-xs text-slate-600 flex items-center mt-0.5">
                      <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      <span>{u.phone}</span>
                    </div>
                  )}
                </div>

                {/* Permissions Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Authorized Capabilities:</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Argon2id Secured
                    </span>
                  </div>

                  {isSuper ? (
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                      <li>Full creation, editing, and cancellation of bookings.</li>
                      <li>Facility inventory, pricing & slot control.</li>
                      <li>Trustee & donor discount configuration.</li>
                      <li>Reset passwords for all 3 administrators.</li>
                      <li>Export booking CSV records at any time.</li>
                    </ul>
                  ) : (
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                      <li>Read-only access to dashboard and live calendar.</li>
                      <li>Search, filter, and inspect booking details.</li>
                      <li>Print official receipts and slips for applicants.</li>
                      <li>Cannot alter prices, bookings, or administrator settings.</li>
                    </ul>
                  )}

                  {/* Export Permission Status */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">CSV Export:</span>
                    {isSuper ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Always Enabled
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            u.canExport
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-slate-500 bg-slate-100 border-slate-200"
                          }`}
                        >
                          {u.canExport ? "Enabled by Super Admin" : "Disabled"}
                        </span>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleExport(u)}
                            className="text-[10px] text-blue-700 hover:underline font-semibold"
                          >
                            Toggle
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  ID: {u.id.substring(0, 8)}...
                </span>

                {isSuperAdmin ? (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 transition flex items-center"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setPasswordModalUser(u);
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordError("");
                      }}
                      className="text-xs font-bold text-red-800 hover:text-white hover:bg-red-800 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition flex items-center"
                    >
                      <Key className="w-3 h-3 mr-1" />
                      Reset Pass
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">View-Only</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset Password Modal (Super Admin Only) */}
      {passwordModalUser && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Reset Administrator Password</h3>
                <p className="text-xs text-amber-200">{passwordModalUser.email}</p>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-white/70 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="p-3 mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="p-5 sm:p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block mb-1">Argon2id Security:</span>
                Password will be hashed using memory-hard Argon2id with 64MB memory cost before writing to the database.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password * (Min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition"
                >
                  {changingPassword ? "Updating Hash..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Administrator Modal */}
      {editUser && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Edit Administrator Details</h3>
                <p className="text-xs text-slate-400">{editUser.email}</p>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="text-white/70 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Administrator Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800"
                />
              </div>

              {editUser.role !== "SUPER_ADMIN" && (
                <div className="pt-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.canExport}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, canExport: e.target.checked })
                      }
                      className="rounded text-red-800 focus:ring-red-700"
                    />
                    <span>Grant CSV Booking Export Permission</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 ml-5">
                    When enabled, this view-only admin can download booking export spreadsheets.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
