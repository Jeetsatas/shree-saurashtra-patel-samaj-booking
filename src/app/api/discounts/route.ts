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
    return NextResponse.json(
      { discounts },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Discounts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch discounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { name, percentage, description, code, isActive } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Discount rule name is required" }, { status: 400 });
    }

    const parsedPercentage = Number(percentage);
    if (isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
      return NextResponse.json({ error: "Percentage must be between 0 and 100" }, { status: 400 });
    }

    // Generate or sanitize code
    let finalCode = (code || name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    if (!finalCode) {
      finalCode = `DISCOUNT_${Date.now()}`;
    }

    // Check if code exists; if so, append random suffix
    const existing = await prisma.discountRule.findUnique({
      where: { code: finalCode },
    });
    if (existing) {
      finalCode = `${finalCode}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const newDiscount = await prisma.discountRule.create({
      data: {
        code: finalCode,
        name: name.trim(),
        percentage: parsedPercentage,
        description: description?.trim() || null,
        isActive: isActive !== false,
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
          action: "CREATE_DISCOUNT",
          details: `Created new discount rule ${newDiscount.name} (${newDiscount.percentage}%, Code: ${newDiscount.code})`,
          recordId: newDiscount.id,
          recordType: "DISCOUNT",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, discount: newDiscount }, { status: 201 });
  } catch (error: any) {
    console.error("Discounts POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create discount rule" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, code, percentage, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Discount rule ID required" }, { status: 400 });
    }

    // Check code uniqueness if code changed
    if (code) {
      const sanitizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
      const existing = await prisma.discountRule.findFirst({
        where: { code: sanitizedCode, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: `Rule code '${sanitizedCode}' is already in use.` }, { status: 400 });
      }
    }

    const updated = await prisma.discountRule.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_") }),
        ...(percentage !== undefined && { percentage: Number(percentage) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
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
    return NextResponse.json({ error: error.message || "Failed to update discount rule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Discount rule ID required" }, { status: 400 });
    }

    const target = await prisma.discountRule.findUnique({
      where: { id },
    });

    if (!target) {
      return NextResponse.json({ error: "Discount rule not found" }, { status: 404 });
    }

    await prisma.discountRule.delete({
      where: { id },
    });

    // Record activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "DELETE_DISCOUNT",
          details: `Deleted discount rule ${target.name} (${target.code}, ${target.percentage}%)`,
          recordId: target.id,
          recordType: "DISCOUNT",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, message: "Discount rule deleted successfully" });
  } catch (error: any) {
    console.error("Discounts DELETE error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete discount rule" }, { status: 500 });
  }
}
