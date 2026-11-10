"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

export default function BookingReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (data.bookings) {
        const found = data.bookings.find((b: any) => b.id === id);
        if (found) setBooking(found);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <p className="text-slate-600 font-bold mb-4">Booking receipt not found.</p>
        <Link href="/admin/bookings" className="text-xs text-red-800 underline font-semibold">
          ← Back to Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 py-3 sm:py-6 px-2 sm:px-4 print:bg-white print:p-0">
      {/* Top Action Bar (hidden on print) */}
      <div className="max-w-3xl mx-auto mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
        <Link
          href="/admin/bookings"
          className="text-xs font-semibold text-slate-700 hover:text-slate-950 flex items-center self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Bookings
        </Link>

        <button
          onClick={() => window.print()}
          className="bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center min-h-[40px]"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Print Official Booking Voucher (A4)
        </button>
      </div>

      {/* A4 Sheet Card */}
      <div className="max-w-3xl mx-auto bg-white border border-slate-300 shadow-md p-4 sm:p-8 md:p-10 rounded-xl print:border-none print:shadow-none print:p-4 text-slate-900">
        
        {/* Trust Header */}
        <div className="border-b-2 border-red-900 pb-4 text-center space-y-1">
          <p className="text-[12px] font-bold text-red-900 tracking-wider">
            ॥ શ્રી ગણેશાય નમઃ ॥ ॥ શ્રી ખોડિયાર કૃપા ॥
          </p>
          <h1 className="text-2xl font-black text-red-900 tracking-tight">
            શ્રી સૌરાષ્ટ્ર પટેલ સમાજ
          </h1>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Shree Saurashtra Patel Samaj, Nikol - Naroda
          </h2>
          <p className="text-[11px] text-slate-600">
            Near Nikol Lake & Ring Road, Nikol - Naroda, Ahmedabad - 382350 | Phone: +91 98250 12345 / 079-22985600
          </p>
          <p className="text-[10px] text-slate-500 font-semibold">
            Registration No: E/15894/Ahmedabad (Public Charitable Trust) • GST Registration: Pending
          </p>
        </div>

        {/* Voucher Title */}
        <div className="my-5 text-center">
          <span className="inline-block bg-red-100 text-red-900 font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider border border-red-200">
            OFFICIAL HALL / DORMITORY BOOKING SLIP
          </span>
        </div>

        {/* Booking Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-500 block text-[11px]">Booking Number:</span>
            <span className="font-extrabold text-base text-red-900">{booking.bookingNumber}</span>
          </div>

          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">Issue Date:</span>
            <span className="font-bold text-slate-800">
              {new Date(booking.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Applicant Full Name:</span>
            <span className="font-bold text-sm text-slate-900">{booking.customerName}</span>
          </div>

          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">Contact Number:</span>
            <span className="font-bold text-slate-900">{booking.customerPhone}</span>
          </div>

          <div className="col-span-2">
            <span className="text-slate-500 block text-[11px]">Address & Native Village:</span>
            <span className="font-medium text-slate-800">
              {booking.customerAddress || "Nikol, Ahmedabad"}
            </span>
          </div>
        </div>

        {/* Reservation Particulars Table */}
        <div className="mb-6">
          <table className="w-full text-xs text-left border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-700">
              <tr>
                <th className="p-2.5 border-r border-slate-300">Facility / Hall Name</th>
                <th className="p-2.5 border-r border-slate-300">Reserved Date</th>
                <th className="p-2.5 border-r border-slate-300">Time Slot</th>
                <th className="p-2.5">Occasion / Event</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-2.5 font-bold border-r border-slate-300">
                  {booking.facility?.name}
                  <span className="block text-[10px] text-slate-500 font-normal">
                    Code: {booking.facility?.code}
                  </span>
                </td>
                <td className="p-2.5 font-semibold border-r border-slate-300">
                  {new Date(booking.startDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </td>
                <td className="p-2.5 border-r border-slate-300">{booking.slot}</td>
                <td className="p-2.5 font-semibold">{booking.eventType}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide">
            Payment & Caution Deposit Summary
          </h3>
          <table className="w-full text-xs text-left border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 text-slate-600 border-r border-slate-300">
                  Facility Base Rent:
                </td>
                <td className="p-2 font-bold text-right text-slate-900">
                  ₹{(booking.facilityAmount || booking.totalAmount).toLocaleString("en-IN")}
                </td>
              </tr>

              {booking.discountAmount > 0 && (
                <tr className="border-b border-slate-200 bg-emerald-50/50 text-emerald-800">
                  <td className="p-2 border-r border-slate-300">
                    Samaj Discount Applied ({booking.discountPercent}% - {booking.discountCode || "Entitlement"}):
                    {booking.discountOverridden && (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Override note: {booking.discountOverrideReason}
                      </span>
                    )}
                  </td>
                  <td className="p-2 font-bold text-right text-emerald-800">
                    - ₹{booking.discountAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              )}

              {booking.servicesAmount > 0 && (
                <tr className="border-b border-slate-200 bg-blue-50/40 text-blue-900">
                  <td className="p-2 border-r border-slate-300">
                    Optional Add-on Services:
                    {booking.selectedServices && (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {(() => {
                          try {
                            const parsed = JSON.parse(booking.selectedServices);
                            return parsed.map((s: any) => `${s.name} (₹${s.price})`).join(", ");
                          } catch {
                            return "";
                          }
                        })()}
                      </span>
                    )}
                  </td>
                  <td className="p-2 font-bold text-right text-blue-900">
                    + ₹{booking.servicesAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              )}

              <tr className="border-b border-slate-200 bg-slate-50 font-semibold">
                <td className="p-2 text-slate-700 border-r border-slate-300">
                  Net Booking Amount:
                </td>
                <td className="p-2 font-bold text-right text-slate-900">
                  ₹{booking.totalAmount.toLocaleString("en-IN")}
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-slate-50/50">
                <td className="p-2 text-slate-600 border-r border-slate-300">
                  Refundable Caution Deposit (અનામત):
                </td>
                <td className="p-2 font-bold text-right text-slate-900">
                  ₹{booking.depositAmount.toLocaleString("en-IN")}
                </td>
              </tr>

              <tr className="border-b border-slate-300 bg-amber-50/60 font-bold">
                <td className="p-2 text-slate-900 border-r border-slate-300">
                  Total Amount Received (Rent + Deposit):
                </td>
                <td className="p-2 font-extrabold text-base text-right text-red-900">
                  ₹{(booking.totalAmount + booking.depositAmount).toLocaleString("en-IN")}
                </td>
              </tr>

              <tr className="text-[11px] text-slate-600">
                <td className="p-2 border-r border-slate-300">
                  Payment Mode & Reference:
                </td>
                <td className="p-2 text-right font-medium">
                  {booking.paymentMethod} {booking.paymentRefNo ? `(${booking.paymentRefNo})` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rules for Receipt */}
        <div className="text-[10px] text-slate-600 space-y-1 mb-10 border-t border-slate-200 pt-3">
          <p className="font-bold text-slate-800">મહત્વની શરતો (Trust Guidelines):</p>
          <p>1. સમગ્ર સંકુલમાં શુદ્ધ શાકાહારી ભોજન જ માન્ય છે. વ્યસન કે દારૂબંધીનું ચુસ્ત પાલન કરવું.</p>
          <p>2. રાત્રે ૧૦:૦૦ વાગ્યા પછી લાઉડસ્પીકર કે ડીજે સંપૂર્ણ બંધ રાખવું.</p>
          <p>3. હોલ/ડોમેટ્રી જમા કરાવતી વખતે સફાઈ ચકાસીને અનામત ડિપોઝિટ ૩ દિવસમાં પરત મળશે.</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 text-xs pt-8 border-t border-dashed border-slate-300">
          <div className="text-center">
            <div className="h-12"></div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              અરજદારની સહી (Applicant Signature)
            </div>
          </div>

          <div className="text-center">
            <div className="h-12"></div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
              ટ્રસ્ટી / મેનેજર શ્રી (Authorized Trustee / Manager)
            </div>
            <span className="text-[10px] text-slate-500">
              શ્રી સૌરાષ્ટ્ર પટેલ સમાજ, નિકોલ - નરોડા
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

