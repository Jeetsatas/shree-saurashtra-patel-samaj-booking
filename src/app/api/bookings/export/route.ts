import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    // Role & permission check: Super Admin or authorized View-Only Admin
    const canExport = user.role === "SUPER_ADMIN" || user.canExport === true;
    if (!canExport) {
      return NextResponse.json(
        {
          error: "Permission denied. View-only administrators cannot export records unless authorized by the Super Admin.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const facilityId = searchParams.get("facilityId");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (facilityId && facilityId !== "ALL") where.facilityId = facilityId;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        facility: {
          select: { name: true, code: true, type: true },
        },
      },
    });

    // Generate CSV Header & Rows
    const headers = [
      "Booking Number",
      "Facility Code",
      "Facility Name",
      "Customer Name",
      "Customer Phone",
      "Event Type",
      "Start Date",
      "End Date",
      "Slot",
      "Status",
      "Facility Rent (INR)",
      "Discount Category",
      "Discount Amount (INR)",
      "Services Amount (INR)",
      "Total Amount (INR)",
      "Caution Deposit (INR)",
      "Payment Status",
      "Notes",
      "Booked At",
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = bookings.map((b) => [
      escapeCsv(b.bookingNumber),
      escapeCsv(b.facility?.code || ""),
      escapeCsv(b.facility?.name || ""),
      escapeCsv(b.customerName),
      escapeCsv(b.customerPhone),
      escapeCsv(b.eventType),
      escapeCsv(new Date(b.startDate).toISOString().slice(0, 10)),
      escapeCsv(new Date(b.endDate).toISOString().slice(0, 10)),
      escapeCsv(b.slot),
      escapeCsv(b.status),
      b.facilityAmount.toFixed(2),
      escapeCsv(b.discountCode || "NONE"),
      b.discountAmount.toFixed(2),
      b.servicesAmount.toFixed(2),
      b.totalAmount.toFixed(2),
      b.depositAmount.toFixed(2),
      escapeCsv(b.paymentStatus),
      escapeCsv(b.notes || ""),
      escapeCsv(new Date(b.createdAt).toISOString()),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    // Log the export action
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "EXPORT_BOOKINGS",
          details: `Exported ${bookings.length} booking records to CSV`,
          recordType: "BOOKING",
        },
      });
    } catch (logErr) {
      console.error("Export log error:", logErr);
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="patel_samaj_bookings_${timestamp}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export bookings" }, { status: 500 });
  }
}

