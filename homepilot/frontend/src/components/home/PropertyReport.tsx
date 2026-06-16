"use client";

import { motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

import AgentBreakdown from "@/components/AgentBreakdown";
import { AGENT_META, AGENT_STEPS } from "@/lib/agents";
import { formatCurrency } from "@/lib/scoring";
import type { AgentOutputBase, PropertyRecommendation } from "@/types/api";
import { cn } from "@/lib/utils";

interface PropertyReportProps {
  recommendation: PropertyRecommendation;
  index: number;
}

function AgentPanel({
  agentId,
  headline,
  tone,
  output,
}: {
  agentId: (typeof AGENT_STEPS)[number]["id"];
  headline: string;
  tone?: "good" | "warn" | "neutral";
  output: AgentOutputBase;
}) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[agentId];
  const step = AGENT_STEPS.find((s) => s.id === agentId)!;
  const Icon = meta.icon;
  const hasDetail = Boolean(output.breakdown?.length || output.explanation);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/50"
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", meta.bg)}>
            <Icon className={cn("h-4 w-4", meta.text)} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{step.label}</p>
            {output.confidence != null ? (
              <p className="text-[11px] text-slate-500">
                {Math.round(output.confidence * 100)}% confidence
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              tone === "good" && "text-emerald-400",
              tone === "warn" && "text-amber-400",
              tone === "neutral" && "text-slate-200",
            )}
          >
            {headline}
          </span>
          {hasDetail ? (
            <ChevronDown
              className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")}
            />
          ) : null}
        </div>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-800 px-4 py-4">
          {output.explanation ? (
            <p className="text-sm leading-relaxed text-slate-400">{output.explanation}</p>
          ) : null}
          <AgentBreakdown items={output.breakdown ?? []} />
        </div>
      ) : null}
    </div>
  );
}

export default function PropertyReport({ recommendation, index }: PropertyReportProps) {
  const { property } = recommendation;
  const value = recommendation.property_value;
  const city = property.location?.city ?? "Unknown";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="flex flex-col gap-5 p-6 sm:flex-row">
        {property.photo_urls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.photo_urls[0]}
            alt=""
            className="h-44 w-full rounded-xl object-cover sm:h-36 sm:w-48"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center rounded-xl bg-slate-900 sm:h-36 sm:w-48">
            <span className="text-xs text-slate-600">No photo</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                #{recommendation.rank} · Score {recommendation.overall_score.toFixed(1)}
              </p>
              <h3 className="mt-1 text-xl font-bold text-white">
                {property.location?.address ?? property.id}
              </h3>
              <p className="text-sm text-slate-400">
                {city}
                {property.bedrooms != null ? ` · ${property.bedrooms} bed` : ""}
                {" · "}
                {formatCurrency(property.listing_price)}
              </p>
            </div>
            {value.recommendation ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                  value.recommendation === "UNDERVALUED" && "bg-emerald-500/20 text-emerald-300",
                  value.recommendation === "OVERVALUED" && "bg-rose-500/20 text-rose-300",
                  value.recommendation === "FAIRLY_PRICED" && "bg-slate-700 text-slate-300",
                )}
              >
                {value.recommendation.replace("_", " ")}
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {recommendation.recommendation_summary}
          </p>

          {property.url ? (
            <a
              href={property.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              View listing <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      {recommendation.tradeoffs && recommendation.tradeoffs.length > 0 ? (
        <div className="mx-6 mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
            What the listing won&apos;t tell you
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-100/80">
            {recommendation.tradeoffs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-slate-800 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Agent breakdown — expand any section to see the math
        </p>
        <AgentPanel
          agentId="property_value"
          headline={`Deal ${value.deal_score.toFixed(0)}/100`}
          tone={value.deal_score >= 50 ? "good" : "warn"}
          output={value}
        />
        <AgentPanel
          agentId="property_intelligence"
          headline={`Q ${recommendation.property_intelligence.property_quality_score.toFixed(0)} · R ${recommendation.property_intelligence.repair_risk_score.toFixed(0)}`}
          tone={
            recommendation.property_intelligence.repair_risk_score >= 60 ? "warn" : "neutral"
          }
          output={recommendation.property_intelligence}
        />
        <AgentPanel
          agentId="hidden_cost"
          headline={`${formatCurrency(recommendation.hidden_cost.true_annual_cost)}/yr`}
          output={recommendation.hidden_cost}
        />
        <AgentPanel
          agentId="family_fit"
          headline={`${recommendation.family_fit.family_fit_score.toFixed(0)}/100`}
          tone={recommendation.family_fit.family_fit_score >= 70 ? "good" : "warn"}
          output={recommendation.family_fit}
        />
        <AgentPanel
          agentId="future_outlook"
          headline={`${recommendation.future_outlook.future_score.toFixed(0)}/100`}
          output={recommendation.future_outlook}
        />
      </div>
    </motion.article>
  );
}
