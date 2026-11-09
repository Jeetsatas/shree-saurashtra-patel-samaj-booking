import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Helper function to determine if two slots on the same date conflict
function doSlotsOverlap(slotA: string, slotB: string): boolean {
  const normA = (slotA || "FULL_DAY").toUpperCase();
  const normB = (slotB || "FULL_DAY").toUpperCase();

  // Full day or Whole day always blocks everything
  if (
    normA === "FULL_DAY" ||
    normA === "WHOLE_DAY" ||
    normB === "FULL_DAY" ||
    normB === "WHOLE_DAY"
  ) {
    return true;
  }

  // Same slot always conflicts
  if (normA === normB) {
    return true;
  }

  // Morning (6 AM - 2 PM) and Afternoon (3 PM - 12 Midnight) do NOT overlap (1-hour gap)
  if (
    (normA === "MORNING" && normB === "AFTERNOON") ||
    (normA === "AFTERNOON" && normB === "MORNING")
  ) {
    return false;
  }

  // Default: treat as conflict if slots are not explicitly non-overlapping
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");
    const resourceGroup = searchParams.get("resourceGroup");
    const month = searchParams.get("month"); // 1-12
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Private system restricted to administrators." },
        { status: 401 }
      );
    }

    const where: any = {};
    if (facilityId && facilityId !== "ALL") {
      where.facilityId = facilityId;
    }
    if (status) {
      where.status = status;
    }

    if (month && year) {
      const startOfMonth = new Date(Number(year), Number(month) - 1, 1, 0, 0, 0);
      const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.startDate = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            resourceGroup: true,
          },
        },
      },
    });

    const adminBookings = bookings.map((b) => ({
      ...b,
      facilityName: b.facility?.name || "",
      facilityCode: b.facility?.code || "",
      resourceGroup: b.facility?.resourceGroup || "",
    }));

    return NextResponse.json({ bookings: adminBookings, isAdmin: true, role: user.role });
  } catch (error: any) {
    console.error("Bookings GET error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can create bookings. View-only administrators cannot perform modifications." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      facilityId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerAadhar,
      eventType,
      startDate,
      endDate,
      slot,
      status,
      facilityAmount,
      discountCode,
      discountPercent,
      discountAmount,
      discountOverridden,
      discountOverrideReason,
      selectedServices,
      servicesAmount,
      totalAmount,
      depositAmount,
      paymentStatus,
      paymentMethod,
      paymentRefNo,
      notes,
    } = body;

    if (!facilityId || !customerName || !customerPhone || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Required fields missing: facility, customer name, phone, dates" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const requestedSlot = (slot || "FULL_DAY").toUpperCase();

    // 1. Fetch Target Facility, optional Discount Rule, and latest booking in parallel
    const [targetFacility, discountRule, latestBooking] = await Promise.all([
      prisma.facility.findUnique({
        where: { id: facilityId },
      }),
      discountCode && discountCode !== "NONE" && !discountOverridden
        ? prisma.discountRule.findUnique({ where: { code: discountCode } })
        : Promise.resolve(null),
      prisma.booking.findFirst({
        orderBy: { createdAt: "desc" },
        select: { bookingNumber: true },
      }),
    ]);

    if (!targetFacility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const resourceGroup = targetFacility.resourceGroup || targetFacility.code;

    // 2. Direct single-query conflict check matching either this facility or shared resource group
    const activeConflicts = await prisma.booking.findMany({
      where: {
        facility: {
          OR: [{ id: targetFacility.id }, { resourceGroup: resourceGroup }],
        },
        status: { in: ["CONFIRMED", "BLOCKED_BY_TRUST"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true,
        slot: true,
        facility: { select: { name: true, code: true, resourceGroup: true } },
      },
    });

    // Check if slots overlap on the same date
    const conflictingBooking = activeConflicts.find((existing) =>
      doSlotsOverlap(existing.slot, requestedSlot)
    );

    if (conflictingBooking) {
      return NextResponse.json(
        {
          error: `Physical resource conflict: ${conflictingBooking.facility?.name || "This physical facility"} is already booked for date and slot (${conflictingBooking.slot}).`,
          conflicts: activeConflicts,
        },
        { status: 409 }
      );
    }

    // 3. Financial & Discount Validation
    let defaultFacilityRent = targetFacility.baseRent || 0;
    if (targetFacility.code === "PLOT-OUTSIDE" || targetFacility.type === "PLOT") {
      const ev = (eventType || "").toLowerCase();
      if (ev.includes("wedding") || ev.includes("lagna") || ev.includes("marriage") || ev.includes("reception") || ev.includes("mandap") || ev.includes("wedd")) {
        defaultFacilityRent = targetFacility.weddingRent || targetFacility.baseRent || 0;
      } else {
        defaultFacilityRent = targetFacility.familyRent || targetFacility.baseRent || 0;
      }
    }
    const baseFacilityCost = facilityAmount !== undefined && facilityAmount !== null && !isNaN(Number(facilityAmount))
      ? Number(facilityAmount)
      : defaultFacilityRent;

    let finalDiscountPercent = Number(discountPercent) || 0;
    let finalDiscountAmount = Number(discountAmount) || 0;

    // If discountRule was fetched and valid, compute standard discount
    if (discountRule && discountRule.isActive) {
      finalDiscountPercent = discountRule.percentage;
      finalDiscountAmount = (baseFacilityCost * discountRule.percentage) / 100;
    }

    const finalServicesCost = Number(servicesAmount) || 0;
    const calculatedTotal = Math.max(
      0,
      baseFacilityCost - finalDiscountAmount
    ) + finalServicesCost;

    const finalTotalAmount =
      totalAmount !== undefined ? Number(totalAmount) : calculatedTotal;

    // Generate unique booking number from latest sequence
    const currentYear = new Date().getFullYear();
    let nextNum = 1;
    if (latestBooking?.bookingNumber) {
      const match = latestBooking.bookingNumber.match(/SSPS-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const bookingNumber = `SSPS-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    const newBooking = await prisma.booking.create({
      data: {
        bookingNumber,
        facilityId,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        customerAadhar: customerAadhar || null,
        eventType: eventType || "General Function",
        startDate: start,
        endDate: end,
        slot: requestedSlot,
        status: status || "CONFIRMED",
        facilityAmount: baseFacilityCost,
        discountCode: discountCode || null,
        discountPercent: finalDiscountPercent,
        discountAmount: finalDiscountAmount,
        discountOverridden: !!discountOverridden,
        discountOverrideReason: discountOverrideReason || null,
        selectedServices: selectedServices ? JSON.stringify(selectedServices) : null,
        servicesAmount: finalServicesCost,
        totalAmount: finalTotalAmount,
        depositAmount: Number(depositAmount ?? targetFacility.cautionDeposit) || 0,
        paymentStatus: paymentStatus || "PENDING",
        paymentMethod: paymentMethod || "OFFLINE_CASH",
        paymentRefNo: paymentRefNo || null,
        notes: notes || null,
        bookedByUserId: user.id,
        createdByName: user.name,
        lastUpdatedByName: user.name,
      },
      include: {
        facility: true,
      },
    });

    // Record activity non-blocking so client receives response immediately
    prisma.activityLog
      .create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "CREATE_BOOKING",
          details: `Created booking ${newBooking.bookingNumber} for ${newBooking.customerName} (${newBooking.eventType}) at ${newBooking.facility.name}`,
          recordId: newBooking.id,
          recordType: "BOOKING",
        },
      })
      .catch((err) => console.error("Activity log non-blocking error:", err));

    return NextResponse.json({ success: true, booking: newBooking });
  } catch (error: any) {
    console.error("Booking POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create booking" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can edit or update bookings. View-only administrators cannot modify records." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      id,
      status,
      facilityAmount,
      discountCode,
      discountPercent,
      discountAmount,
      discountOverridden,
      discountOverrideReason,
      selectedServices,
      servicesAmount,
      totalAmount,
      depositAmount,
      paymentStatus,
      paymentMethod,
      paymentRefNo,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(facilityAmount !== undefined && { facilityAmount: Number(facilityAmount) }),
        ...(discountCode !== undefined && { discountCode }),
        ...(discountPercent !== undefined && { discountPercent: Number(discountPercent) }),
        ...(discountAmount !== undefined && { discountAmount: Number(discountAmount) }),
        ...(discountOverridden !== undefined && { discountOverridden: Boolean(discountOverridden) }),
        ...(discountOverrideReason !== undefined && { discountOverrideReason }),
        ...(selectedServices !== undefined && {
          selectedServices:
            typeof selectedServices === "string"
              ? selectedServices
              : JSON.stringify(selectedServices),
        }),
        ...(servicesAmount !== undefined && { servicesAmount: Number(servicesAmount) }),
        ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
        ...(depositAmount !== undefined && { depositAmount: Number(depositAmount) }),
        ...(paymentStatus && { paymentStatus }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(paymentRefNo !== undefined && { paymentRefNo }),
        ...(notes !== undefined && { notes }),
        lastUpdatedByName: user.name,
      },
      include: {
        facility: true,
      },
    });

    // Record activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "UPDATE_BOOKING",
          details: `Updated booking ${updated.bookingNumber} (${updated.customerName}, Status: ${updated.status}, Total: ₹${updated.totalAmount})`,
          recordId: updated.id,
          recordType: "BOOKING",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, booking: updated });
  } catch (error: any) {
    console.error("Booking PUT error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can delete or cancel bookings." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    // Single-query delete (returns deleted record without needing a prior findUnique query)
    let deletedBooking;
    try {
      deletedBooking = await prisma.booking.delete({
        where: { id },
        select: { id: true, bookingNumber: true, customerName: true },
      });
    } catch (dbErr: any) {
      if (dbErr.code === "P2025") {
        return NextResponse.json({ error: "Booking not found or already deleted" }, { status: 404 });
      }
      throw dbErr;
    }

    // Record activity non-blocking so the delete response is returned to client instantly
    prisma.activityLog
      .create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "CANCEL_BOOKING",
          details: `Cancelled and removed booking record ${deletedBooking.bookingNumber} (${deletedBooking.customerName})`,
          recordId: id,
          recordType: "BOOKING",
        },
      })
      .catch((logErr) => console.error("Activity log non-blocking error:", logErr));

    return NextResponse.json({ success: true, message: "Booking removed" });
  } catch (error: any) {
    console.error("Booking DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
