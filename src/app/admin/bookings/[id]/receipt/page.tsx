"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Building2, Edit3, Users, FileText } from "lucide-react";
import Link from "next/link";
import {
  formatSlotLabel,
  isGroundFloorHall,
  getBookingGroundHallOption,
  groupBookingsByParty,
  PartyBookingGroup,
} from "@/lib/slotUtils";

export default function BookingReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [booking, setBooking] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slipMode, setSlipMode] = useState<"ALL" | "SINGLE">("ALL");

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (data.bookings && Array.isArray(data.bookings)) {
        setAllBookings(data.bookings);
        const found = data.bookings.find((b: any) => b.id === id);
        if (found) setBooking(found);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Find the party group for this booking
  const partyGroup = useMemo(() => {
    if (!allBookings.length || !booking) return null;
    const groups = groupBookingsByParty(allBookings);
    return groups.find((g) => g.bookingIds.includes(booking.id)) || null;
  }, [allBookings, booking]);

  const isMultiBooking = Boolean(partyGroup && partyGroup.bookings.length > 1);
  const effectiveMode = isMultiBooking ? slipMode : "SINGLE";
  const displayBookings = effectiveMode === "ALL" && partyGroup ? partyGroup.bookings : booking ? [booking] : [];

  const totalBaseRent = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.total;
    }
    return Number(booking?.facilityAmount || booking?.totalAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const effectiveDiscountAmount = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.discountAmount;
    }
    return Number(booking?.discountAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const allSelectedServices = useMemo(() => {
    if (!partyGroup) return [];
    const list: any[] = [];
    const targetBookings = effectiveMode === "ALL" ? partyGroup.bookings : booking ? [booking] : [];
    for (const b of targetBookings) {
      if (b.selectedServices) {
        try {
          const parsed = typeof b.selectedServices === "string" ? JSON.parse(b.selectedServices) : b.selectedServices;
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              if (!list.some((item) => item.code === s.code || item.name === s.name)) {
                list.push(s);
              }
            }
          }
        } catch {}
      }
    }
    return list;
  }, [partyGroup, effectiveMode, booking]);

  const effectiveServicesAmount = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.bookings.reduce((sum, b) => sum + (Number(b.servicesAmount) || 0), 0);
    }
    return Number(booking?.servicesAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const effectiveTotalRent = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.totalWithDiscount;
    }
    return Number(booking?.totalAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const effectiveDeposit = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.deposit;
    }
    return Number(booking?.depositAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const effectiveNetPayable = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.net;
    }
    return Number(booking?.totalAmount || 0) + Number(booking?.depositAmount || 0);
  }, [effectiveMode, partyGroup, booking]);

  const effectiveTotalJama = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.totalJama;
    }
    return 0;
  }, [effectiveMode, partyGroup]);

  const effectiveNetRemaining = useMemo(() => {
    if (effectiveMode === "ALL" && partyGroup) {
      return partyGroup.netRemaining;
    }
    return 0;
  }, [effectiveMode, partyGroup]);

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-booking Consolidated vs Single Slip Mode Switcher */}
          {isMultiBooking && (
            <div className="inline-flex items-center bg-slate-300/80 p-0.5 rounded-xl border border-slate-300 text-xs font-bold shadow-inner mr-1">
              <button
                type="button"
                onClick={() => setSlipMode("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  effectiveMode === "ALL"
                    ? "bg-white text-red-900 shadow-sm font-black border border-slate-300"
                    : "text-slate-700 hover:text-slate-950"
                }`}
                title="આ પાર્ટીના તમામ બુકિંગ્સ એક જ સંયુક્ત પહોંચમાં જુઓ"
              >
                <Users className="w-3.5 h-3.5 text-red-800" />
                <span>તમામ {partyGroup?.bookings.length} બુકિંગ્સ (સંયુક્ત પહોંચ)</span>
              </button>
              <button
                type="button"
                onClick={() => setSlipMode("SINGLE")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  effectiveMode === "SINGLE"
                    ? "bg-white text-slate-900 shadow-sm font-black border border-slate-300"
                    : "text-slate-700 hover:text-slate-950"
                }`}
                title="માત્ર આ એક સ્લોટની રસીદ જુઓ"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>માત્ર આ એક સ્લિપ</span>
              </button>
            </div>
          )}

          <Link
            href={`/admin/bookings?edit=${booking.id}`}
            className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center justify-center min-h-[38px]"
            title="આ બુકિંગની વિગતો સુધારો (Edit Booking)"
          >
            <Edit3 className="w-4 h-4 mr-1.5" />
            બુકિંગ સુધારો (Edit)
          </Link>

          <button
            onClick={() => window.print()}
            className="bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center justify-center min-h-[38px] cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print Official Booking Voucher (A4)
          </button>
        </div>
      </div>

      {/* A4 Sheet Card */}
      <div className="max-w-3xl mx-auto bg-white border border-slate-300 shadow-md p-4 sm:p-8 md:p-10 rounded-xl print:border-none print:shadow-none print:p-4 text-slate-900">
        
        {/* Trust Header */}
        <div className="border-b-2 border-red-900 pb-4 text-center space-y-1">
          <div className="flex justify-center mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Shree Saurashtra Patel Samaj Trust Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
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
            {isMultiBooking && effectiveMode === "ALL"
              ? "OFFICIAL HALL / DORMITORY BOOKING SLIP (પાર્ટી સંયુક્ત પહોંચ)"
              : "OFFICIAL HALL / DORMITORY BOOKING SLIP"}
          </span>
        </div>

        {/* Booking Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-500 block text-[11px]">Booking Number:</span>
            <span className="font-extrabold text-base text-red-900 font-mono">
              {booking.bookingNumber}
            </span>
            {isMultiBooking && effectiveMode === "ALL" && (
              <span className="text-[10px] text-slate-600 block mt-0.5 font-medium">
                સંલગ્ન તમામ સ્લિપ ({displayBookings.length}):{" "}
                <span className="font-mono font-bold text-red-950">
                  {displayBookings.map((b: any) => b.bookingNumber).join(", ")}
                </span>
              </span>
            )}
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
            <span className="font-bold text-sm text-slate-900">
              {partyGroup?.customerName || booking.customerName}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">Contact Number:</span>
            <span className="font-bold text-slate-900 font-mono">
              {partyGroup?.customerPhone || booking.customerPhone}
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-slate-500 block text-[11px]">Address & Native Village:</span>
            <span className="font-medium text-slate-800">
              {partyGroup?.customerAddress || booking.customerAddress || "Nikol, Ahmedabad"}
            </span>
          </div>
        </div>

        {/* Reservation Particulars Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              {isMultiBooking && effectiveMode === "ALL"
                ? `બુક કરેલ તમામ સુવિધાઓની વિગત (Booked Facilities & Slot Particulars - ${displayBookings.length} Bookings)`
                : "Reservation Particulars"}
            </h3>
            {isMultiBooking && effectiveMode === "ALL" && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-200">
                સંયુક્ત પાર્ટી પહોંચ (All Bookings)
              </span>
            )}
          </div>

          <table className="w-full text-xs text-left border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-700">
              <tr>
                <th className="p-2.5 border-r border-slate-300 w-8 text-center">#</th>
                <th className="p-2.5 border-r border-slate-300">Facility / Hall Name</th>
                <th className="p-2.5 border-r border-slate-300">Reserved Date</th>
                <th className="p-2.5 border-r border-slate-300">Time Slot</th>
                <th className="p-2.5 border-r border-slate-300">Occasion / Event</th>
                <th className="p-2.5 text-right">Base Rent</th>
              </tr>
            </thead>
            <tbody>
              {displayBookings.map((b: any, idx: number) => (
                <tr key={b.id || idx} className="border-b border-slate-300">
                  <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-300">
                    {idx + 1}
                  </td>
                  <td className="p-2.5 font-bold border-r border-slate-300">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{b.facility?.name}</span>
                      {isGroundFloorHall(b.facility) && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 print:border-black">
                          {getBookingGroundHallOption(b) === "AC" ? "❄️ AC" : "🍃 Non-AC"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-normal">
                        Code: {b.facility?.code}
                      </span>
                      {isMultiBooking && (
                        <span className="text-[10px] font-mono font-bold text-red-900 bg-red-50 px-1.5 py-0.2 rounded border border-red-200 print:border-black">
                          {b.bookingNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 font-semibold border-r border-slate-300 whitespace-nowrap">
                    {new Date(b.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 font-medium">
                    {formatSlotLabel(b.slot)}
                  </td>
                  <td className="p-2.5 font-semibold border-r border-slate-300">
                    {b.eventType}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-right text-slate-900 tabular-nums whitespace-nowrap">
                    ₹{(b.facilityAmount || b.totalAmount || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
            {isMultiBooking && effectiveMode === "ALL" && (
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="p-2.5 text-right text-slate-700 border-r border-slate-300">
                    કુલ મૂળ સુવિધા ભાડું (Total Base Rent - {displayBookings.length} Facilities):
                  </td>
                  <td className="p-2.5 font-mono font-black text-right text-slate-900 tabular-nums">
                    ₹{totalBaseRent.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Financial Breakdown Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide">
            Payment & Caution Deposit Summary
          </h3>
          <table className="w-full text-xs text-left border border-slate-300">
            <tbody>
              {/* 1. Base Rent */}
              <tr className="border-b border-slate-200">
                <td className="p-2 text-slate-600 border-r border-slate-300">
                  {effectiveMode === "ALL" && isMultiBooking
                    ? `કુલ મૂળ સુવિધા ભાડું (Total Base Rent - ${displayBookings.length} Bookings):`
                    : "Facility Base Rent:"}
                </td>
                <td className="p-2 font-bold text-right text-slate-900 tabular-nums font-mono">
                  ₹{totalBaseRent.toLocaleString("en-IN")}
                </td>
              </tr>

              {/* 2. Discount */}
              {effectiveDiscountAmount > 0 && (
                <tr className="border-b border-slate-200 bg-emerald-50/50 text-emerald-800">
                  <td className="p-2 border-r border-slate-300">
                    Samaj Discount Applied ({booking.discountPercent}% - {booking.discountCode || "Entitlement"}):
                    {booking.discountOverridden && (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Override note: {booking.discountOverrideReason}
                      </span>
                    )}
                  </td>
                  <td className="p-2 font-bold text-right text-emerald-800 tabular-nums font-mono">
                    - ₹{effectiveDiscountAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              )}

              {/* 3. Add-on Services */}
              {effectiveServicesAmount > 0 && (
                <tr className="border-b border-slate-200 bg-blue-50/40 text-blue-900">
                  <td className="p-2 border-r border-slate-300">
                    Optional Add-on Services:
                    {allSelectedServices.length > 0 && (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {allSelectedServices.map((s: any) => `${s.name} (₹${s.price})`).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="p-2 font-bold text-right text-blue-900 tabular-nums font-mono">
                    + ₹{effectiveServicesAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              )}

              {/* 4. Net Rent */}
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold">
                <td className="p-2 text-slate-700 border-r border-slate-300">
                  ચોખ્ખું સુવિધા ભાડું (Net Booking Rent Amount):
                </td>
                <td className="p-2 font-bold text-right text-slate-900 tabular-nums font-mono">
                  ₹{effectiveTotalRent.toLocaleString("en-IN")}
                </td>
              </tr>

              {/* 5. Caution Deposit (BEFORE NET!) */}
              <tr className="border-b border-slate-200 bg-amber-50/40">
                <td className="p-2 text-slate-700 font-semibold border-r border-slate-300">
                  🛡️ Refundable Caution Deposit (પરત મળવાપાત્ર અનામત ડિપોઝિટ):
                </td>
                <td className="p-2 font-bold text-right text-slate-900 tabular-nums font-mono">
                  ₹{effectiveDeposit.toLocaleString("en-IN")}
                </td>
              </tr>

              {/* 6. Total Amount Payable (Rent + Deposit) */}
              <tr className="border-b border-slate-300 bg-amber-100/70 font-bold">
                <td className="p-2 text-slate-900 border-r border-slate-300">
                  કુલ ચૂકવવાપાત્ર રકમ (Total Amount Payable - Rent + Deposit):
                </td>
                <td className="p-2 font-extrabold text-base text-right text-red-900 tabular-nums font-mono">
                  ₹{effectiveNetPayable.toLocaleString("en-IN")}
                </td>
              </tr>

              {/* 7. Total Jama / Paid (if any entries exist) */}
              {effectiveTotalJama > 0 && (
                <>
                  <tr className="border-b border-slate-200 bg-emerald-50/60 text-emerald-950 font-bold">
                    <td className="p-2 border-r border-slate-300">
                      અત્યાર સુધી જમા રકમ (Total Amount Received / Jama):
                    </td>
                    <td className="p-2 text-right text-emerald-800 tabular-nums font-mono">
                      ₹{effectiveTotalJama.toLocaleString("en-IN")}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 font-bold">
                    <td className="p-2 text-slate-700 border-r border-slate-300">
                      બાકી રહેતી રકમ (Net Remaining Balance):
                    </td>
                    <td className={`p-2 text-right tabular-nums font-mono ${effectiveNetRemaining === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      ₹{effectiveNetRemaining.toLocaleString("en-IN")} {effectiveNetRemaining === 0 ? "(ચુકતે)" : ""}
                    </td>
                  </tr>
                </>
              )}

              {/* 8. Payment Mode & Reference */}
              <tr className="text-[11px] text-slate-600">
                <td className="p-2 border-r border-slate-300">
                  Payment Mode & Reference:
                </td>
                <td className="p-2 text-right font-medium">
                  {booking.paymentMethod} {booking.paymentRefNo ? `(${booking.paymentRefNo})` : ""}
                  {booking.paymentStatus ? ` • ${booking.paymentStatus}` : ""}
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
