"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
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
} from "lucide-react";

function AuditReportsContent() {
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("CONFIRMED");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filtered bookings table
  const filteredBookings = useMemo(() => {
    if (!data?.bookings) return [];
    if (!searchQuery.trim()) return data.bookings;
    const q = searchQuery.toLowerCase();
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
            <span className="text-slate-700 font-bold">ઓડિટ અને એનાલિટિક્સ</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-800" />
            વાર્ષિક ઓડિટ અને એનાલિટિક્સ રિપોર્ટ
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ - નરોડા) • CA Audit, Tally ફોર્મેટ અને ઓક્યુપન્સી એનાલિટિક્સ
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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
            title="CA / Auditor માટે વિગતવાર એક્સેલ/CSV એક્સપોર્ટ"
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
          સત્તાવાર વાર્ષિક ઓડિટ, નાણાકીય હિસાબ અને ઓક્યુપન્સી રજિસ્ટર • વર્ષ: {selectedYear}
        </p>
        <p className="text-[9px] text-slate-500 font-semibold">
          Registration No: E/15894/Ahmedabad (Public Charitable Trust) • GST Registration: Pending
        </p>
      </div>

      {/* GST Status & Legal Disclosure Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold flex items-center gap-2">
              <span>સાર્વજનિક ધર્માદા ટ્રસ્ટ હિસાબ (Trust Reg: E/15894/Ahmedabad)</span>
              <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                GST: પેન્ડિંગ (Pending)
              </span>
            </div>
            <p className="text-[11px] text-amber-900/90 mt-0.5 font-medium leading-relaxed">
              સંસ્થા પબ્લિક ચેરિટેબલ ટ્રસ્ટ હેઠળ કાર્યરત છે અને GST નોંધણી હાલ પ્રક્રિયામાં (Pending) હોવાથી તમામ વ્યવહારો શુદ્ધ ભાડા અને પરત મળવાપાત્ર અનામત ડિપોઝિટ તરીકે નોંધાયેલ છે.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 font-mono text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
          FY {selectedYear} • {selectedMonth === "ALL" ? "સંપૂર્ણ વર્ષ" : `મહિનો ${selectedMonth}`}
        </div>
      </div>

      {/* Year & Period Filters (No Print) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs no-print flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            વર્ષ પસંદ કરો:
          </span>
          {["2026", "2027", "2025", "ALL"].map((yr) => (
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
              {yr === "ALL" ? "બધા વર્ષો" : yr}
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

          <span className="font-bold text-slate-600 ml-2">સ્ટેટસ:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 font-bold focus:ring-2 focus:ring-red-800 focus:outline-none cursor-pointer"
          >
            <option value="CONFIRMED">કન્ફર્મ બુકિંગ્સ (Confirmed Only)</option>
            <option value="ALL">બધા સ્ટેટસ (All Records)</option>
          </select>
        </div>
      </div>

      {/* 6 Key Financial KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Gross Facility Rent */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            કુલ ગ્રોસ ભાડું (Gross Rent)
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 tabular-nums">
            ₹{(data?.summary?.grossRent || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            કુલ {data?.summary?.totalBookings || 0} બુકિંગ્સ
          </span>
        </div>

        {/* 2. Discounts / Concessions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            રાહત / ડિસ્કાઉન્ટ (Discounts)
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-1 tabular-nums">
            - ₹{(data?.summary?.totalDiscounts || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            સમાજ ડિસ્કાઉન્ટ
          </span>
        </div>

        {/* 3. Net Booking Revenue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs bg-gradient-to-br from-white to-red-50/30 border-red-200">
          <span className="text-[10px] font-bold text-red-900 uppercase tracking-wide block">
            ચોખ્ખી આવક (Net Revenue)
          </span>
          <div className="text-lg sm:text-xl font-black text-red-900 font-mono mt-1 tabular-nums">
            ₹{(data?.summary?.netRevenue || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            ગ્રોસ - ડિસ્કાઉન્ટ
          </span>
        </div>

        {/* 4. Caution Deposit Liability */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            અનામત ડિપોઝિટ (Deposit Held)
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-700 font-mono mt-1 tabular-nums">
            ₹{(data?.summary?.totalDepositsHeld || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
            પરત મળવાપાત્ર લાયાબિલિટી
          </span>
        </div>

        {/* 5. Total Received Jama */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            કુલ જમા રકમ (Total Received)
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-800 font-mono mt-1 tabular-nums">
            ₹{(data?.summary?.totalReceivedJama || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            રોકડ / ઓનલાઇન જમા
          </span>
        </div>

        {/* 6. Pending Receivables */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
            બાકી લેણી રકમ (Receivables)
          </span>
          <div className={`text-lg sm:text-xl font-black font-mono mt-1 tabular-nums ${
            (data?.summary?.pendingBalance || 0) > 0 ? "text-rose-700" : "text-emerald-700"
          }`}>
            ₹{(data?.summary?.pendingBalance || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            {(data?.summary?.pendingBalance || 0) === 0 ? "સંપૂર્ણ ચુકતે" : "વસૂલવાની બાકી"}
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
                FY {selectedYear}
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
              <span>🔥 મુખ્ય લગ્ન/પ્રસંગ સિઝન (Peak Wedding Months)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />
              <span>સામાન્ય મહિનાઓ (Regular Months)</span>
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
            <span>કુલ ચોખ્ખી આવક પર આધારિત</span>
          </div>
        </div>
      </div>

      {/* Audit Bookings Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Table Controls (No Print) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-800" />
            <h3 className="font-extrabold text-sm text-slate-900">
              ઓડિટ વાઉચર રજિસ્ટર (Detailed Audit & Booking Ledger)
            </h3>
            <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {filteredBookings.length} રેકોર્ડ્સ
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="અરજદાર, ફોન, બુકિંગ નં..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700">
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
                <th className="p-2.5 text-right border-r border-slate-200">ડિપોઝિટ</th>
                <th className="p-2.5 text-right border-r border-slate-200">જમા</th>
                <th className="p-2.5 text-right border-r border-slate-200">બાકી</th>
                <th className="p-2.5 text-center">સ્ટેટસ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-500 font-medium">
                    આ ફિલ્ટર માટે કોઈ રેકોર્ડ મળેલ નથી.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b: any, idx: number) => (
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
                        href={`/admin/bookings/${b.id}/receipt?mode=all`}
                        target="_blank"
                        className="hover:underline flex items-center gap-1"
                        title="સંયુક્ત સ્લિપ જુઓ"
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
                    <td className="p-2.5 text-right font-mono font-semibold text-amber-800 border-r border-slate-100 tabular-nums">
                      ₹{(Number(b.depositAmount) || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-800 border-r border-slate-100 tabular-nums">
                      ₹{b.jamaAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold border-r border-slate-100 tabular-nums">
                      <span className={b.remainingAmount > 0 ? "text-rose-700" : "text-emerald-700"}>
                        ₹{b.remainingAmount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                            : b.status === "CANCELLED"
                            ? "bg-rose-100 text-rose-900 border border-rose-200"
                            : "bg-amber-100 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td colSpan={5} className="p-2.5 text-right border-r border-slate-200 font-black">
                  કુલ હિસાબ સરવાળો (Total Ledger Summary):
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
                <td className="p-2.5 text-right font-mono font-black text-emerald-800 border-r border-slate-200 tabular-nums">
                  ₹{(data?.summary?.totalReceivedJama || 0).toLocaleString("en-IN")}
                </td>
                <td className="p-2.5 text-right font-mono font-black text-rose-800 border-r border-slate-200 tabular-nums">
                  ₹{(data?.summary?.pendingBalance || 0).toLocaleString("en-IN")}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
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
