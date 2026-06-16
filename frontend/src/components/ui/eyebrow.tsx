import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small mono uppercase label with a single terracotta dot — the section kicker. */
export function Eyebrow({
  children,
  tone = "ink",
  className,
}: {
  children: ReactNode;
  tone?: "ink" | "cream";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]",
        tone === "cream" ? "text-cream-muted" : "text-ink-faint",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}
