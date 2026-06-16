import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "DealSense — Autonomous real estate underwriting",
  description:
    "Paste a listing URL and get an evidence-backed BUY or PASS in minutes. Computer-vision inspection, live-comp valuation, and neighborhood trajectory — all running locally.",
  metadataBase: new URL("https://dealsense.ai"),
  openGraph: {
    title: "DealSense — Autonomous real estate underwriting",
    description: "From listing URL to evidence-backed BUY/PASS in minutes. Private by default.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="min-h-full bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
