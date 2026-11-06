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

    const discounts = await prisma.discountRule.findMany({
      orderBy: { percentage: "desc" },
    });
    return NextResponse.json({ discounts });
  } catch (error: any) {
    console.error("Discounts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch discounts" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, percentage, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Discount rule ID required" }, { status: 400 });
    }

    const updated = await prisma.discountRule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(percentage !== undefined && { percentage: Number(percentage) }),
        ...(description !== undefined && { description }),
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
          action: "UPDATE_DISCOUNT",
          details: `Updated discount rule ${updated.name} (${updated.percentage}%)`,
          recordId: updated.id,
          recordType: "DISCOUNT",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, discount: updated });
  } catch (error: any) {
    console.error("Discounts PUT error:", error);
    return NextResponse.json({ error: "Failed to update discount rule" }, { status: 500 });
  }
}

