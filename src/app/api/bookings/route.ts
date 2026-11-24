import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  doSlotsOverlap,
  parseSlotTimeRange,
  doBookingsConflict,
  isFullDaySlot,
  WHOLE_DAY_SLOT_LABEL,
} from "@/lib/slotUtils";

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

    return NextResponse.json(
      { bookings: adminBookings, isAdmin: true, role: user.role },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
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
      items, // Optional array for multi-facility / multi-date / multi-slot batch creation!
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

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { error: "Applicant name and phone number are required." },
        { status: 400 }
      );
    }

    // =========================================================================
    // BRANCH A: MULTI-FACILITY / MULTI-DATE / MULTI-TIMING BATCH CREATION
    // =========================================================================
    if (items && Array.isArray(items) && items.length > 0) {
      // 1. Fetch facilities, discount rule, and latest booking number in parallel
      const [allFacilities, discountRule, latestBooking] = await Promise.all([
        prisma.facility.findMany(),
        discountCode && discountCode !== "NONE" && !discountOverridden
          ? prisma.discountRule.findUnique({ where: { code: discountCode } })
          : Promise.resolve(null),
        prisma.booking.findFirst({
          orderBy: { createdAt: "desc" },
          select: { bookingNumber: true },
        }),
      ]);
      const facMap = new Map(allFacilities.map((f) => [f.id, f]));

      const currentYear = new Date().getFullYear();
      let nextSeq = 1;
      if (latestBooking?.bookingNumber) {
        const match = latestBooking.bookingNumber.match(/SSPS-\d{4}-(\d+)/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      // 2. Fetch active bookings for conflict checking (scoped by facility/group and bounded date range)
      const targetFacilityIds = Array.from(new Set(items.map((it: any) => it.facilityId)));
      const targetGroups = Array.from(
        new Set(
          targetFacilityIds.map((id) => {
            const f = facMap.get(id);
            return f?.resourceGroup || f?.code || id;
          })
        )
      );

      // Calculate bounded date range for index-optimized conflict query
      let minStartMs = Infinity;
      let maxEndMs = -Infinity;
      for (const it of items) {
        const sTime = new Date(it.startDate).getTime();
        if (!isNaN(sTime)) {
          if (sTime < minStartMs) minStartMs = sTime;
          const eTime = it.endDate ? new Date(it.endDate).getTime() : sTime + 86400000;
          if (eTime > maxEndMs) maxEndMs = eTime;
        }
      }

      const boundStartDate = isFinite(minStartMs) ? new Date(minStartMs - 36 * 3600 * 1000) : undefined;
      const boundEndDate = isFinite(maxEndMs) ? new Date(maxEndMs + 36 * 3600 * 1000) : undefined;

      const activeDbBookings = await prisma.booking.findMany({
        where: {
          facility: {
            OR: [
              { id: { in: targetFacilityIds } },
              { resourceGroup: { in: targetGroups } },
            ],
          },
          status: { in: ["CONFIRMED", "BLOCKED_BY_TRUST"] },
          ...(boundStartDate && boundEndDate
            ? {
                startDate: { lte: boundEndDate },
                endDate: { gte: boundStartDate },
              }
            : {}),
        },
        select: {
          id: true,
          facilityId: true,
          slot: true,
          startDate: true,
          endDate: true,
          customerName: true,
          facility: { select: { id: true, name: true, code: true, resourceGroup: true } },
        },
      });

      // 3. Validate every item for facility existence and conflicts
      const preparedItems: any[] = [];
      const discPct = discountRule ? discountRule.percentage : Number(discountPercent) || 0;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const fac = facMap.get(it.facilityId);
        if (!fac) {
          return NextResponse.json(
            { error: `Facility with ID ${it.facilityId} not found.` },
            { status: 404 }
          );
        }

        const itStart = new Date(it.startDate);
        const itSlot = (it.slot || WHOLE_DAY_SLOT_LABEL).trim();
        let itEnd = new Date(it.endDate || it.startDate);
        if (isFullDaySlot(itSlot)) {
          itEnd = new Date(itStart.getTime() + 86400000);
        }

        const facGroup = fac.resourceGroup || fac.code;

        // Conflict check against database
        const dbConflict = activeDbBookings.find((existing) => {
          const facMatches = existing.facilityId === fac.id;
          const groupMatches =
            facGroup &&
            (existing.facility?.resourceGroup === facGroup || existing.facility?.code === facGroup);
          if (!facMatches && !groupMatches) return false;

          return doBookingsConflict(
            { startDate: existing.startDate, slot: existing.slot },
            { startDate: itStart, slot: itSlot }
          );
        });

        if (dbConflict) {
          return NextResponse.json(
            {
              error: `સમય ટકરાવ (Time Conflict): ${fac.name} [${new Date(it.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${itSlot}] માટે પહેલેથી બુક થયેલ છે (${dbConflict.customerName}).`,
            },
            { status: 409 }
          );
        }

        // Conflict check against previous items in the same batch
        const batchConflict = preparedItems.find((prev) => {
          const facMatches = prev.facilityId === fac.id;
          const prevFac = facMap.get(prev.facilityId);
          const prevGroup = prevFac?.resourceGroup || prevFac?.code;
          const groupMatches = facGroup && prevGroup && facGroup === prevGroup;
          if (!facMatches && !groupMatches) return false;

          return doBookingsConflict(
            { startDate: prev.startDate, slot: prev.slot },
            { startDate: itStart, slot: itSlot }
          );
        });

        if (batchConflict) {
          return NextResponse.json(
            {
              error: `આ જ બુકિંગમાં ટકરાવ: ${fac.name} [${new Date(it.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${itSlot}] બે વાર પસંદ થયેલ છે.`,
            },
            { status: 409 }
          );
        }

        // Calculate item pricing
        let itemBaseRent = fac.baseRent || 0;
        if (fac.code === "PLOT-OUTSIDE" || fac.type === "PLOT") {
          const ev = (eventType || "").toLowerCase();
          if (ev.includes("wedding") || ev.includes("lagna") || ev.includes("wedd")) {
            itemBaseRent = fac.weddingRent || fac.baseRent || 0;
          } else {
            itemBaseRent = fac.familyRent || fac.baseRent || 0;
          }
        }
        if (it.facilityAmount !== undefined && it.facilityAmount !== null && !isNaN(Number(it.facilityAmount))) {
          itemBaseRent = Number(it.facilityAmount);
        }

        const itemDiscAmt = (itemBaseRent * discPct) / 100;
        const isFirstItem = i === 0;
        const itemServCost = isFirstItem ? Number(servicesAmount) || 0 : 0;
        const itemDeposit = Number(it.depositAmount ?? fac.cautionDeposit) || 0;
        const itemTotal = Math.max(0, itemBaseRent - itemDiscAmt) + itemServCost;

        preparedItems.push({
          facilityId: fac.id,
          facilityName: fac.name,
          startDate: itStart,
          endDate: itEnd,
          slot: itSlot,
          facilityAmount: itemBaseRent,
          discountAmount: itemDiscAmt,
          servicesAmount: itemServCost,
          depositAmount: itemDeposit,
          totalAmount: itemTotal,
        });
      }

      // 4. Create all bookings in a SINGLE atomic database transaction (Pipeline Batch)
      const createOperations = preparedItems.map((item, idx) => {
        const bookingNum = `SSPS-${currentYear}-${String(nextSeq + idx).padStart(4, "0")}`;
        return prisma.booking.create({
          data: {
            bookingNumber: bookingNum,
            facilityId: item.facilityId,
            customerName,
            customerPhone,
            customerEmail: customerEmail || null,
            customerAddress: customerAddress || null,
            customerAadhar: customerAadhar || null,
            eventType: eventType || "General Function",
            startDate: item.startDate,
            endDate: item.endDate,
            slot: item.slot,
            status: status || "CONFIRMED",
            facilityAmount: item.facilityAmount,
            discountCode: discountCode || null,
            discountPercent: discPct,
            discountAmount: item.discountAmount,
            discountOverridden: !!discountOverridden,
            discountOverrideReason: discountOverrideReason || null,
            selectedServices: selectedServices ? JSON.stringify(selectedServices) : null,
            servicesAmount: item.servicesAmount,
            totalAmount: item.totalAmount,
            depositAmount: item.depositAmount,
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
      });

      const createdBookings = await prisma.$transaction(createOperations);

      // 5. Fire-and-forget non-blocking audit logging using Promise.allSettled
      // Executes asynchronously in the background so the HTTP response returns immediately
      Promise.allSettled(
        createdBookings.map((created, idx) =>
          prisma.activityLog.create({
            data: {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              userRole: user.role,
              action: "CREATE_BOOKING",
              details: `Created batch booking ${created.bookingNumber} (${idx + 1}/${createdBookings.length}) for ${created.customerName} (${created.eventType}) at ${created.facility?.name || "Facility"}`,
              recordId: created.id,
              recordType: "BOOKING",
            },
          })
        )
      ).catch((err) => console.error("Batch activity log error:", err));

      return NextResponse.json({
        success: true,
        bookings: createdBookings,
        booking: createdBookings[0],
        count: createdBookings.length,
      });
    }

    // =========================================================================
    // BRANCH B: SINGLE BOOKING CREATION (LEGACY FALLBACK)
    // =========================================================================
    if (!facilityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Required fields missing: facility, customer name, phone, dates" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    let end = new Date(endDate);
    const requestedSlot = (slot || WHOLE_DAY_SLOT_LABEL).trim();

    if (isFullDaySlot(requestedSlot)) {
      // Ensure checkout is next day
      end = new Date(start.getTime() + 86400000);
    }

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
        endDate: { gte: new Date(start.getTime() - 86400000) },
      },
      select: {
        id: true,
        slot: true,
        startDate: true,
        endDate: true,
        facility: { select: { name: true, code: true, resourceGroup: true } },
      },
    });

    // Check if slots overlap using exact timestamp ranges
    const conflictingBooking = activeConflicts.find((existing) =>
      doBookingsConflict(
        { startDate: existing.startDate, slot: existing.slot },
        { startDate: start, slot: requestedSlot }
      )
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
      slot,
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
        ...(slot && { slot: slot.trim() }),
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
    let idsToDelete: string[] = [];

    // 1. Try reading JSON body if available ({ ids: string[] } or { id: string })
    try {
      const body = await req.json();
      if (body?.ids && Array.isArray(body.ids)) {
        idsToDelete = body.ids.map((x: any) => String(x).trim()).filter(Boolean);
      } else if (body?.id) {
        idsToDelete = [String(body.id).trim()];
      }
    } catch {
      // Body not present or not JSON, fallback to query parameters
    }

    // 2. Fallback to URL search parameters (?ids=id1,id2 or ?id=id1)
    if (idsToDelete.length === 0) {
      const idsParam = searchParams.get("ids");
      const idParam = searchParams.get("id");
      if (idsParam) {
        idsToDelete = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (idParam) {
        idsToDelete = [idParam.trim()];
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "Booking ID(s) required" }, { status: 400 });
    }

    // Fetch details for activity logging
    const targetBookings = await prisma.booking.findMany({
      where: { id: { in: idsToDelete } },
      select: { id: true, bookingNumber: true, customerName: true },
    });

    if (targetBookings.length === 0) {
      return NextResponse.json(
        { error: "Booking(s) not found or already deleted" },
        { status: 404 }
      );
    }

    // Batch delete records
    await prisma.booking.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    // Record activity non-blocking
    const summaryList = targetBookings
      .map((b) => `${b.bookingNumber} (${b.customerName})`)
      .join(", ");
    prisma.activityLog
      .create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "CANCEL_BOOKING",
          details: `Cancelled and removed ${targetBookings.length} booking record(s): ${summaryList.slice(
            0,
            450
          )}`,
          recordId: idsToDelete[0],
          recordType: "BOOKING",
        },
      })
      .catch((logErr) => console.error("Activity log error:", logErr));

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${targetBookings.length} booking(s)`,
      count: targetBookings.length,
    });
  } catch (error: any) {
    console.error("Booking DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete booking(s)" }, { status: 500 });
  }
}
