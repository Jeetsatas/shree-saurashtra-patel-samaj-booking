import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin system." }, { status: 401 });
    }

    const services = await prisma.addonService.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ services });
  } catch (error: any) {
    console.error("Services GET error:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can configure additional services." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, description, price, isRateConfigured, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Service ID required" }, { status: 400 });
    }

    const updated = await prisma.addonService.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && {
          price: Number(price),
          isRateConfigured: Number(price) > 0,
        }),
        ...(isRateConfigured !== undefined && { isRateConfigured }),
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
          action: "UPDATE_SERVICE",
          details: `Updated service ${updated.name} (Rate: ₹${updated.price})`,
          recordId: updated.id,
          recordType: "SERVICE",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, service: updated });
  } catch (error: any) {
    console.error("Service PUT error:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

