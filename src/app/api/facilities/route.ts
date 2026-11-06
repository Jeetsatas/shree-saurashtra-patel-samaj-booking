import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin system." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: any = { isActive: true };
    if (type && type !== "ALL") {
      where.type = type;
    }

    const facilities = await prisma.facility.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    return NextResponse.json({ facilities });
  } catch (error: any) {
    console.error("Facilities GET error:", error);
    return NextResponse.json({ error: "Failed to fetch facilities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can create facilities." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      code,
      type,
      resourceGroup,
      capacity,
      floor,
      description,
      amenities,
      photos,
      baseRent,
      weddingRent,
      familyRent,
      cautionDeposit,
      cleaningCharge,
      isRateConfigured,
      bookingDuration,
      availableSlots,
      bookingUnit,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
    }

    const facility = await prisma.facility.create({
      data: {
        name,
        code: code.trim().toUpperCase(),
        type: type || "HALL",
        resourceGroup: resourceGroup || `RESOURCE_${code.trim().toUpperCase()}`,
        capacity: Number(capacity) || 0,
        floor: floor || "",
        description: description || "",
        amenities: amenities || "",
        photos: photos || null,
        baseRent: Number(baseRent) || 0,
        weddingRent: weddingRent !== undefined ? Number(weddingRent) : 0,
        familyRent: familyRent !== undefined ? Number(familyRent) : 0,
        cautionDeposit: Number(cautionDeposit) || 0,
        cleaningCharge: Number(cleaningCharge) || 0,
        isRateConfigured: isRateConfigured ?? (Number(baseRent) > 0 || Number(weddingRent) > 0 || Number(familyRent) > 0),
        bookingDuration: bookingDuration || null,
        availableSlots: availableSlots || null,
        bookingUnit: bookingUnit || "ENTIRE_FACILITY",
        isActive: true,
      },
    });

    return NextResponse.json({ facility, success: true });
  } catch (error: any) {
    console.error("Facility creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create facility" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can modify facility details or rates." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      id,
      name,
      type,
      resourceGroup,
      capacity,
      floor,
      description,
      amenities,
      photos,
      baseRent,
      weddingRent,
      familyRent,
      cautionDeposit,
      cleaningCharge,
      isRateConfigured,
      bookingDuration,
      availableSlots,
      bookingUnit,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 });
    }

    const updated = await prisma.facility.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(resourceGroup !== undefined && { resourceGroup }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(floor !== undefined && { floor }),
        ...(description !== undefined && { description }),
        ...(amenities !== undefined && { amenities }),
        ...(photos !== undefined && { photos }),
        ...(weddingRent !== undefined && { weddingRent: Number(weddingRent) }),
        ...(familyRent !== undefined && { familyRent: Number(familyRent) }),
        ...(baseRent !== undefined && {
          baseRent: Number(baseRent),
          isRateConfigured: Number(baseRent) > 0 || Number(weddingRent) > 0 || Number(familyRent) > 0,
        }),
        ...(cautionDeposit !== undefined && { cautionDeposit: Number(cautionDeposit) }),
        ...(cleaningCharge !== undefined && { cleaningCharge: Number(cleaningCharge) }),
        ...(isRateConfigured !== undefined && { isRateConfigured }),
        ...(bookingDuration !== undefined && { bookingDuration }),
        ...(availableSlots !== undefined && { availableSlots }),
        ...(bookingUnit !== undefined && { bookingUnit }),
        ...(isActive !== undefined && { isActive }),
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
          action: "UPDATE_FACILITY",
          details: `Updated facility ${updated.name} (${updated.code}) — Rates/Details modified`,
          recordId: updated.id,
          recordType: "FACILITY",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ facility: updated, success: true });
  } catch (error: any) {
    console.error("Facility update error:", error);
    return NextResponse.json({ error: "Failed to update facility" }, { status: 500 });
  }
}
