"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminCachedData, fetchAdminJson } from "@/lib/admin-client-cache";
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
  ShieldAlert,
  UserCheck,
  Edit2,
  Save,
  Plus,
  Trash2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    return getAdminCachedData<any>("/api/auth/me")?.user || null;
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "VIEW_ONLY_ADMIN",
    canExport: false,
  });
  const [addingUser, setAddingUser] = useState(false);

  // Edit User Modal (Name, Username/Email, Phone, Role, and optional Password)
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "VIEW_ONLY_ADMIN",
    password: "",
    canExport: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick Change Password Modal
  const [passwordModalUser, setPasswordModalUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete User Confirmation Modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [meData, usersData] = await Promise.all([
        fetchAdminJson<any>("/api/auth/me"),
        fetchAdminJson<any>("/api/users", { forceRefresh: true }),
      ]);

      if (meData?.user) {
        setCurrentUser(meData.user);
      }

      if (usersData?.users) {
        setUsers(usersData.users);
      }
    } catch (err) {
      console.error("Failed to load user management data:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // 1. Create New User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) return;

    if (newUserForm.password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setAddingUser(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create administrator account");
      }

      setShowAddModal(false);
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "VIEW_ONLY_ADMIN",
        canExport: false,
      });
      fetchInitialData();
      setSuccessMsg(`Administrator account for ${data.user.name} (${data.user.email}) created successfully.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create user");
      alert(err.message || "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  // 2. Open Edit User Modal
  const handleOpenEdit = (user: any) => {
    setEditUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      password: "",
      canExport: Boolean(user.canExport),
    });
  };

  // 3. Save Edit User (Updates Name, Username/Email, Phone, Role, and optional Password)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingEdit(true);
    setErrorMsg("");

    try {
      const payload: any = {
        id: editUser.id,
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        role: editFormData.role,
        canExport: editFormData.canExport,
      };

      if (editFormData.password && editFormData.password.trim().length > 0) {
        if (editFormData.password.trim().length < 6) {
          throw new Error("New password must be at least 6 characters long.");
        }
        payload.password = editFormData.password.trim();
      }

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update administrator details");
      }

      setEditUser(null);
      fetchInitialData();
      setSuccessMsg(`Administrator credentials & details for ${data.user.name} updated successfully.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update user");
      alert(err.message || "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  // 4. Quick Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPassword) return;

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
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
      setSuccessMsg(`Password successfully updated for ${passwordModalUser.name} (${passwordModalUser.email}).`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  // 5. Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeletingUser(true);
    try {
      const res = await fetch(`/api/users?id=${deleteConfirmUser.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user account");
      }

      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirmUser.id));
      setDeleteConfirmUser(null);
      setSuccessMsg("Administrator account removed successfully.");
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  };

  // 6. Toggle Export Permission Directly
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  // Strict Super Admin Access Guard
  if (!loading && currentUser && !isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Access Restricted to Super Admin
            </h2>
            <p className="text-xs text-red-700 font-bold">
              માત્ર સુપર એડમિન (J N Patel) માટે અધિકૃત
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">
              You do not have permission to view or manage administrator accounts and credentials. Only the primary Super Administrator can access this section.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/calendar"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0066cc] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#0055b3] transition"
            >
              Return to Live Calendar (કેલેન્ડર પર જાઓ)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">
              Administrator Governance
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {users.length} Registered Accounts
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tracking-tight">
            Administrator Accounts & Credentials
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage trustee usernames, encrypted passwords, roles, and CSV export permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 text-amber-950 px-3 py-2 rounded-xl text-xs font-medium flex items-center">
            <Lock className="w-4 h-4 mr-2 text-amber-700 flex-shrink-0" />
            <span>Closed Trust Architecture: Super Admin Access Only</span>
          </div>

          <button
            onClick={() => {
              setNewUserForm({
                name: "",
                email: "",
                password: "",
                phone: "",
                role: "VIEW_ONLY_ADMIN",
                canExport: false,
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0066cc] hover:bg-[#0055b3] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add User (નવો એડમિન)</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl text-xs font-semibold text-emerald-800 flex items-center shadow-sm">
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-300 p-3.5 rounded-xl text-xs font-semibold text-red-800 flex items-center shadow-sm">
          <AlertCircle className="w-4 h-4 mr-2 text-red-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* User Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {users.map((u, idx) => {
          const isSuper = u.role === "SUPER_ADMIN";
          const isCurrentUser = currentUser?.id === u.id;
          const isPrimaryAdmin =
            u.email === "jnpatel@patelsamaj.com" ||
            u.email === "superadmin@patelsamaj.com";

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
                  <div className="text-xs text-slate-700 flex items-center mt-1 font-semibold">
                    <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-800">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="text-xs text-slate-600 flex items-center mt-0.5">
                      <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                      <span>{u.phone}</span>
                    </div>
                  )}
                </div>

                {/* Permissions Box */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Authorized Capabilities:</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Encrypted Password
                    </span>
                  </div>

                  {isSuper ? (
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                      <li>Full creation, editing, and cancellation of bookings.</li>
                      <li>Facility inventory, pricing & slot control.</li>
                      <li>Trustee & donor discount configuration.</li>
                      <li>Edit usernames and passwords for all administrators.</li>
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
                        <button
                          type="button"
                          onClick={() => handleToggleExport(u)}
                          className="text-[10px] text-[#0066cc] hover:underline font-bold"
                        >
                          Toggle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1">
                  {!isPrimaryAdmin && !isCurrentUser && (
                    <button
                      onClick={() => setDeleteConfirmUser(u)}
                      title="Delete administrator account"
                      className="text-xs font-semibold text-slate-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 ml-auto">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 transition flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit User / Info</span>
                  </button>
                  <button
                    onClick={() => {
                      setPasswordModalUser(u);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                    }}
                    className="text-xs font-bold text-red-800 hover:text-white hover:bg-red-800 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition flex items-center gap-1"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Change Password</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD ADMINISTRATOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#0066cc] flex items-center justify-center text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Add New Administrator</h3>
                  <p className="text-[11px] text-slate-300">નવો ટ્રસ્ટી / એડમિન એકાઉન્ટ ઉમેરો</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name (પૂરું નામ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rameshbhai Patel"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username / Login Email (યુઝરનેમ / લોગિન ઇમેઇલ) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rameshbhai@patelsamaj.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono font-semibold focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password (પાસવર્ડ) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter strong login password (min 6 characters)"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98250 00000"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Role (હોદ્દો) *
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        role: e.target.value,
                        canExport: e.target.value === "SUPER_ADMIN" ? true : newUserForm.canExport,
                      })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold focus:bg-white focus:border-[#0066cc] outline-none"
                  >
                    <option value="VIEW_ONLY_ADMIN">View-Only Admin (માત્ર જોવા માટે)</option>
                    <option value="SUPER_ADMIN">Super Admin (સંપૂર્ણ અધિકાર)</option>
                  </select>
                </div>
              </div>

              {newUserForm.role !== "SUPER_ADMIN" && (
                <div className="pt-1">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserForm.canExport}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, canExport: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#0066cc] accent-[#0066cc]"
                    />
                    <span>Grant CSV Booking Export Permission</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 ml-6">
                    Allow this administrator to download full booking spreadsheets.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {addingUser ? "Creating Account..." : "+ Add User (એકાઉન્ટ ઉમેરો)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ADMINISTRATOR MODAL (Edit Name, Username/Email, Phone, Role, and Password) */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Edit Administrator Details</h3>
                <p className="text-xs text-slate-300 font-mono">{editUser.email}</p>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Administrator Name (નામ) *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username / Login Email (યુઝરનેમ / ઇમેઇલ) *
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono font-bold focus:bg-white focus:border-[#0066cc] outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This is the username used to sign in to the portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Update Password (નવો પાસવર્ડ - વૈકલ્પિક)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Only enter a value if you wish to reset this user&apos;s password right now.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role (હોદ્દો)
                  </label>
                  <select
                    disabled={
                      editUser.email === "jnpatel@patelsamaj.com" ||
                      editUser.email === "superadmin@patelsamaj.com"
                    }
                    value={editFormData.role}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        role: e.target.value,
                        canExport: e.target.value === "SUPER_ADMIN" ? true : editFormData.canExport,
                      })
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-bold focus:bg-white focus:border-[#0066cc] outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="VIEW_ONLY_ADMIN">View-Only Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>

              {editFormData.role !== "SUPER_ADMIN" && (
                <div className="pt-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.canExport}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, canExport: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-[#0066cc] accent-[#0066cc]"
                    />
                    <span>Grant CSV Booking Export Permission</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 ml-6">
                    When enabled, this view-only admin can download booking export spreadsheets.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes (સાચવો)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CHANGE PASSWORD MODAL */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Reset Administrator Password</h3>
                <p className="text-xs text-amber-200 font-mono">{passwordModalUser.email}</p>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="p-5 sm:p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                <span className="font-bold block mb-0.5">Administrator:</span>
                <span className="font-semibold text-slate-900">{passwordModalUser.name}</span>
                <span className="text-slate-500 font-mono block text-[11px]">{passwordModalUser.email}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password * (Min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-[#0066cc] outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="text-xs font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel (રદ કરો)
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {changingPassword ? "Updating Password..." : "Update Password (સાચવો)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Administrator Account?
              </h3>
              <p className="text-xs text-slate-500">
                શું તમે આ એડમિન એકાઉન્ટ ખરેખર કાઢી નાખવા માંગો છો?
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-900">
                {deleteConfirmUser.name}
              </p>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                {deleteConfirmUser.email}
              </p>
              <p className="text-[10px] text-red-800 font-semibold uppercase tracking-wider mt-1">
                {deleteConfirmUser.role}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              This will revoke login access immediately for this administrator.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deletingUser}
                className="w-full text-xs font-bold py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
              >
                Keep (રાખો)
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="w-full text-xs font-bold py-2.5 px-3 bg-red-700 hover:bg-red-800 text-white rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {deletingUser ? "Deleting..." : "Delete (કાઢી નાખો)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
