import {
  CONFIDENCE_LABEL,
  type Confidence,
  type Metric,
} from "@/lib/deck-content";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  "source-backed": "border-ink/25 text-ink",
  assumption: "border-line text-ink-muted",
  "needs-validation": "border-accent/45 text-accent",
};

const CONFIDENCE_DOT: Record<Confidence, string> = {
  "source-backed": "bg-ink",
  assumption: "bg-ink-faint",
  "needs-validation": "bg-accent",
};

/** Small honesty pill — the same labels used on metrics and market variables. */
export function ConfidenceTag({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        CONFIDENCE_STYLE[confidence],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", CONFIDENCE_DOT[confidence])} />
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

/** A single headline figure with label, optional sub-line, and confidence pill. */
export function MetricCard({
  metric,
  tone = "ink",
  className,
}: {
  metric: Metric;
  tone?: "ink" | "cream";
  className?: string;
}) {
  const onDark = tone === "cream";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4",
        onDark ? "border-line-cream bg-white/[0.03]" : "border-line bg-sand/50",
        className,
      )}
    >
      <div
        className={cn(
          "font-serif text-3xl font-normal leading-none tracking-[-0.01em] sm:text-4xl",
          onDark ? "text-cream" : "text-ink",
        )}
      >
        {metric.value}
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] leading-snug",
          onDark ? "text-cream-muted" : "text-ink-muted",
        )}
      >
        {metric.label}
      </div>
      {metric.sub ? (
        <div className={cn("text-xs", onDark ? "text-cream-muted/70" : "text-ink-faint")}>
          {metric.sub}
        </div>
      ) : null}
      {metric.confidence ? (
        <div className="mt-1.5">
          <ConfidenceTag confidence={metric.confidence} />
        </div>
      ) : null}
    </div>
  );
}
