import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseJamaEntries } from "@/lib/slotUtils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Private system restricted to administrators." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || new Date().getFullYear().toString();
    const monthParam = searchParams.get("month"); // "1" - "12" or "ALL"
    const statusParam = searchParams.get("status") || "CONFIRMED"; // default CONFIRMED for audit
    const format = searchParams.get("format") || "json"; // "json" | "csv_ca" | "csv_tally"

    const where: any = {};

    // Status filter
    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    // Date / Year filter
    if (yearParam && yearParam !== "ALL") {
      const year = parseInt(yearParam, 10);
      if (monthParam && monthParam !== "ALL") {
        const month = parseInt(monthParam, 10);
        const start = new Date(year, month - 1, 1, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59);
        where.startDate = { gte: start, lte: end };
      } else {
        const start = new Date(year, 0, 1, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59);
        where.startDate = { gte: start, lte: end };
      }
    }

    const [bookings, facilities] = await Promise.all([
      withDbRetry(() =>
        prisma.booking.findMany({
          where,
          orderBy: { startDate: "asc" },
          include: {
            facility: true,
          },
        })
      ),
      withDbRetry(() => prisma.facility.findMany({ orderBy: { id: "asc" } })),
    ]);

    // Financial & Operational Metrics
    let grossRent = 0;
    let totalDiscounts = 0;
    let netRevenue = 0;
    let totalDepositsHeld = 0;
    let totalReceivedJama = 0;
    let pendingBalance = 0;

    const eventCounts: Record<string, { count: number; revenue: number }> = {};
    const facilityStats: Record<
      string,
      {
        id: string;
        name: string;
        code: string;
        type: string;
        bookingsCount: number;
        revenue: number;
      }
    > = {};

    for (const f of facilities) {
      facilityStats[f.id] = {
        id: f.id,
        name: f.name,
        code: f.code,
        type: f.type,
        bookingsCount: 0,
        revenue: 0,
      };
    }

    // 12-Month Array for trend
    const targetYear = yearParam !== "ALL" ? parseInt(yearParam, 10) : new Date().getFullYear();
    const gujaratiMonths = [
      "જાન્યુઆરી",
      "ફેબ્રુઆરી",
      "માર્ચ",
      "એપ્રિલ",
      "મે",
      "જૂન",
      "જુલાઈ",
      "ઓગસ્ટ",
      "સપ્ટેમ્બર",
      "ઓક્ટોબર",
      "નવેમ્બર",
      "ડિસેમ્બર",
    ];
    const englishMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyTrends = gujaratiMonths.map((name, idx) => ({
      monthNumber: idx + 1,
      monthName: name,
      englishName: englishMonths[idx],
      bookingsCount: 0,
      revenue: 0,
      deposits: 0,
      // Traditional Gujarati Saurashtra peak wedding/event seasons: Nov, Dec, Jan, Feb, May
      isPeakSeason: [0, 1, 4, 10, 11].includes(idx),
    }));

    const enrichedBookings = bookings.map((b) => {
      const bFacAmt = Number(b.facilityAmount ?? b.totalAmount ?? 0);
      const bDisc = Number(b.discountAmount ?? 0);
      const bServAmt = Number(b.servicesAmount ?? 0);
      const bGross = bFacAmt + bServAmt;
      const bNet = Math.max(0, bGross - bDisc);
      const bDep = Number(b.depositAmount ?? 0);
      const totalPayable = bNet + bDep;

      const jamaList = parseJamaEntries(b.notes);
      let bJama = 0;
      if (jamaList.length > 0) {
        bJama = jamaList.reduce((sum, j) => sum + (Number(j.amount) || 0), 0);
      } else if (b.paymentStatus === "PAID") {
        bJama = totalPayable;
      }

      const bRemaining = Math.max(0, totalPayable - bJama);

      if (b.status !== "CANCELLED") {
        grossRent += bGross;
        totalDiscounts += bDisc;
        netRevenue += bNet;
        totalDepositsHeld += bDep;
        totalReceivedJama += bJama;
        pendingBalance += bRemaining;

        // Facility Stats
        if (b.facilityId && facilityStats[b.facilityId]) {
          facilityStats[b.facilityId].bookingsCount += 1;
          facilityStats[b.facilityId].revenue += bNet;
        }

        // Monthly Stats
        const bDate = new Date(b.startDate);
        const mIdx = bDate.getMonth();
        if (monthlyTrends[mIdx]) {
          monthlyTrends[mIdx].bookingsCount += 1;
          monthlyTrends[mIdx].revenue += bNet;
          monthlyTrends[mIdx].deposits += bDep;
        }

        // Event Type Stats
        const ev = b.eventType || "Other";
        if (!eventCounts[ev]) eventCounts[ev] = { count: 0, revenue: 0 };
        eventCounts[ev].count += 1;
        eventCounts[ev].revenue += bNet;
      }

      return {
        ...b,
        grossAmount: bGross,
        netAmount: bNet,
        totalPayable,
        jamaAmount: bJama,
        remainingAmount: bRemaining,
      };
    });

    // CA Audit CSV Format
    if (format === "csv_ca") {
      const headers = [
        "Voucher Date",
        "Booking Number",
        "Customer Name",
        "Phone Number",
        "Address / Village",
        "Facility Code",
        "Facility Name",
        "Event Type",
        "Event Start Date",
        "Event End Date",
        "Time Slot",
        "Gross Facility Rent (INR)",
        "Trust Concession / Discount (INR)",
        "Net Taxable Value (INR)",
        "GST Rate (%)",
        "CGST (INR)",
        "SGST (INR)",
        "Refundable Caution Deposit (INR)",
        "Total Voucher Value (INR)",
        "Total Jama Received (INR)",
        "Balance Receivable (INR)",
        "Payment Status",
        "Payment Mode & Ref",
        "Trust Registration No",
        "GST Registration Status",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const clean = String(str).replace(/"/g, '""');
        return `"${clean}"`;
      };

      const rows = enrichedBookings.map((b) => [
        escapeCsv(new Date(b.createdAt).toISOString().slice(0, 10)),
        escapeCsv(b.bookingNumber),
        escapeCsv(b.customerName),
        escapeCsv(b.customerPhone),
        escapeCsv(b.customerAddress || "Nikol, Ahmedabad"),
        escapeCsv(b.facility?.code || ""),
        escapeCsv(b.facility?.name || ""),
        escapeCsv(b.eventType),
        escapeCsv(new Date(b.startDate).toISOString().slice(0, 10)),
        escapeCsv(new Date(b.endDate || b.startDate).toISOString().slice(0, 10)),
        escapeCsv(b.slot),
        b.grossAmount.toFixed(2),
        (Number(b.discountAmount) || 0).toFixed(2),
        b.netAmount.toFixed(2),
        escapeCsv("0% (Registration Pending)"),
        "0.00",
        "0.00",
        (Number(b.depositAmount) || 0).toFixed(2),
        b.totalPayable.toFixed(2),
        b.jamaAmount.toFixed(2),
        b.remainingAmount.toFixed(2),
        escapeCsv(b.paymentStatus),
        escapeCsv(`${b.paymentMethod || "CASH"} ${b.paymentRefNo || ""}`.trim()),
        escapeCsv("E/15894/Ahmedabad (Charitable Trust)"),
        escapeCsv("Pending"),
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      const filename = `SSPS_CA_Audit_Register_${yearParam}_${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Tally Sales & Receipt Register Format
    if (format === "csv_tally") {
      const headers = [
        "Date",
        "Voucher Type",
        "Voucher No",
        "Party Ledger Name",
        "Income Ledger (Hall Rent)",
        "Net Rent Amount",
        "Deposit Ledger (Caution Deposit)",
        "Deposit Amount",
        "Total Amount",
        "Narration",
        "GST Note",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const clean = String(str).replace(/"/g, '""');
        return `"${clean}"`;
      };

      const rows = enrichedBookings.map((b) => [
        escapeCsv(new Date(b.startDate).toISOString().slice(0, 10)),
        escapeCsv("Sales / Booking Receipt"),
        escapeCsv(b.bookingNumber),
        escapeCsv(`${b.customerName} (${b.customerPhone})`),
        escapeCsv(`Hall Rent Income - ${b.facility?.name || "Samaj Facility"}`),
        b.netAmount.toFixed(2),
        escapeCsv("Refundable Caution Deposit Liability"),
        (Number(b.depositAmount) || 0).toFixed(2),
        b.totalPayable.toFixed(2),
        escapeCsv(
          `Booking for ${b.facility?.name} on ${new Date(b.startDate).toLocaleDateString("en-IN")}, Event: ${b.eventType}, Phone: ${b.customerPhone}`
        ),
        escapeCsv("Charitable Trust - GST Registration Pending"),
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      const filename = `SSPS_Tally_Sales_Register_${yearParam}_${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON response for web dashboard
    const facilityList = Object.values(facilityStats).map((item) => ({
      ...item,
      sharePercent: netRevenue > 0 ? Math.round((item.revenue / netRevenue) * 100) : 0,
    }));

    return NextResponse.json({
      success: true,
      year: yearParam,
      month: monthParam || "ALL",
      status: statusParam,
      trustInfo: {
        name: "શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (Shree Saurashtra Patel Samaj)",
        unit: "નિકોલ - નરોડા, અમદાવાદ",
        registrationNo: "E/15894/Ahmedabad (Public Charitable Trust)",
        gstStatus: "Pending",
        address: "Near Nikol Lake & Ring Road, Nikol - Naroda, Ahmedabad - 382350",
        phone: "+91 98250 12345 / 079-22985600",
      },
      summary: {
        totalBookings: bookings.length,
        confirmedCount: bookings.filter((b) => b.status === "CONFIRMED").length,
        cancelledCount: bookings.filter((b) => b.status === "CANCELLED").length,
        grossRent,
        totalDiscounts,
        netRevenue,
        totalDepositsHeld,
        totalReceivedJama,
        pendingBalance,
      },
      monthlyTrends,
      facilityBreakdown: facilityList,
      eventBreakdown: eventCounts,
      bookingsCount: enrichedBookings.length,
      bookings: enrichedBookings,
    });
  } catch (error: any) {
    console.error("Audit Report API error:", error);
    return NextResponse.json(
      { error: "Failed to generate audit report: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
