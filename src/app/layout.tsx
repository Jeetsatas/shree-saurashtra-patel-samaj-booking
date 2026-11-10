import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shree Saurashtra Patel Samaj, Nikol - Naroda | Hall & Dormitory Booking",
  description:
    "Official facility booking portal for Shree Saurashtra Patel Samaj, Nikol - Naroda, Ahmedabad. Check live availability of AC Banquet Halls, Community Dining Hall, and AC Dormitories.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}

