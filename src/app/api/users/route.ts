import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Private admin system." }, { status: 401 });
    }

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can access administrator accounts." },
        { status: 403 }
      );
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

    return NextResponse.json({ users, isSuperAdmin: true });
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
        { error: "Forbidden: Only the Super Admin can create administrator accounts." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, role, phone, canExport } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Administrator name is required" }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Username / Login email is required" }, { status: 400 });
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existing) {
      return NextResponse.json({ error: "An administrator with this email/username already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: sanitizedEmail,
        passwordHash,
        role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "VIEW_ONLY_ADMIN",
        canExport: role === "SUPER_ADMIN" ? true : Boolean(canExport),
        phone: phone ? phone.trim() : null,
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
          details: `Provisioned administrator account ${newUser.email} (${newUser.role}, Name: ${newUser.name})`,
          recordId: newUser.id,
          recordType: "USER",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("User POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create administrator account" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can modify administrator accounts or credentials." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, email, password, role, phone, canExport, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};

    // 1. Name update
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
    }

    // 2. Email / Username update
    let emailChanged = false;
    if (email !== undefined) {
      const sanitizedEmail = email.trim().toLowerCase();
      if (!sanitizedEmail) {
        return NextResponse.json({ error: "Username / Email cannot be empty" }, { status: 400 });
      }
      if (sanitizedEmail !== targetUser.email) {
        const emailConflict = await prisma.user.findFirst({
          where: {
            email: sanitizedEmail,
            NOT: { id },
          },
        });
        if (emailConflict) {
          return NextResponse.json(
            { error: `Username / Email '${sanitizedEmail}' is already assigned to another account.` },
            { status: 409 }
          );
        }
        dataToUpdate.email = sanitizedEmail;
        emailChanged = true;
      }
    }

    // 3. Password update
    let passwordChanged = false;
    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
      }
      dataToUpdate.passwordHash = await hashPassword(password.trim());
      passwordChanged = true;
    }

    // 4. Role update (cannot demote primary super admin email)
    if (role !== undefined) {
      const isPrimarySuperAdmin =
        targetUser.email === "jnpatel@patelsamaj.com" ||
        targetUser.email === "superadmin@patelsamaj.com";

      if (isPrimarySuperAdmin) {
        dataToUpdate.role = "SUPER_ADMIN";
        dataToUpdate.canExport = true;
      } else {
        dataToUpdate.role = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "VIEW_ONLY_ADMIN";
      }
    }

    // 5. Phone update
    if (phone !== undefined) {
      dataToUpdate.phone = phone ? phone.trim() : null;
    }

    // 6. canExport update
    if (canExport !== undefined) {
      dataToUpdate.canExport = Boolean(canExport);
    }

    // 7. isActive update
    if (isActive !== undefined) {
      dataToUpdate.isActive = Boolean(isActive);
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
      const changeDescriptions: string[] = [];
      if (emailChanged) changeDescriptions.push(`username/email to ${updated.email}`);
      if (passwordChanged) changeDescriptions.push("password reset");
      if (name) changeDescriptions.push(`name to ${updated.name}`);
      if (role) changeDescriptions.push(`role to ${updated.role}`);

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: passwordChanged ? "RESET_ADMIN_PASSWORD" : "UPDATE_ADMIN_ACCESS",
          details: `Updated administrator ${targetUser.email}: ${changeDescriptions.join(", ") || "details updated"}`,
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
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the Super Admin can delete administrator accounts." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (id === user.id) {
      return NextResponse.json({ error: "Cannot delete your own active administrator account" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.email === "jnpatel@patelsamaj.com" || targetUser.email === "superadmin@patelsamaj.com") {
      return NextResponse.json({ error: "The primary Super Admin account cannot be deleted" }, { status: 400 });
    }

    // Unlink any bookings created by this user to prevent foreign key errors
    try {
      await prisma.booking.updateMany({
        where: { bookedByUserId: id },
        data: { bookedByUserId: null },
      });
    } catch (e) {
      console.warn("Could not unlink bookings before user deletion:", e);
    }

    await prisma.user.delete({
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
          action: "DELETE_ADMIN_USER",
          details: `Deleted administrator account ${targetUser.email} (${targetUser.name})`,
          recordId: targetUser.id,
          recordType: "USER",
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, message: "Administrator account deleted successfully" });
  } catch (error: any) {
    console.error("User delete error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
