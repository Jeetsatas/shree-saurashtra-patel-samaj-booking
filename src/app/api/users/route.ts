import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin system." }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        canExport: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users, isSuperAdmin: user.role === "SUPER_ADMIN" });
  } catch (error: any) {
    console.error("Users GET error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can manage administrator accounts." },
        { status: 403 }
      );
    }

    // Fixed 3-admin architecture rule
    const currentCount = await prisma.user.count();
    if (currentCount >= 3) {
      return NextResponse.json(
        { error: "The system is strictly designed for exactly three administrators. Please edit existing accounts instead." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, email, password, role, phone, canExport } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "VIEW_ONLY_ADMIN",
        canExport: role === "SUPER_ADMIN" ? true : !!canExport,
        phone: phone || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        canExport: true,
        isActive: true,
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
          action: "CREATE_ADMIN_USER",
          details: `Provisioned administrator account ${newUser.email} (${newUser.role})`,
          recordId: newUser.id,
          recordType: "USER",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error("User POST error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: View-only administrators cannot modify administrator accounts or reset passwords." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, password, role, phone, canExport, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (role && targetUser.email !== "jnpatel@patelsamaj.com" && targetUser.email !== "superadmin@patelsamaj.com") {
      dataToUpdate.role = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "VIEW_ONLY_ADMIN";
    }
    if (canExport !== undefined) dataToUpdate.canExport = Boolean(canExport);
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    
    let passwordChanged = false;
    if (password && password.trim().length > 0) {
      dataToUpdate.passwordHash = await hashPassword(password);
      passwordChanged = true;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        canExport: true,
        isActive: true,
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
          action: passwordChanged ? "RESET_ADMIN_PASSWORD" : "UPDATE_ADMIN_ACCESS",
          details: passwordChanged
            ? `Reset password for administrator ${updated.email}`
            : `Updated access permissions for administrator ${updated.email} (Role: ${updated.role}, canExport: ${updated.canExport})`,
          recordId: updated.id,
          recordType: "USER",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
