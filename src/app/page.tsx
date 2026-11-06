import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Root Entry Point: Private Admin-Only Booking Management System
 * Automatically redirects unauthenticated traffic to the secure Admin Login,
 * or logged-in administrators directly to the internal Dashboard.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "VIEW_ONLY_ADMIN") {
      redirect("/admin/calendar");
    } else {
      redirect("/admin");
    }
  } else {
    redirect("/admin/login");
  }
}
