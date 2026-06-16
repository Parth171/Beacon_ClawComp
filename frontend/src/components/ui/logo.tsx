import Link from "next/link";
import { cn } from "@/lib/utils";

function RadarMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8.3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="4.1" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      <path
        d="M10 1.7V18.3M1.7 10H18.3"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
      <circle cx="10" cy="10" r="1.7" fill="#c0573b" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "cream";
}) {
  return (
    <Link
      href="#hero"
      className={cn(
        "inline-flex items-center gap-2.5",
        tone === "cream" ? "text-cream" : "text-ink",
        className,
      )}
    >
      <RadarMark />
      <span className="text-[17px] font-semibold tracking-tight">DealSense</span>
    </Link>
  );
}
