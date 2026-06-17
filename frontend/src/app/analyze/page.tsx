import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AnalyzeApp } from "@/components/analyze/AnalyzeApp";

export const metadata: Metadata = {
  title: "Analyze a listing | Beacon",
  description:
    "Paste a listing URL and watch Beacon's agents inspect it live — photo-by-photo condition scoring with the evidence behind every number.",
};

export default function AnalyzePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex shrink-0">
            <Image
              src="/beacon-logo.png"
              alt="beacon"
              width={554}
              height={451}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </div>
      </header>

      <div className="px-5 py-16 sm:px-8 sm:py-24">
        <AnalyzeApp />
      </div>
    </main>
  );
}
