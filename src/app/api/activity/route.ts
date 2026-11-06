import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Immutable Activity / Audit History API
 * Accessible to authenticated administrators to view operations performed in the system.
 * Modifications or deletions are strictly rejected.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin system." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

    const where: any = {};
    if (action && action !== "ALL") {
      where.action = action;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Activity GET error:", error);
    return NextResponse.json({ error: "Failed to fetch activity history" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Activity history is immutable and cannot be created manually." },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Activity history is immutable and cannot be modified." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Activity history is immutable and cannot be deleted." },
    { status: 405 }
  );
}

