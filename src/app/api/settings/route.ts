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

    const settings = await prisma.trustSetting.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { trustName, address, phone, email, officeHours, gstNumber, trustRegNo, rules } = body;

    const updated = await prisma.trustSetting.upsert({
      where: { id: "default" },
      update: {
        trustName,
        address,
        phone,
        email,
        officeHours,
        gstNumber,
        trustRegNo,
        rules,
      },
      create: {
        id: "default",
        trustName,
        address,
        phone,
        email,
        officeHours,
        gstNumber,
        trustRegNo,
        rules,
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
          action: "UPDATE_SETTING",
          details: `Updated trust settings and niyamavali`,
          recordId: "default",
          recordType: "SETTING",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

