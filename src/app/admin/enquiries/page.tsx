"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Phone,
  Calendar,
  Building,
  CheckCircle,
  Clock,
  User,
  Check,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export default function EnquiriesManagementPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/enquiries");
      const data = await res.json();
      if (data.enquiries) setEnquiries(data.enquiries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/enquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchEnquiries();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
            Public Website Inquiries
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Booking & Date Inquiries
          </h1>
          <p className="text-xs text-slate-500">
            Requests submitted by visitors from the public website for weddings, stays, and ceremonies.
          </p>
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          Total {enquiries.length} Inquiries
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Phone / WhatsApp</th>
                <th className="py-3 px-4">Facility Requested</th>
                <th className="py-3 px-4">Preferred Date</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Message / Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {enquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No inquiries received yet.
                  </td>
                </tr>
              ) : (
                enquiries.map((enq) => (
                  <tr key={enq.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {enq.name}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {new Date(enq.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      <a
                        href={`tel:${enq.phone}`}
                        className="flex items-center text-red-800 hover:underline"
                      >
                        <Phone className="w-3 h-3 mr-1 text-slate-400" />
                        {enq.phone}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {enq.facility ? enq.facility.name : "Any Hall"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {new Date(enq.preferredDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <span className="text-[10px] text-slate-400">{enq.slot}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {enq.eventType}
                      {enq.guestCount && (
                        <span className="block text-[10px] text-slate-500">
                          {enq.guestCount} Guests
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {enq.message || "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          enq.status === "NEW"
                            ? "bg-amber-100 text-amber-800"
                            : enq.status === "CONTACTED"
                            ? "bg-blue-100 text-blue-800"
                            : enq.status === "CONVERTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {enq.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      {enq.status === "NEW" && (
                        <button
                          onClick={() => updateStatus(enq.id, "CONTACTED")}
                          className="text-[11px] font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {enq.status !== "CONVERTED" && (
                        <button
                          onClick={() => updateStatus(enq.id, "CONVERTED")}
                          className="text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition"
                        >
                          Converted
                        </button>
                      )}
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

