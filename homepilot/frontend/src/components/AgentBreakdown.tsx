import type { BreakdownItem, InputSource } from "@/types/api";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<
  InputSource,
  { label: string; className: string }
> = {
  listing: { label: "Listing", className: "bg-sky-500/20 text-sky-300 ring-sky-500/30" },
  market: { label: "Market", className: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30" },
  model: { label: "AI", className: "bg-violet-500/20 text-violet-300 ring-violet-500/30" },
  assumption: { label: "Estimate", className: "bg-amber-500/20 text-amber-300 ring-amber-500/30" },
  computed: { label: "Derived", className: "bg-slate-600/40 text-slate-300 ring-slate-500/30" },
};

export function SourceBadge({ source }: { source: InputSource }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.computed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

interface AgentBreakdownProps {
  items: BreakdownItem[];
}

export default function AgentBreakdown({ items }: AgentBreakdownProps) {
  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h5 className="text-sm font-medium text-slate-200">{item.label}</h5>
            <span className="shrink-0 text-sm font-bold tabular-nums text-white">
              {item.value}
            </span>
          </div>
          {item.formula ? (
            <p className="mt-1 font-mono text-xs text-slate-500">{item.formula}</p>
          ) : null}
          {item.inputs.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {item.inputs.map((input, i) => (
                <li key={`${input.label}-${i}`} className="border-l-2 border-slate-800 pl-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <SourceBadge source={input.source} />
                      <span className="truncate text-xs text-slate-400">{input.label}</span>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-slate-300">
                      {input.value}
                    </span>
                  </div>
                  {input.evidence_urls?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {input.evidence_urls.slice(0, 4).map((url, photoIndex) => (
                        <a
                          key={`${url}-${photoIndex}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
                          aria-label={`Open evidence photo ${photoIndex + 1} for ${input.label}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="h-20 w-28 object-cover transition-transform group-hover:scale-105"
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            Evidence
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {item.note ? <p className="mt-2 text-xs italic text-slate-500">{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}
