import type { BreakdownItem } from "@/lib/analyze/types";
import { cn } from "@/lib/utils";

// CalcInput.source is a freeform optional string in this codebase ("market", "DOB",
// "ECB/OATH", or absent) — NOT a fixed enum. Map known tags to friendly labels and
// fall back to the raw string; render no badge when there's no source.
const SOURCE_LABELS: Record<string, string> = {
  market: "Market",
  listing: "Listing",
  model: "AI",
  ai: "AI",
  assumption: "Estimate",
  estimate: "Estimate",
  computed: "Derived",
  derived: "Derived",
};

function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

function SourceBadge({ source }: { source?: string | null }) {
  const label = sourceLabel(source);
  if (!label) return null;
  const accented = ["AI", "Market"].includes(label);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        accented ? "border-accent/30 bg-accent/10 text-accent" : "border-line bg-sand text-ink-muted",
      )}
    >
      {label}
    </span>
  );
}

export function ProvenanceBreakdown({ items }: { items: BreakdownItem[] }) {
  if (!items?.length) {
    return (
      <p className="text-sm text-ink-muted">No itemized breakdown was produced for this run.</p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="rounded-xl border border-line bg-canvas p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-medium text-ink">{item.label}</h4>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink">
              {String(item.value)}
            </span>
          </div>

          {item.formula ? (
            <p className="mt-1.5 font-mono text-xs leading-relaxed text-ink-faint">
              {item.formula}
            </p>
          ) : null}

          {item.inputs?.length ? (
            <ul className="mt-3 space-y-2">
              {item.inputs.map((input, i) => (
                <li
                  key={`${input.label}-${i}`}
                  className="flex flex-col gap-1 border-l-2 border-line pl-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <SourceBadge source={input.source} />
                    <span className="truncate text-xs text-ink-muted">{input.label}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-ink">
                    {String(input.value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {item.note ? (
            <p className="mt-2 text-xs italic text-ink-faint">{item.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
