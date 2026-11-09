import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

export async function GET(req: Request) {
  const url = new URL("/admin/login", req.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
