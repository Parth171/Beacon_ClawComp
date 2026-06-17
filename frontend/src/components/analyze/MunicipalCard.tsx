import { Building2 } from "lucide-react";

import type { Evidence, MunicipalRiskResult } from "@/lib/analyze/types";
import { cn } from "@/lib/utils";

const RISK_STYLES: Record<string, string> = {
  High: "border-red-700/30 bg-red-700/5 text-red-700",
  Medium: "border-accent/30 bg-accent/10 text-accent",
  Low: "border-line bg-sand text-ink-muted",
};

const LEVEL_DOT: Record<string, string> = {
  high: "bg-red-700",
  medium: "bg-accent",
  low: "bg-ink-faint",
};

export function MunicipalCard({ municipal }: { municipal: MunicipalRiskResult | null }) {
  if (!municipal) {
    return (
      <div className="rounded-xl border border-line bg-sand/50 p-5">
        <div className="flex items-center gap-2 text-ink-muted">
          <Building2 className="h-4 w-4" />
          <p className="text-sm">
            No municipal records — non-NYC address, or nothing on file. (Open-data lookup
            covers New York City addresses.)
          </p>
        </div>
      </div>
    );
  }

  const violations = municipal.evidence.filter((e) => e.type === "municipal_violation");

  return (
    <div className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-ink-muted" />
          <h4 className="text-sm font-medium text-ink">NYC municipal records</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {municipal.municipalRiskScore}/100
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              RISK_STYLES[municipal.riskLevel] ?? RISK_STYLES.Low,
            )}
          >
            {municipal.riskLevel} risk
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{municipal.summary}</p>

      {municipal.signals.length ? (
        <ul className="mt-4 space-y-2">
          {municipal.signals.map((signal, i) => (
            <li key={`${signal.label}-${i}`} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  LEVEL_DOT[signal.level] ?? LEVEL_DOT.low,
                )}
              />
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {signal.label}
                  {signal.count > 1 ? (
                    <span className="text-ink-faint"> ×{signal.count}</span>
                  ) : null}
                  <span className="ml-1 font-mono text-[11px] text-ink-faint">
                    +{signal.points}
                  </span>
                </p>
                {signal.detail ? (
                  <p className="text-xs text-ink-muted">{signal.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {violations.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Open violations on record
          </p>
          <ul className="mt-2 space-y-1">
            {violations.slice(0, 8).map((v: Evidence, i) => (
              <li key={i} className="text-xs text-ink-muted">
                • {v.detail}
                {v.weight ? <span className="text-ink-faint"> ({v.weight})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
