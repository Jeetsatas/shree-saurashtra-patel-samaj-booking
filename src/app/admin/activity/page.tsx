"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Shield,
  FileText,
  Key,
  CheckCircle,
  RefreshCw,
  Download,
  AlertCircle,
  Layers,
  Lock,
} from "lucide-react";

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionCategory, setActionCategory] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/activity");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const filteredLogs = logs.filter((log) => {
    if (actionCategory !== "ALL") {
      if (actionCategory === "BOOKINGS") {
        if (!["CREATE_BOOKING", "UPDATE_BOOKING", "CANCEL_BOOKING"].includes(log.action)) {
          return false;
        }
      } else if (actionCategory === "ADMINS") {
        if (!["CREATE_ADMIN_USER", "UPDATE_ADMIN_ACCESS", "RESET_ADMIN_PASSWORD"].includes(log.action)) {
          return false;
        }
      } else if (actionCategory === "FACILITIES") {
        if (!["UPDATE_FACILITY", "UPDATE_DISCOUNT", "UPDATE_SERVICE", "UPDATE_SETTING"].includes(log.action)) {
          return false;
        }
      } else if (actionCategory === "EXPORTS") {
        if (log.action !== "EXPORT_BOOKINGS") {
          return false;
        }
      } else if (actionCategory === "LOGIN") {
        if (log.action !== "LOGIN") {
          return false;
        }
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = log.userName?.toLowerCase().includes(q);
      const matchEmail = log.userEmail?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchRecord = log.recordId?.toLowerCase().includes(q);
      return matchName || matchEmail || matchAction || matchDetails || matchRecord;
    }

    return true;
  });

  const getActionBadge = (action: string) => {
    if (action === "CREATE_BOOKING") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          CREATE BOOKING
        </span>
      );
    }
    if (action === "UPDATE_BOOKING") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          UPDATE BOOKING
        </span>
      );
    }
    if (action === "CANCEL_BOOKING") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          CANCEL BOOKING
        </span>
      );
    }
    if (action === "RESET_ADMIN_PASSWORD" || action === "UPDATE_ADMIN_ACCESS") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          {action.replace(/_/g, " ")}
        </span>
      );
    }
    if (action === "UPDATE_FACILITY" || action === "UPDATE_DISCOUNT" || action === "UPDATE_SERVICE") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          {action.replace(/_/g, " ")}
        </span>
      );
    }
    if (action === "EXPORT_BOOKINGS") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
          CSV EXPORT
        </span>
      );
    }
    if (action === "LOGIN") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
          LOGIN
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
              Security & Compliance
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center">
              <Lock className="w-3 h-3 mr-1" />
              Immutable Audit Log
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            System Activity History
          </h1>
          <p className="text-xs text-slate-500">
            Chronological audit trail of all bookings, cancellations, pricing modifications, credential updates, and exports.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-lg border border-slate-300 transition flex items-center self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Logs"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by admin name, email, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 flex items-center mr-1">
              <Filter className="w-3.5 h-3.5 mr-1" />
              Action Type:
            </span>
            {[
              { id: "ALL", label: `All Events (${logs.length})` },
              { id: "BOOKINGS", label: "Bookings" },
              { id: "FACILITIES", label: "Facilities & Rates" },
              { id: "ADMINS", label: "Admin Credentials" },
              { id: "EXPORTS", label: "CSV Exports" },
              { id: "LOGIN", label: "Logins" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActionCategory(tab.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
                  actionCategory === tab.id
                    ? "bg-red-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Record / Module</th>
                <th className="py-3 px-4">Activity Details</th>
                <th className="py-3 px-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-red-800" />
                      <span>Loading immutable activity logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activity logs recorded matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                      <div>
                        {new Date(log.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.userName || "System"}</div>
                      <div className="text-[10px] text-slate-500">{log.userEmail}</div>
                      <span
                        className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          log.userRole === "SUPER_ADMIN"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.userRole === "SUPER_ADMIN" ? "Super Admin" : "View-Only Admin"}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                      <div>{log.recordType || "SYSTEM"}</div>
                      {log.recordId && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {log.recordId.substring(0, 14)}...
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md">
                      <div className="break-words font-medium">{log.details || "—"}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {log.ipAddress || "Internal"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

