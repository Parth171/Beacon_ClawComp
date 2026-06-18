import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EditableDeck } from "@/components/deck/EditableDeck";

export const metadata: Metadata = {
  title: "Investor deck | Beacon",
  description:
    "An editable, investor-ready pitch deck for Beacon — the autonomous real-estate underwriting platform. Edit every slide in-browser and export to PDF.",
};

export default function DeckPage() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="no-print border-b border-line">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8">
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

      <div className="px-5 py-8 sm:px-8 sm:py-12">
        <EditableDeck />
      </div>
    </main>
  );
}
