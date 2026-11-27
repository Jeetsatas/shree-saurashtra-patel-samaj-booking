import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendFeedbackEmailNotification } from "@/lib/feedbackNotifier";

export const dynamic = "force-dynamic";

export interface FeedbackDetail {
  title: string;
  description: string;
  category: "FEATURE_REQUEST" | "APP_IMPROVEMENT" | "BUG_REPORT" | "GENERAL_FEEDBACK";
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
  deviceInfo?: string;
  resolutionNotes?: string;
  updatedAt?: string;
}

export interface FeedbackItem {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  category: "FEATURE_REQUEST" | "APP_IMPROVEMENT" | "BUG_REPORT" | "GENERAL_FEEDBACK";
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
  userName: string;
  userEmail: string;
  userRole: string;
  deviceInfo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * GET /api/feedback
 * Fetch all submitted feedback and feature suggestions
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin access only." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const logs = await prisma.activityLog.findMany({
      where: {
        action: "APP_FEEDBACK",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const feedbacks: FeedbackItem[] = logs.map((log) => {
      let parsed: Partial<FeedbackDetail> = {};
      try {
        if (log.details) {
          parsed = JSON.parse(log.details);
        }
      } catch {
        parsed = {
          title: "સૂચન વિગત",
          description: log.details || "",
          category: "APP_IMPROVEMENT",
          priority: "MEDIUM",
          status: "NEW",
        };
      }

      return {
        id: log.id,
        ticketNo: log.recordId || `FB-${log.id.slice(-6).toUpperCase()}`,
        title: parsed.title || "સૂચન",
        description: parsed.description || log.details || "",
        category: parsed.category || "APP_IMPROVEMENT",
        priority: parsed.priority || "MEDIUM",
        status: parsed.status || "NEW",
        userName: log.userName || "Admin Trustee",
        userEmail: log.userEmail || "",
        userRole: log.userRole || "ADMIN",
        deviceInfo: parsed.deviceInfo,
        resolutionNotes: parsed.resolutionNotes,
        createdAt: log.createdAt.toISOString(),
        updatedAt: parsed.updatedAt || log.createdAt.toISOString(),
      };
    });

    // Filter in-memory if query parameters provided
    let filtered = feedbacks;
    if (category && category !== "ALL") {
      filtered = filtered.filter((f) => f.category === category);
    }
    if (status && status !== "ALL") {
      filtered = filtered.filter((f) => f.status === status);
    }

    return NextResponse.json({ feedbacks: filtered, total: filtered.length });
  } catch (error: any) {
    console.error("Feedback GET error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback entries" }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Submit a new feedback or feature request
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin access only." }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, priority, deviceInfo } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "સૂચનનો વિષય (Title) લખવો ફરજિયાત છે." }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "સૂચનનું વિગતવાર વર્ણન (Description) લખવું ફરજિયાત છે." }, { status: 400 });
    }

    const ticketNo = `FB-${Date.now().toString(36).toUpperCase()}`;
    const detailPayload: FeedbackDetail = {
      title: title.trim(),
      description: description.trim(),
      category: category || "APP_IMPROVEMENT",
      priority: priority || "MEDIUM",
      status: "NEW",
      deviceInfo: deviceInfo || "Trustee Web Portal",
      resolutionNotes: "",
      updatedAt: new Date().toISOString(),
    };

    const newLog = await prisma.activityLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "APP_FEEDBACK",
        recordId: ticketNo,
        recordType: "FEEDBACK",
        details: JSON.stringify(detailPayload),
      },
    });

    // Automatically notify jeetsatasiya993@gmail.com via email
    let emailResult = { success: false, recipient: "jeetsatasiya993@gmail.com" };
    try {
      emailResult = await sendFeedbackEmailNotification({
        ticketNo,
        title: detailPayload.title,
        description: detailPayload.description,
        category: detailPayload.category,
        priority: detailPayload.priority,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        deviceInfo: detailPayload.deviceInfo,
        createdAt: newLog.createdAt.toISOString(),
      });
    } catch (emailErr) {
      console.error("Email notification dispatch error:", emailErr);
    }

    return NextResponse.json({
      success: true,
      ticketNo,
      emailNotified: emailResult.success,
      emailRecipient: emailResult.recipient,
      feedback: {
        id: newLog.id,
        ticketNo,
        ...detailPayload,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        createdAt: newLog.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Feedback POST error:", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}

/**
 * PATCH /api/feedback
 * Update feedback status and resolution notes (Trustee / Super Admin)
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, resolutionNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing feedback id" }, { status: 400 });
    }

    const existing = await prisma.activityLog.findUnique({
      where: { id },
    });

    if (!existing || existing.action !== "APP_FEEDBACK") {
      return NextResponse.json({ error: "Feedback entry not found" }, { status: 404 });
    }

    let parsed: Partial<FeedbackDetail> = {};
    try {
      if (existing.details) parsed = JSON.parse(existing.details);
    } catch {
      parsed = { title: "સૂચન", description: existing.details || "" };
    }

    if (status) parsed.status = status;
    if (resolutionNotes !== undefined) parsed.resolutionNotes = resolutionNotes;
    parsed.updatedAt = new Date().toISOString();

    await prisma.activityLog.update({
      where: { id },
      data: {
        details: JSON.stringify(parsed),
      },
    });

    return NextResponse.json({ success: true, updated: parsed });
  } catch (error: any) {
    console.error("Feedback PATCH error:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback
 * Remove a feedback ticket (Super Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admin can delete feedback" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    await prisma.activityLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("Feedback DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
}
