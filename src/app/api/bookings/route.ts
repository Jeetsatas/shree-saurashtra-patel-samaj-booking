import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  doSlotsOverlap,
  parseSlotTimeRange,
  doBookingsConflict,
  isFullDaySlot,
  WHOLE_DAY_SLOT_LABEL,
  isGroundFloorHall,
  parseJamaEntries,
  setJamaEntriesInNotes,
} from "@/lib/slotUtils";
import {
  getNextAvailableBookingNumbers,
  executeWithBookingNumberRetry,
} from "@/lib/bookingSequence";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");
    const resourceGroup = searchParams.get("resourceGroup");
    const month = searchParams.get("month"); // 1-12
    const year = searchParams.get("year");
    const status = searchParams.get("status");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

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
    if (status && status !== "ALL") {
      where.status = status;
    }

    if (month && year) {
      // Month-scoped: pad by 2 days on each side to cleanly cover 24-hr checkouts spanning the 1st or last day of the month
      const startWindow = new Date(Number(year), Number(month) - 1, -1, 0, 0, 0);
      const endWindow = new Date(Number(year), Number(month), 2, 23, 59, 59);
      where.startDate = {
        gte: startWindow,
        lte: endWindow,
      };
    } else if (startDateParam || endDateParam) {
      const dateFilter: any = {};
      if (startDateParam) {
        dateFilter.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const endDt = new Date(endDateParam);
        endDt.setHours(23, 59, 59, 999);
        dateFilter.lte = endDt;
      }
      where.startDate = dateFilter;
    }

    const take = limit ? Math.min(Math.max(1, parseInt(limit, 10)), 500) : undefined;
    const skip = offset ? Math.max(0, parseInt(offset, 10)) : undefined;

    const bookings = await withDbRetry(() =>
      prisma.booking.findMany({
        where,
        take,
        skip,
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
      })
    );

    const adminBookings = bookings.map((b) => ({
      ...b,
      facilityName: b.facility?.name || "",
      facilityCode: b.facility?.code || "",
      resourceGroup: b.facility?.resourceGroup || "",
      jamaEntries: parseJamaEntries(b.notes),
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
      groundHallOption,
      jamaEntries,
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
      // 1. Fetch facilities and optional discount rule in parallel
      const [allFacilities, discountRule] = await Promise.all([
        prisma.facility.findMany(),
        discountCode && discountCode !== "NONE" && !discountOverridden
          ? prisma.discountRule.findUnique({ where: { code: discountCode } })
          : Promise.resolve(null),
      ]);
      const facMap = new Map(allFacilities.map((f) => [f.id, f]));
      const currentYear = new Date().getFullYear();

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

      // Precompute in memory: all facility IDs matching target facilities or their resource groups
      // This completely avoids slow SQL joins/subqueries across the Facility table
      const matchingFacilityIds = allFacilities
        .filter(
          (f) =>
            targetFacilityIds.includes(f.id) ||
            (f.resourceGroup && targetGroups.includes(f.resourceGroup))
        )
        .map((f) => f.id);

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
          facilityId: { in: matchingFacilityIds },
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

        // Conflict check against database (RAM precomputed groups, zero joins)
        const dbConflict = activeDbBookings.find((existing) => {
          const facMatches = existing.facilityId === fac.id;
          const existingFac = facMap.get(existing.facilityId);
          const existingGroup = existingFac?.resourceGroup || existingFac?.code;
          const groupMatches = facGroup && existingGroup && facGroup === existingGroup;
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
        const isFull = isFullDaySlot(itSlot);
        if (fac.code === "PLOT-OUTSIDE" || fac.type === "PLOT") {
          const ev = (eventType || "").toLowerCase();
          if (ev.includes("wedding") || ev.includes("lagna") || ev.includes("wedd") || ev.includes("marriage")) {
            itemBaseRent = fac.weddingRent || fac.baseRent || 51000;
          } else {
            itemBaseRent = fac.familyRent || fac.baseRent || 21000;
          }
        } else if (fac.code === "HALL-MULTIPURPOSE") {
          itemBaseRent = isFull ? 31000 : 21000;
        } else if (fac.code === "HALL-GROUND-FLOOR") {
          itemBaseRent = isFull ? 150000 : 100000;
        } else if (fac.code === "DORM-42-BEDS") {
          itemBaseRent = 16000;
        } else if (fac.code === "DORM-28-BEDS") {
          itemBaseRent = 11000;
        } else if (fac.code === "ROOM-8BED-UNIT1") {
          itemBaseRent = 3000;
        } else if (fac.code === "ROOM-6BED") {
          itemBaseRent = 2500;
        } else if (fac.code === "ROOM-8BED-UNIT2") {
          itemBaseRent = 3000;
        }

        if (it.facilityAmount !== undefined && it.facilityAmount !== null && !isNaN(Number(it.facilityAmount)) && Number(it.facilityAmount) > 0) {
          itemBaseRent = Number(it.facilityAmount);
        }

        const itemDiscAmt = (itemBaseRent * discPct) / 100;
        const isFirstItem = i === 0;
        const itemServCost = isFirstItem ? Number(servicesAmount) || 0 : 0;

        const hasMajorFac = items.some((itItem: any) => {
          const f = facMap.get(itItem.facilityId);
          const c = f?.code || "";
          return c === "PLOT-OUTSIDE" || c === "HALL-GROUND-FLOOR" || c === "HALL-MULTIPURPOSE" || c.startsWith("DORM");
        });
        const eventDeposit = hasMajorFac ? 25000 : (depositAmount !== undefined ? Number(depositAmount) : (fac.cautionDeposit || 0));
        const itemDeposit = isFirstItem ? eventDeposit : 0;
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
          groundHallOption: it.groundHallOption,
        });
      }

      // 4. Create all bookings in a single ultra-fast bulk insert with collision-proof sequence allocation
      const createdBookings = await executeWithBookingNumberRetry(
        async (bookingNumbers) => {
          const insertData = preparedItems.map((item, idx) => {
            const fac = facMap.get(item.facilityId);
            const isGround = isGroundFloorHall(fac);
            let itemNotes = notes || "";
            let itemServices: any[] = [];
            try {
              if (selectedServices) {
                itemServices = typeof selectedServices === "string" ? JSON.parse(selectedServices) : [...selectedServices];
              }
            } catch {
              itemServices = [];
            }

            if (isGround) {
              const opt = item.groundHallOption === "AC" ? "AC" : "Non-AC";
              const tag = `[Ground Floor Hall: ${opt}]`;
              if (!itemNotes.includes(tag)) {
                itemNotes = itemNotes ? `${tag} ${itemNotes}` : tag;
              }
              const sCode = opt === "AC" ? "HALL_OPTION_AC" : "HALL_OPTION_NON_AC";
              const sName = opt === "AC" ? "Ground Floor Hall (AC)" : "Ground Floor Hall (Non-AC)";
              if (!itemServices.some((s: any) => s.code === sCode)) {
                itemServices.push({ code: sCode, name: sName, price: 0 });
              }
            }

            return {
              bookingNumber: bookingNumbers[idx],
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
              selectedServices: itemServices.length > 0 ? JSON.stringify(itemServices) : null,
              servicesAmount: item.servicesAmount,
              totalAmount: item.totalAmount,
              depositAmount: item.depositAmount,
              paymentStatus: paymentStatus || "PENDING",
              paymentMethod: paymentMethod || "OFFLINE_CASH",
              paymentRefNo: paymentRefNo || null,
              notes: itemNotes || null,
              bookedByUserId: user.id,
              createdByName: user.name,
              lastUpdatedByName: user.name,
            };
          });

          try {
            // PostgreSQL native single-query bulk insert returning all created rows (1 network round-trip)
            const bulkCreated = await prisma.booking.createManyAndReturn({
              data: insertData,
            });
            return bulkCreated.map((b) => ({
              ...b,
              facility: facMap.get(b.facilityId) || null,
            }));
          } catch (bulkErr) {
            // Fallback for environments without createManyAndReturn
            const createOperations = insertData.map((data) =>
              prisma.booking.create({
                data,
                include: { facility: true },
              })
            );
            return await prisma.$transaction(createOperations);
          }
        },
        preparedItems.length,
        currentYear
      );

      // 5. Fire-and-forget non-blocking audit logging using createMany
      // Executes asynchronously in the background so the HTTP response returns immediately
      prisma.activityLog
        .createMany({
          data: createdBookings.map((created, idx) => ({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            action: "CREATE_BOOKING",
            details: `Created batch booking ${created.bookingNumber} (${idx + 1}/${createdBookings.length}) for ${created.customerName} (${created.eventType}) at ${created.facility?.name || facMap.get(created.facilityId)?.name || "Facility"}`,
            recordId: created.id,
            recordType: "BOOKING",
          })),
        })
        .catch((err) => console.error("Batch activity log error:", err));

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

    // 1. Fetch Target Facility and optional Discount Rule in parallel
    const [targetFacility, discountRule] = await Promise.all([
      prisma.facility.findUnique({
        where: { id: facilityId },
      }),
      discountCode && discountCode !== "NONE" && !discountOverridden
        ? prisma.discountRule.findUnique({ where: { code: discountCode } })
        : Promise.resolve(null),
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

    // Generate unique booking number using collision-proof allocator with automatic retry
    const currentYear = new Date().getFullYear();
    const isGroundSingle = isGroundFloorHall(targetFacility);
    let singleNotes = notes || "";
    let singleServices: any[] = [];
    try {
      if (selectedServices) {
        singleServices = typeof selectedServices === "string" ? JSON.parse(selectedServices) : [...selectedServices];
      }
    } catch {
      singleServices = [];
    }

    if (isGroundSingle) {
      const opt = body.groundHallOption === "AC" ? "AC" : "Non-AC";
      const tag = `[Ground Floor Hall: ${opt}]`;
      if (!singleNotes.includes(tag)) {
        singleNotes = singleNotes ? `${tag} ${singleNotes}` : tag;
      }
      const sCode = opt === "AC" ? "HALL_OPTION_AC" : "HALL_OPTION_NON_AC";
      const sName = opt === "AC" ? "Ground Floor Hall (AC)" : "Ground Floor Hall (Non-AC)";
      if (!singleServices.some((s: any) => s.code === sCode)) {
        singleServices.push({ code: sCode, name: sName, price: 0 });
      }
    }

    const newBooking = await executeWithBookingNumberRetry(
      async ([bookingNumber]) => {
        return await prisma.booking.create({
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
            selectedServices: singleServices.length > 0 ? JSON.stringify(singleServices) : null,
            servicesAmount: finalServicesCost,
            totalAmount: finalTotalAmount,
            depositAmount: Number(depositAmount ?? targetFacility.cautionDeposit) || 0,
            paymentStatus: paymentStatus || "PENDING",
            paymentMethod: paymentMethod || "OFFLINE_CASH",
            paymentRefNo: paymentRefNo || null,
            notes: singleNotes || null,
            bookedByUserId: user.id,
            createdByName: user.name,
            lastUpdatedByName: user.name,
          },
          include: {
            facility: true,
          },
        });
      },
      1,
      currentYear
    );

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
      ids,
      updateAllRelated,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerAadhar,
      eventType,
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
      groundHallOption,
      jamaEntries,
    } = body;

    let targetIds: string[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids.filter((item: any) => typeof item === "string" && item.trim().length > 0);
    } else if (id && typeof id === "string") {
      targetIds = [id.trim()];
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Booking ID or IDs list is required" }, { status: 400 });
    }

    if (customerName !== undefined && !customerName.trim()) {
      return NextResponse.json({ error: "અરજદાર / પાર્ટીનું નામ જરૂરી છે (Party name is required)" }, { status: 400 });
    }

    if (customerPhone !== undefined && !customerPhone.trim()) {
      return NextResponse.json({ error: "સંપર્ક નંબર જરૂરી છે (Contact phone is required)" }, { status: 400 });
    }

    // Smart auto-detection: If updateAllRelated is requested, include all other bookings by this same customer/phone
    if (updateAllRelated && targetIds.length > 0) {
      const baseBooking = await prisma.booking.findUnique({
        where: { id: targetIds[0] },
        select: { customerPhone: true, customerName: true },
      });
      if (baseBooking) {
        const related = await prisma.booking.findMany({
          where: {
            OR: [
              ...(baseBooking.customerPhone ? [{ customerPhone: baseBooking.customerPhone }] : []),
              ...(baseBooking.customerName ? [{ customerName: baseBooking.customerName }] : []),
            ],
          },
          select: { id: true },
        });
        targetIds = Array.from(new Set([...targetIds, ...related.map((r) => r.id)]));
      }
    }

    const updateData: any = {
      ...(customerName !== undefined && { customerName: customerName.trim() }),
      ...(customerPhone !== undefined && { customerPhone: customerPhone.trim() }),
      ...(customerEmail !== undefined && { customerEmail: customerEmail?.trim() || null }),
      ...(customerAddress !== undefined && { customerAddress: customerAddress?.trim() || null }),
      ...(customerAadhar !== undefined && { customerAadhar: customerAadhar?.trim() || null }),
      ...(eventType !== undefined && { eventType: eventType.trim() }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(paymentRefNo !== undefined && { paymentRefNo }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      lastUpdatedByName: user.name,
    };

    // If updating a single booking, allow tariff and slot fields as well
    if (targetIds.length === 1) {
      if (slot) updateData.slot = slot.trim();
      if (facilityAmount !== undefined) updateData.facilityAmount = Number(facilityAmount);
      if (discountCode !== undefined) updateData.discountCode = discountCode;
      if (discountPercent !== undefined) updateData.discountPercent = Number(discountPercent);
      if (discountAmount !== undefined) updateData.discountAmount = Number(discountAmount);
      if (discountOverridden !== undefined) updateData.discountOverridden = Boolean(discountOverridden);
      if (discountOverrideReason !== undefined) updateData.discountOverrideReason = discountOverrideReason;
      if (selectedServices !== undefined) {
        updateData.selectedServices =
          typeof selectedServices === "string" ? selectedServices : JSON.stringify(selectedServices);
      }
      if (servicesAmount !== undefined) updateData.servicesAmount = Number(servicesAmount);
      if (totalAmount !== undefined) updateData.totalAmount = Number(totalAmount);
      if (depositAmount !== undefined) updateData.depositAmount = Number(depositAmount);
    }

    // If groundHallOption is provided, update notes and selectedServices for Ground Floor Hall bookings
    if (groundHallOption === "AC" || groundHallOption === "NON_AC") {
      const optLabel = groundHallOption === "AC" ? "AC" : "Non-AC";
      const newTag = `[Ground Floor Hall: ${optLabel}]`;
      const sCode = groundHallOption === "AC" ? "HALL_OPTION_AC" : "HALL_OPTION_NON_AC";
      const sName = groundHallOption === "AC" ? "Ground Floor Hall (AC)" : "Ground Floor Hall (Non-AC)";

      const targetBookings = await prisma.booking.findMany({
        where: { id: { in: targetIds } },
        include: { facility: true },
      });

      for (const tb of targetBookings) {
        if (isGroundFloorHall(tb.facility)) {
          let bNotes = (notes !== undefined ? (notes?.trim() || "") : (tb.notes || ""))
            .replace(/\[Ground Floor Hall: (AC|Non-AC)\]/g, "")
            .trim();
          bNotes = bNotes ? `${newTag} ${bNotes}` : newTag;

          let bServices: any[] = [];
          try {
            if (tb.selectedServices) {
              bServices = JSON.parse(tb.selectedServices);
            }
          } catch {}
          bServices = bServices.filter((s: any) => s.code !== "HALL_OPTION_AC" && s.code !== "HALL_OPTION_NON_AC");
          bServices.push({ code: sCode, name: sName, price: 0 });

          await prisma.booking.update({
            where: { id: tb.id },
            data: {
              notes: bNotes,
              selectedServices: JSON.stringify(bServices),
            },
          });
        }
      }

      if (updateData.notes !== undefined) {
        delete updateData.notes;
      }
    }

    // Handle Jama Entries (જમા ખાતાવહી) updates across target bookings
    if (Array.isArray(jamaEntries)) {
      const targetBookings = await prisma.booking.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, notes: true, totalAmount: true, depositAmount: true },
      });

      const totalJama = jamaEntries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

      for (const tb of targetBookings) {
        const updatedNotes = setJamaEntriesInNotes(tb.notes, jamaEntries);
        await prisma.booking.update({
          where: { id: tb.id },
          data: {
            notes: updatedNotes,
            lastUpdatedByName: user.name,
          },
        });
      }

      if (!paymentStatus) {
        const isFullyPaid = body.isFullPaid || false;
        updateData.paymentStatus = isFullyPaid ? "PAID" : totalJama > 0 ? "PARTIAL" : "PENDING";
        const lastEntry = jamaEntries[jamaEntries.length - 1];
        if (lastEntry?.method) {
          updateData.paymentMethod = lastEntry.method;
        }
        if (lastEntry?.refNo) {
          updateData.paymentRefNo = lastEntry.refNo;
        }
      }

      delete updateData.notes;
    } else if (notes !== undefined && targetIds.length > 0) {
      // If updating plain notes, preserve any existing Jama entries tag
      const existing = await prisma.booking.findUnique({
        where: { id: targetIds[0] },
        select: { notes: true },
      });
      const existingJama = parseJamaEntries(existing?.notes);
      if (existingJama.length > 0) {
        updateData.notes = setJamaEntriesInNotes(notes, existingJama);
      }
    }

    // Execute atomic batch update across all target bookings
    await withDbRetry(() =>
      prisma.booking.updateMany({
        where: { id: { in: targetIds } },
        data: updateData,
      })
    );

    // Fetch the updated bookings to return
    const updatedBookings = await withDbRetry(() =>
      prisma.booking.findMany({
        where: { id: { in: targetIds } },
        include: {
          facility: true,
        },
      })
    );

    // Record activity log
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "UPDATE_BOOKING",
          details: `Updated ${targetIds.length} booking(s) for ${customerName || updatedBookings[0]?.customerName} (${updatedBookings.map((b) => b.bookingNumber).join(", ")})`,
          recordId: targetIds[0],
          recordType: "BOOKING",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({
      success: true,
      booking: updatedBookings[0],
      bookings: updatedBookings,
      count: updatedBookings.length,
      updatedIds: targetIds,
    });
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
