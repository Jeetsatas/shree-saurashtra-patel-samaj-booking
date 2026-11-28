"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building2,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Flame,
  Wallet,
  Clock,
  ArrowRight,
  Receipt,
  Users,
  Building,
} from "lucide-react";

function AuditReportsContent() {
  const searchParams = useSearchParams();
  const partyParam = searchParams.get("party") || "";

  const [selectedYear, setSelectedYear] = useState<string>("ALL"); // Default ALL to sync with Payment Stithi
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState(partyParam);
  const [activeLedgerTab, setActiveLedgerTab] = useState<"PARTY_WISE" | "SINGLE_SLOTS">("PARTY_WISE");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        year: selectedYear,
        month: selectedMonth,
        status: selectedStatus,
        format: "json",
      });
      const res = await fetch(`/api/reports/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load audit data");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [selectedYear, selectedMonth, selectedStatus]);

  useEffect(() => {
    if (partyParam) {
      setSearchQuery(partyParam);
    }
  }, [partyParam]);

  // Download CA or Tally CSV
  const handleDownloadCsv = (type: "ca" | "tally") => {
    const params = new URLSearchParams({
      year: selectedYear,
      month: selectedMonth,
      status: selectedStatus,
      format: type === "ca" ? "csv_ca" : "csv_tally",
    });
    window.open(`/api/reports/audit?${params.toString()}`, "_blank");
  };

  // Filtered party groups (matching Payment Stithi)
  const filteredParties = useMemo(() => {
    if (!data?.partyGroups) return [];
    if (!searchQuery.trim()) return data.partyGroups;
    const q = searchQuery.toLowerCase().trim();
    return data.partyGroups.filter((g: any) => {
      const name = (g.customerName || "").toLowerCase();
      const phone = (g.customerPhone || "").toLowerCase();
      const num = (g.primaryBookingNumber || "").toLowerCase();
      const bNums = (g.bookingNumbers || "").toLowerCase();
      const fac = (g.facilityNames || "").toLowerCase();
      const ev = (g.eventType || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        num.includes(q) ||
        bNums.includes(q) ||
        fac.includes(q) ||
        ev.includes(q)
      );
    });
  }, [data, searchQuery]);

  // Filtered single bookings
  const filteredBookings = useMemo(() => {
    if (!data?.bookings) return [];
    if (!searchQuery.trim()) return data.bookings;
    const q = searchQuery.toLowerCase().trim();
    return data.bookings.filter((b: any) => {
      const name = (b.customerName || "").toLowerCase();
      const phone = (b.customerPhone || "").toLowerCase();
      const num = (b.bookingNumber || "").toLowerCase();
      const fac = (b.facility?.name || "").toLowerCase();
      const ev = (b.eventType || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        num.includes(q) ||
        fac.includes(q) ||
        ev.includes(q)
      );
    });
  }, [data, searchQuery]);

  const maxMonthlyRevenue = useMemo(() => {
    if (!data?.monthlyTrends) return 10000;
    return Math.max(...data.monthlyTrends.map((m: any) => m.revenue || 0), 10000);
  }, [data]);

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Top Breadcrumb & Controls (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-1">
            <Link href="/admin" className="hover:text-blue-600 transition flex items-center">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              ડેશબોર્ડ (Dashboard)
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <Link href="/admin/payments" className="hover:text-blue-600 transition">
              પેમેન્ટ સ્થિતિ (Payment Stithi)
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-700 font-bold">ઓડિટ અને એનાલિટિક્સ</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-800" />
            વાર્ષિક ઓડિટ અને એનાલિટિક્સ રિપોર્ટ
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ - નરોડા) • પેમેન્ટ સ્થિતિ સાથે સંપૂર્ણ સિંક થયેલ ઓડિટ રજિસ્ટર
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/payments"
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="પેમેન્ટ સ્થિતિ અને ખાતાવહી પેજ પર જાઓ"
          >
            <Wallet className="w-3.5 h-3.5 text-blue-600" />
            <span>પેમેન્ટ સ્થિતિ</span>
          </Link>

          <button
            type="button"
            onClick={fetchAuditData}
            disabled={loading}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="રિપોર્ટ તાજો કરો"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-red-800" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => handleDownloadCsv("ca")}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="CA / Auditor માટે પેમેન્ટ સ્થિતિ મુજબનું પાર્ટી-વાઇઝ CSV એક્સપોર્ટ"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CA ઓડિટ CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadCsv("tally")}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="Tally Prime સુસંગત સેલ્સ રજિસ્ટર ડાઉનલોડ"
          >
            <Download className="w-4 h-4" />
            <span>Tally CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="ટ્રસ્ટી મંડળ માટે પ્રિન્ટેબલ ઓડિટ શીટ"
          >
            <Printer className="w-4 h-4" />
            <span>પ્રિન્ટ શીટ</span>
          </button>
        </div>
      </div>

      {/* Trust Print Header (Only visible when printing) */}
      <div className="hidden print:block text-center border-b-2 border-red-900 pb-3 mb-4 space-y-1">
        <p className="text-[11px] font-bold text-red-900 tracking-wider">
          ॥ શ્રી ગણેશાય નમઃ ॥ ॥ શ્રી ખોડિયાર કૃપા ॥
        </p>
        <h1 className="text-xl font-black text-red-900">શ્રી સૌરાષ્ટ્ર પટેલ સમાજ</h1>
        <h2 className="text-xs font-bold text-slate-800 uppercase">
          Shree Saurashtra Patel Samaj, Nikol - Naroda, Ahmedabad
        </h2>
        <p className="text-[10px] text-slate-600">
          સત્તાવાર વાર્ષિક ઓડિટ, નાણાકીય હિસાબ અને ઓક્યુપન્સી રજિસ્ટર • નાણાકીય વર્ષ: {selectedYear === "ALL" ? "સમગ્ર રજિસ્ટર" : selectedYear}
        </p>
        <p className="text-[9px] text-slate-500 font-semibold">
          Registration No: E/15894/Ahmedabad (Public Charitable Trust) • GST Registration: Pending
        </p>
      </div>

      {/* LIVE SYNC STATUS WITH PAYMENT STITHI BANNER */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950 no-print">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>પેમેન્ટ સ્થિતિ (Payment Stithi) સાથે ૧૦૦% રિયલ-ટાઇમ સિંક</span>
              <span className="bg-emerald-200/80 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                લાઈવ હિસાબ સિંક
              </span>
            </div>
            <p className="text-[11px] text-emerald-900/90 mt-0.5 font-medium leading-relaxed">
              ઓડિટ પેજ અને પેમેન્ટ સ્થિતિ બંને એક જ સત્તાવાર ખાતાવહીનો ઉપયોગ કરે છે. તમામ <strong>{data?.summary?.totalParties || 0} પાર્ટીઓ</strong>, કુલ બિલિંગ, જમા અને બાકી રકમના આંકડા એકસમાન છે.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <div className="bg-white/90 border border-emerald-200 rounded-xl px-3 py-1.5 text-right font-mono text-[11px]">
            <span className="text-slate-500 block text-[9px] font-sans">કુલ ચોખ્ખી બિલિંગ</span>
            <span className="font-extrabold text-slate-900">₹{(data?.summary?.totalBilled || 0).toLocaleString("en-IN")}</span>
          </div>
          <Link
            href="/admin/payments"
            className="px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs"
          >
            <span>ખાતાવહી જુઓ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Year & Period Filters (No Print) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs no-print flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            વર્ષ પસંદ કરો:
          </span>
          {["ALL", "2026", "2027", "2025"].map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedYear === yr
                  ? "bg-red-800 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {yr === "ALL" ? "બધા વર્ષો (All Years)" : yr}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600">મહિનો:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 font-bold focus:ring-2 focus:ring-red-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">આખું વર્ષ (12 Months)</option>
            <option value="1">1 - જાન્યુઆરી (Jan)</option>
            <option value="2">2 - ફેબ્રુઆરી (Feb)</option>
            <option value="3">3 - માર્ચ (Mar)</option>
            <option value="4">4 - એપ્રિલ (Apr)</option>
            <option value="5">5 - મે (May)</option>
            <option value="6">6 - જૂન (Jun)</option>
            <option value="7">7 - જુલાઈ (Jul)</option>
            <option value="8">8 - ઓગસ્ટ (Aug)</option>
            <option value="9">9 - સપ્ટેમ્બર (Sep)</option>
            <option value="10">10 - ઓક્ટોબર (Oct)</option>
            <option value="11">11 - નવેમ્બર (Nov)</option>
            <option value="12">12 - ડિસેમ્બર (Dec)</option>
          </select>

          <span className="font-bold text-slate-600 ml-2">સ્થિતિ:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 font-bold focus:ring-2 focus:ring-red-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">બધી પાર્ટીઓ (All Parties)</option>
            <option value="CONFIRMED">કન્ફર્મ બુકિંગ્સ (Confirmed Only)</option>
          </select>
        </div>
      </div>

      {/* 4 PRIMARY SYNCHRONIZED TOP KPI CARDS (EXACT MATCH WITH PAYMENT STITHI) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Parties */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>કુલ પાર્ટીઓ (Total Parties)</span>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {data?.summary?.totalParties || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-700 font-bold">{data?.summary?.paidCount || 0} ચુકતે</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">{data?.summary?.partialCount || 0} આંશિક</span>
            <span>•</span>
            <span className="text-rose-700 font-bold">{data?.summary?.pendingCount || 0} બાકી</span>
          </div>
        </div>

        {/* 2. Total Net Billed */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/30 to-white shadow-2xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
            <span>કુલ નેટ બિલિંગ (Net Billed)</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-1 tabular-nums">
            ₹{(data?.summary?.totalBilled || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-medium">
            ડિસ્કાઉન્ટ બાદ ભાડું + ડિપોઝિટ
          </div>
        </div>

        {/* 3. Total Jama Collected */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/30 to-white shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
            <span>કુલ જમા મળેલ (Jama Collected)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
            ₹{(data?.summary?.totalReceivedJama || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            ખાતાવહીમાં જમા થયેલ કુલ રકમ
          </div>
        </div>

        {/* 4. Total Net Remaining */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/30 to-white shadow-2xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center justify-between">
            <span>કુલ બાકી નેટ રકમ (Net Remaining)</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-1 tabular-nums">
            ₹{(data?.summary?.pendingBalance || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-rose-700 mt-1 font-bold">
            {(data?.summary?.pendingBalance || 0) === 0 ? "સંપૂર્ણ ચુકતે (Zero Balance)" : "વસૂલવાપાત્ર બાકી રકમ"}
          </div>
        </div>
      </div>

      {/* 4 SECONDARY FINANCIAL BREAKDOWN CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            કુલ મૂળ સુવિધા ભાડું (Gross Rent)
          </span>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5 tabular-nums">
            ₹{(data?.summary?.grossRent || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            {data?.summary?.totalBookings || 0} સુવિધા સ્લોટ્સ
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            રાહત / ડિસ્કાઉન્ટ (Discounts)
          </span>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5 tabular-nums">
            - ₹{(data?.summary?.totalDiscounts || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block">
            ટ્રસ્ટ ડિસ્કાઉન્ટ
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            ચોખ્ખું સુવિધા ભાડું (Net Rent)
          </span>
          <div className="text-base sm:text-lg font-black text-red-900 font-mono mt-0.5 tabular-nums">
            ₹{(data?.summary?.netRevenue || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            ગ્રોસ ભાડું - ડિસ્કાઉન્ટ
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            અનામત ડિપોઝિટ (Deposit Held)
          </span>
          <div className="text-base sm:text-lg font-black text-amber-700 font-mono mt-0.5 tabular-nums">
            ₹{(data?.summary?.totalDepositsHeld || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-amber-800 font-medium block">
            પરત મળવાપાત્ર અનામત
          </span>
        </div>
      </div>

      {/* Analytics Visual Charts Section (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Monthly Trend Histogram */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-800" />
                <h2 className="font-extrabold text-sm text-slate-900">
                  માસિક બુકિંગ અને આવક વલણ (Monthly Revenue & Booking Trend)
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {selectedYear === "ALL" ? "સમગ્ર હિસાબ" : `FY ${selectedYear}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 font-medium">
              કયા મહિનામાં સૌથી વધુ હોલ બુક રહ્યા અને લગ્ન સિઝન (Peak Season) નું આવક વિશ્લેષણ
            </p>

            {/* Histogram Bars */}
            <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end h-44 pt-6 pb-2 border-b border-slate-100">
              {data?.monthlyTrends?.map((m: any) => {
                const heightPercent = maxMonthlyRevenue > 0
                  ? Math.max(8, Math.round((m.revenue / maxMonthlyRevenue) * 100))
                  : 8;
                return (
                  <div
                    key={m.monthNumber}
                    className="flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Hover Tooltip */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-mono px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                      ₹{m.revenue.toLocaleString("en-IN")} ({m.bookingsCount} બુકિંગ્સ)
                    </div>

                    {/* Peak Season Flame Icon */}
                    {m.isPeakSeason && (
                      <Flame className="w-3 h-3 text-orange-500 mb-0.5 shrink-0 animate-pulse" />
                    )}

                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 relative group-hover:brightness-110 ${
                        m.isPeakSeason
                          ? "bg-gradient-to-t from-red-800 to-amber-500"
                          : "bg-gradient-to-t from-slate-400 to-slate-300"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] font-bold text-slate-600 mt-1 truncate block w-full text-center">
                      {m.englishName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-red-800 to-amber-500 inline-block" />
              <span>🔥 મુખ્ય લગ્ન/પ્રસંગ સિઝન (Peak Months)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
              <span>સામાન્ય મહિનાઓ</span>
            </div>
          </div>
        </div>

        {/* Right: Facility-wise Popularity & Income Share */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                <h2 className="font-extrabold text-sm text-slate-900">
                  સુવિધા-વાઇઝ લોકપ્રિયતા (Facility Income Share)
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {data?.facilityBreakdown?.length || 8} સુવિધાઓ
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 font-medium">
              દરેક હોલ, પ્લોટ અને રૂમની આવક અને બુકિંગ ટકાવારી
            </p>

            {/* Facility Progress List */}
            <div className="space-y-3">
              {data?.facilityBreakdown?.map((fac: any) => (
                <div key={fac.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate max-w-[200px]">
                      {fac.name.replace("Dormitory — ", "").replace("AC Room — ", "AC ")}
                    </span>
                    <div className="text-right font-mono font-bold text-slate-900">
                      ₹{fac.revenue.toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({fac.sharePercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        fac.type === "PARTY_PLOT"
                          ? "bg-emerald-600"
                          : fac.type === "COMMUNITY_HALL"
                          ? "bg-blue-600"
                          : fac.type === "DORMITORY"
                          ? "bg-purple-600"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.max(3, fac.sharePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium flex items-center justify-between">
            <span>🟢 પ્લોટ • 🔵 હોલ • 🟣 ડોરમેટ્રી • 🟡 AC રૂમ</span>
            <span>ચોખ્ખી આવક પર આધારિત</span>
          </div>
        </div>
      </div>

      {/* SYNCHRONIZED AUDIT LEDGER TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-red-800" />
            <h3 className="font-extrabold text-sm text-slate-900">
              સત્તાવાર ઓડિટ ખાતાવહી રજિસ્ટર (Official Audit Register)
            </h3>

            {/* TAB SWITCHER: Party-Wise vs Single Slots */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveLedgerTab("PARTY_WISE")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLedgerTab === "PARTY_WISE"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>પાર્ટી-વાઇઝ ખાતાવહી ({filteredParties.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLedgerTab("SINGLE_SLOTS")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLedgerTab === "SINGLE_SLOTS"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>સિંગલ સ્લોટ્સ ({filteredBookings.length})</span>
              </button>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="પાર્ટીનું નામ, ફોન, બુકિંગ નં..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>
        </div>

        {/* VIEW 1: PARTY-WISE AUDIT LEDGER (100% IDENTICAL TO PAYMENT STITHI) */}
        {activeLedgerTab === "PARTY_WISE" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <tr>
                  <th className="p-2.5 border-r border-slate-200">તારીખ ગાળો (Dates)</th>
                  <th className="p-2.5 border-r border-slate-200">મુખ્ય બુકિંગ નં</th>
                  <th className="p-2.5 border-r border-slate-200">અરજદાર અને ફોન (Party)</th>
                  <th className="p-2.5 border-r border-slate-200">સુવિધાઓ (Facilities)</th>
                  <th className="p-2.5 border-r border-slate-200">પ્રસંગ</th>
                  <th className="p-2.5 text-right border-r border-slate-200">૧. ગ્રોસ ભાડું</th>
                  <th className="p-2.5 text-right border-r border-slate-200">૨. ડિસ્કાઉન્ટ</th>
                  <th className="p-2.5 text-right border-r border-slate-200">૩. ચોખ્ખું ભાડું</th>
                  <th className="p-2.5 text-center border-r border-slate-200">GST</th>
                  <th className="p-2.5 text-right border-r border-slate-200">૪. ડિપોઝિટ</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-blue-50/40">૫. નેટ બિલિંગ</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-emerald-50/40">૬. જમા રકમ</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-rose-50/30">૭. બાકી રકમ</th>
                  <th className="p-2.5 text-center border-r border-slate-200">સ્થિતિ</th>
                  <th className="p-2.5 text-center no-print">એક્શન્સ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-8 text-center text-slate-500 font-medium">
                      કોઈ પાર્ટી રેકોર્ડ મળેલ નથી.
                    </td>
                  </tr>
                ) : (
                  filteredParties.map((g: any, idx: number) => (
                    <tr key={g.partyKey || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        {g.dateRange?.label}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-red-900 border-r border-slate-100 whitespace-nowrap">
                        <Link
                          href={`/admin/bookings/${g.primaryBookingId}/receipt?mode=all`}
                          target="_blank"
                          className="hover:underline flex items-center gap-1"
                          title="સંયુક્ત સ્લિપ જુઓ"
                        >
                          {g.primaryBookingNumber}
                        </Link>
                      </td>
                      <td className="p-2.5 border-r border-slate-100">
                        <div className="font-bold text-slate-900 leading-tight">
                          {g.customerName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {g.customerPhone}
                        </div>
                      </td>
                      <td className="p-2.5 font-medium text-slate-800 border-r border-slate-100 max-w-[220px]">
                        <div className="truncate font-bold" title={g.facilityNames}>
                          {g.facilityNames}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          ({g.slotsCount} સુવિધાઓ)
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        {g.eventType || "Wedding"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-100 tabular-nums">
                        ₹{g.total.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-emerald-700 border-r border-slate-100 tabular-nums">
                        {g.discountAmount > 0 ? `- ₹${g.discountAmount.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100 tabular-nums">
                        ₹{g.totalWithDiscount.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100 whitespace-nowrap">
                        0% (Pending)
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-amber-800 border-r border-slate-100 tabular-nums">
                        ₹{(Number(g.deposit) || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-blue-950 border-r border-slate-100 tabular-nums bg-blue-50/20">
                        ₹{g.net.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-800 border-r border-slate-100 tabular-nums bg-emerald-50/20">
                        ₹{g.totalJama.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold border-r border-slate-100 tabular-nums bg-rose-50/20">
                        <span className={g.netRemaining > 0 ? "text-rose-700" : "text-emerald-700"}>
                          ₹{g.netRemaining.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap border-r border-slate-100">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            g.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : g.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-rose-100 text-rose-900 border border-rose-300"
                          }`}
                        >
                          {g.paymentStatus === "PAID"
                            ? "સંપૂર્ણ ચુકતે"
                            : g.paymentStatus === "PARTIAL"
                            ? "આંશિક જમા"
                            : "ચુકવણી બાકી"}
                        </span>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap no-print space-x-1">
                        <Link
                          href={`/admin/payments?party=${encodeURIComponent(g.customerPhone || g.customerName)}`}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center gap-0.5 transition"
                          title="પેમેન્ટ સ્થિતિ ખાતાવહીમાં જુઓ"
                        >
                          <span>ખાતું</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                        <Link
                          href={`/admin/bookings/${g.primaryBookingId}/receipt?mode=all`}
                          target="_blank"
                          className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-bold inline-flex items-center gap-0.5 transition"
                          title="સંયુક્ત રસીદ પ્રિન્ટ કરો"
                        >
                          <Receipt className="w-2.5 h-2.5" />
                          <span>સ્લિપ</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Table Footer Totals */}
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={5} className="p-2.5 text-right border-r border-slate-200 font-black">
                    કુલ ઓડિટ સરવાળો (Total Synchronized Summary):
                  </td>
                  <td className="p-2.5 text-right font-mono font-black border-r border-slate-200 tabular-nums">
                    ₹{(data?.summary?.grossRent || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-800 border-r border-slate-200 tabular-nums">
                    - ₹{(data?.summary?.totalDiscounts || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-red-900 border-r border-slate-200 tabular-nums">
                    ₹{(data?.summary?.netRevenue || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200">
                    ₹0.00
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-amber-800 border-r border-slate-200 tabular-nums">
                    ₹{(data?.summary?.totalDepositsHeld || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-blue-950 border-r border-slate-200 tabular-nums bg-blue-100/50">
                    ₹{(data?.summary?.totalBilled || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-800 border-r border-slate-200 tabular-nums bg-emerald-100/50">
                    ₹{(data?.summary?.totalReceivedJama || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-rose-800 border-r border-slate-200 tabular-nums bg-rose-100/50">
                    ₹{(data?.summary?.pendingBalance || 0).toLocaleString("en-IN")}
                  </td>
                  <td></td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* VIEW 2: SINGLE FACILITY SLOTS TABLE */}
        {activeLedgerTab === "SINGLE_SLOTS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <tr>
                  <th className="p-2.5 border-r border-slate-200">બુકિંગ તારીખ</th>
                  <th className="p-2.5 border-r border-slate-200">વાઉચર નં</th>
                  <th className="p-2.5 border-r border-slate-200">અરજદાર અને ફોન</th>
                  <th className="p-2.5 border-r border-slate-200">સુવિધા / હોલ</th>
                  <th className="p-2.5 border-r border-slate-200">પ્રસંગ</th>
                  <th className="p-2.5 text-right border-r border-slate-200">મૂળ ભાડું</th>
                  <th className="p-2.5 text-right border-r border-slate-200">ડિસ્કાઉન્ટ</th>
                  <th className="p-2.5 text-right border-r border-slate-200">ચોખ્ખું ભાડું</th>
                  <th className="p-2.5 text-center border-r border-slate-200">GST</th>
                  <th className="p-2.5 text-center">સ્થિતિ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b: any, idx: number) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-2.5 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                      {new Date(b.startDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-red-900 border-r border-slate-100 whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/${b.id}/receipt?mode=single`}
                        target="_blank"
                        className="hover:underline"
                        title="સિંગલ સ્લિપ જુઓ"
                      >
                        {b.bookingNumber}
                      </Link>
                    </td>
                    <td className="p-2.5 border-r border-slate-100">
                      <div className="font-bold text-slate-900 leading-tight">
                        {b.customerName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {b.customerPhone}
                      </div>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800 border-r border-slate-100 whitespace-nowrap">
                      {b.facility?.name}
                    </td>
                    <td className="p-2.5 font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">
                      {b.eventType}
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-100 tabular-nums">
                      ₹{b.grossAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold text-emerald-700 border-r border-slate-100 tabular-nums">
                      {b.discountAmount > 0 ? `- ₹${Number(b.discountAmount).toLocaleString("en-IN")}` : "₹0"}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100 tabular-nums">
                      ₹{b.netAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      0% (Pending)
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formal Printable Audit Signatures (Visible on Print) */}
      <div className="hidden print:grid grid-cols-3 gap-8 text-xs pt-12 mt-8 border-t border-dashed border-slate-300">
        <div className="text-center">
          <div className="h-12"></div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
            મુખ્ય ટ્રસ્ટીશ્રી (Managing Trustee)
          </div>
          <span className="text-[10px] text-slate-500">શ્રી સૌરાષ્ટ્ર પટેલ સમાજ</span>
        </div>

        <div className="text-center">
          <div className="h-12"></div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
            ખજાનચીશ્રી / હિસાબનીશ (Treasurer / Accountant)
          </div>
          <span className="text-[10px] text-slate-500">શ્રી સૌરાષ્ટ્ર પટેલ સમાજ</span>
        </div>

        <div className="text-center">
          <div className="h-12"></div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
            ઓડિટરશ્રી / સીએ (Internal Auditor / CA)
          </div>
          <span className="text-[10px] text-slate-500">ચાર્ટર્ડ એકાઉન્ટન્ટ</span>
        </div>
      </div>
    </div>
  );
}

export default function AuditReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-800"></div>
        </div>
      }
    >
      <AuditReportsContent />
    </Suspense>
  );
}
