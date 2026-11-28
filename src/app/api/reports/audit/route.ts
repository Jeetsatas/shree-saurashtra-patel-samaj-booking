import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { groupBookingsByParty, parseJamaEntries, PartyBookingGroup } from "@/lib/slotUtils";

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
    const yearParam = searchParams.get("year") || "ALL"; // default ALL to match Payment Stithi
    const monthParam = searchParams.get("month"); // "1" - "12" or "ALL"
    const statusParam = searchParams.get("status") || "ALL"; // default ALL for complete audit
    const format = searchParams.get("format") || "json"; // "json" | "csv_ca" | "csv_tally"

    const where: any = {};

    // Status filter
    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    // Date / Year filter (if not "ALL")
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
    } else if (monthParam && monthParam !== "ALL") {
      // If month is specified without year, use current year
      const curYear = new Date().getFullYear();
      const month = parseInt(monthParam, 10);
      const start = new Date(curYear, month - 1, 1, 0, 0, 0);
      const end = new Date(curYear, month, 0, 23, 59, 59);
      where.startDate = { gte: start, lte: end };
    }

    const [allRawBookings, facilities] = await Promise.all([
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

    // Group bookings into Parties (THE EXACT SAME ENGINE AS PAYMENT STITHI)
    const partyGroups: PartyBookingGroup[] = groupBookingsByParty(allRawBookings);

    // Compute Party-Synchronized Financial Totals
    let grossRent = 0;
    let totalDiscounts = 0;
    let netRevenue = 0;
    let totalDepositsHeld = 0;
    let totalBilled = 0;
    let totalReceivedJama = 0;
    let pendingBalance = 0;
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;

    for (const g of partyGroups) {
      grossRent += g.total;
      totalDiscounts += g.discountAmount;
      netRevenue += g.totalWithDiscount;
      totalDepositsHeld += g.deposit;
      totalBilled += g.net;
      totalReceivedJama += g.totalJama;
      pendingBalance += g.netRemaining;

      if (g.paymentStatus === "PAID") paidCount++;
      else if (g.paymentStatus === "PARTIAL") partialCount++;
      else pendingCount++;
    }

    // Facility Stats
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
      isPeakSeason: [0, 1, 4, 10, 11].includes(idx),
    }));

    const eventCounts: Record<string, { count: number; revenue: number }> = {};

    // Single booking enrichment
    const enrichedBookings = allRawBookings.map((b) => {
      const bFacAmt = Number(b.facilityAmount ?? b.totalAmount ?? 0);
      const bDisc = Number(b.discountAmount ?? 0);
      const bServAmt = Number(b.servicesAmount ?? 0);
      const bGross = bFacAmt + bServAmt;
      const bNet = Math.max(0, bGross - bDisc);
      const bDep = Number(b.depositAmount ?? 0);
      const totalPayable = bNet + bDep;

      if (b.status !== "CANCELLED") {
        if (b.facilityId && facilityStats[b.facilityId]) {
          facilityStats[b.facilityId].bookingsCount += 1;
          facilityStats[b.facilityId].revenue += bNet;
        }

        const bDate = new Date(b.startDate);
        const mIdx = bDate.getMonth();
        if (monthlyTrends[mIdx]) {
          monthlyTrends[mIdx].bookingsCount += 1;
          monthlyTrends[mIdx].revenue += bNet;
          monthlyTrends[mIdx].deposits += bDep;
        }

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
      };
    });

    const enrichedPartyGroups = partyGroups.map((g) => {
      const firstB = g.bookings[0];
      return {
        ...g,
        primaryBookingId: firstB?.id || "",
        primaryBookingNumber: firstB?.bookingNumber || "",
        bookingNumbers: g.bookings.map((b) => b.bookingNumber).join(", "),
        facilityNames: g.bookings.map((b) => b.facility?.name).filter(Boolean).join(" + "),
        slotsCount: g.bookings.length,
      };
    });

    // CA Audit CSV Format (Party-level accurate to Payment Stithi)
    if (format === "csv_ca") {
      const headers = [
        "Voucher Date",
        "Primary Booking No",
        "All Linked Booking Nos",
        "Party Customer Name",
        "Phone Number",
        "Address / Village",
        "Booked Facilities",
        "Slots Count",
        "Event Type",
        "Event Dates Range",
        "Gross Facility Rent (INR)",
        "Trust Concession / Discount (INR)",
        "Net Taxable Rent (INR)",
        "GST Rate (%)",
        "CGST (INR)",
        "SGST (INR)",
        "Caution Deposit (INR)",
        "Net Billed Value (INR)",
        "Total Jama Received (INR)",
        "Net Remaining Balance (INR)",
        "Payment Status",
        "Trust Registration No",
        "GST Registration Status",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const clean = String(str).replace(/"/g, '""');
        return `"${clean}"`;
      };

      const rows = enrichedPartyGroups.map((g) => [
        escapeCsv(new Date(g.dateRange.startDate).toISOString().slice(0, 10)),
        escapeCsv(g.primaryBookingNumber),
        escapeCsv(g.bookingNumbers),
        escapeCsv(g.customerName),
        escapeCsv(g.customerPhone),
        escapeCsv(g.customerAddress || "Nikol, Ahmedabad"),
        escapeCsv(g.facilityNames),
        g.slotsCount,
        escapeCsv(g.eventType || "Wedding"),
        escapeCsv(g.dateRange.label),
        g.total.toFixed(2),
        g.discountAmount.toFixed(2),
        g.totalWithDiscount.toFixed(2),
        escapeCsv("0% (Registration Pending)"),
        "0.00",
        "0.00",
        g.deposit.toFixed(2),
        g.net.toFixed(2),
        g.totalJama.toFixed(2),
        g.netRemaining.toFixed(2),
        escapeCsv(g.paymentStatus),
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
        "Total Billed Amount",
        "Total Jama Received",
        "Balance Due",
        "Narration",
        "GST Note",
      ];

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const clean = String(str).replace(/"/g, '""');
        return `"${clean}"`;
      };

      const rows = enrichedPartyGroups.map((g) => [
        escapeCsv(new Date(g.dateRange.startDate).toISOString().slice(0, 10)),
        escapeCsv("Sales / Booking Receipt"),
        escapeCsv(g.primaryBookingNumber),
        escapeCsv(`${g.customerName} (${g.customerPhone})`),
        escapeCsv(`Hall Rent Income - ${g.facilityNames}`),
        g.totalWithDiscount.toFixed(2),
        escapeCsv("Refundable Caution Deposit Liability"),
        g.deposit.toFixed(2),
        g.net.toFixed(2),
        g.totalJama.toFixed(2),
        g.netRemaining.toFixed(2),
        escapeCsv(
          `Party ${g.customerName}, Dates: ${g.dateRange.label}, Bookings: ${g.bookingNumbers}, Event: ${g.eventType}`
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
        totalParties: partyGroups.length,
        totalBookings: allRawBookings.length,
        confirmedCount: allRawBookings.filter((b) => b.status === "CONFIRMED").length,
        cancelledCount: allRawBookings.filter((b) => b.status === "CANCELLED").length,
        grossRent,
        totalDiscounts,
        netRevenue,
        totalDepositsHeld,
        totalBilled,
        totalReceivedJama,
        pendingBalance,
        paidCount,
        partialCount,
        pendingCount,
      },
      partyGroups: enrichedPartyGroups,
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
