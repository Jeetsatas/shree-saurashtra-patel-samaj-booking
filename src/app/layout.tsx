import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Gujarati } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-gujarati",
});

export const metadata: Metadata = {
  title: "Shree Saurashtra Patel Samaj, Nikol - Naroda | Hall & Dormitory Booking",
  description:
    "Official facility booking portal for Shree Saurashtra Patel Samaj, Nikol - Naroda, Ahmedabad. Check live availability of AC Banquet Halls, Community Dining Hall, and AC Dormitories.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
    <html lang="gu" className={`${inter.variable} ${notoSansGujarati.variable}`}>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950 tabular-nums`}>
        {children}
      </body>
    </html>
  );
}

