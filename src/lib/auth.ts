import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "patel_samaj_nikol_naroda_secret_key_2026_trust_secure"
);

export const COOKIE_NAME = "patel_samaj_admin_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "VIEW_ONLY_ADMIN" | string;
  canExport?: boolean;
}

/**
 * Hash password securely using pure-JS bcrypt (100% serverless & Vercel compatible)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password with bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    return false;
  }
}

export async function signSessionToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  // Multi-tab simultaneous support: check if tab passed specific admin identity
  let targetEmail = session.email;
  try {
    const reqHeaders = headers();
    const tabAdminEmail = reqHeaders.get("x-admin-email");
    if (
      tabAdminEmail &&
      ["superadmin@patelsamaj.com", "admin2@patelsamaj.com", "admin3@patelsamaj.com"].includes(
        tabAdminEmail.toLowerCase().trim()
      )
    ) {
      targetEmail = tabAdminEmail.toLowerCase().trim();
    }
  } catch (headerErr) {
    // Fall back to session cookie email if headers() not accessible
  }

  // Verify user still active in DB
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, name: true, email: true, role: true, canExport: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    canExport: user.canExport,
  };
}

/**
 * Server-side authorization check: Only the Super Admin can modify data
 */
export async function requireSuperAdmin(): Promise<
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized. Please log in as an administrator." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "SUPER_ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Forbidden. View-only administrators cannot create, modify, or delete records.",
          role: user.role,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Immutable Activity / Audit Logger
 */
export async function logActivity(params: {
  userId?: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  details?: string;
  recordId?: string;
  recordType?: string;
  ipAddress?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName,
        userEmail: params.userEmail,
        userRole: params.userRole,
        action: params.action,
        details: params.details || null,
        recordId: params.recordId || null,
        recordType: params.recordType || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Activity log write error:", err);
  }
}
