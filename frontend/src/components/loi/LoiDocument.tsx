"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, Printer, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { FutureCostChart, RepairCostChart, TrajectoryChart, ValuationChart } from "@/components/loi/charts";
import { formatMoney, pct } from "@/lib/analyze/format";
import type { AnalyzeReport } from "@/lib/analyze/types";
import type { LoiData } from "@/lib/loi/types";
import { cn } from "@/lib/utils";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4 text-center">
      <p className={cn("font-serif text-3xl font-normal tabular-nums leading-none", tone ?? "text-ink")}>
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</p>
    </div>
  );
}

function SectionTitle({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{kicker}</p>
      <h3 className="mt-1.5 font-serif text-2xl font-normal tracking-[-0.01em] text-ink">{children}</h3>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

export function LoiDocument({
  data,
  report,
  onBack,
}: {
  data: LoiData;
  report: AnalyzeReport;
  onBack: () => void;
}) {
  const { property } = report;
  const hero = property.images?.[0];
  const v = data.valuation;
  const ins = data.inspectionSummary;
  const totalCarry = data.futureCosts.reduce(
    (sum, c) => sum + c.propertyTax + c.maintenance + c.insurance + c.financing,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* screen-only action bar */}
      <div className="no-print mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to report
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-cream transition-colors hover:bg-accent/90"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="loi-doc rounded-2xl border border-line bg-canvas p-8 sm:p-10"
      >
        {/* ============ PAGE 1 ============ */}
        <section className="loi-page">
          {/* letterhead */}
          <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/beacon-logo.png" alt="Beacon" className="h-9 w-auto" />
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Letter of Intent
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink-faint">{data.reference}</p>
              <p className="font-mono text-[11px] text-ink-faint">{data.date}</p>
            </div>
          </header>

          <h1 className="mt-7 font-serif text-[2.5rem] font-normal leading-[1.05] tracking-[-0.02em] text-ink">
            Letter of Intent to Purchase
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            Prepared by <span className="text-ink">{data.buyerName}</span> · Presented to{" "}
            <span className="text-ink">{data.sellerName}</span>
          </p>

          {/* property snapshot */}
          <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-line bg-sand/40 p-5 sm:flex-row">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt="" className="h-40 w-full rounded-xl object-cover sm:w-56" />
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl font-normal leading-tight text-ink">
                {property.address ?? "Subject property"}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Asking {formatMoney(property.price)}
                {property.bedrooms != null ? ` · ${property.bedrooms} bed` : ""}
                {property.bathrooms != null ? ` · ${property.bathrooms} bath` : ""}
                {property.sqft != null ? ` · ${property.sqft.toLocaleString()} sqft` : ""}
                {property.yearBuilt != null ? ` · built ${property.yearBuilt}` : ""}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{data.executiveSummary}</p>
            </div>
          </div>

          {/* offer terms */}
          <div className="mt-7">
            <SectionTitle kicker="Proposed terms">Offer summary</SectionTitle>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <Term label="Offer price" value={formatMoney(data.offerTerms.offerPrice)} />
              <Term label="Deposit" value={formatMoney(data.offerTerms.depositAmount)} />
              <Term label="Financing" value={data.offerTerms.financingType} />
              <Term label="Closing date" value={data.offerTerms.closingDate} />
              <Term label="Possession" value={data.offerTerms.possessionDate} />
              <Term
                label="vs. asking"
                value={`${formatMoney(property.price - data.offerTerms.offerPrice)} below ask`}
              />
            </div>
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                Contingencies
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {data.offerTerms.contingencies.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs italic leading-relaxed text-ink-faint">
                {data.offerTerms.inspectionClause}
              </p>
            </div>
          </div>
        </section>

        {/* ============ PAGE 2 ============ */}
        <section className="loi-page mt-10 pt-2">
          {/* valuation */}
          <SectionTitle kicker="Agent 2 · Valuation">Pricing &amp; mispricing</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Fair value" value={formatMoney(v.estimatedValue)} />
            <Stat
              label="vs. asking"
              value={`${v.mispricing >= 0 ? "+" : "−"}${pct(Math.abs(v.mispricingPct))}`}
              tone={v.mispricing >= 0 ? "text-accent" : "text-ink"}
            />
            <Stat label="Seller urgency" value={pct(v.sellerUrgency)} />
          </div>
          <div className="mt-4">
            <ValuationChart asking={v.askingPrice} estimated={v.estimatedValue} offer={data.offerTerms.offerPrice} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{v.summary}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {v.comparableCount} comparables · median {formatMoney(v.medianPpsf)}/sqft
            {v.priceReductionCount > 0
              ? ` · ${v.priceReductionCount} reduction${v.priceReductionCount > 1 ? "s" : ""} totalling ${formatMoney(v.priceReductionTotal)}`
              : ""}
          </p>

          {/* condition */}
          <div className="mt-8">
            <SectionTitle kicker="Agent 3 · Inspection">Condition &amp; repair outlook</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Repair risk"
                value={`${ins.repairRisk}/100`}
                tone={ins.repairRisk >= 60 ? "text-red-700" : ins.repairRisk >= 30 ? "text-accent" : "text-ink"}
              />
              <Stat label="Renovation score" value={`${ins.renovationScore}/100`} />
              <Stat label="Est. repair cost" value={formatMoney(ins.estimatedRepairCost)} />
            </div>
            <div className="mt-4">
              <RepairCostChart data={ins.repairBreakdown} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{ins.summary}</p>
          </div>

          {/* trajectory */}
          <div className="mt-8">
            <div className="flex items-end justify-between">
              <SectionTitle kicker="Agent 4 · Trajectory">Neighbourhood trajectory</SectionTitle>
              <p className="mb-4 font-serif text-3xl font-normal tabular-nums text-accent">
                {data.trajectory.score}
                <span className="font-mono text-xs text-ink-faint">/100</span>
              </p>
            </div>
            <TrajectoryChart signals={data.trajectory.signals} />
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{data.trajectory.summary}</p>
          </div>
        </section>

        {/* ============ PAGE 3 ============ */}
        <section className="loi-page mt-10 pt-2">
          {/* future cost projection */}
          <SectionTitle kicker="Five-year outlook">Cost &amp; value projection</SectionTitle>
          <FutureCostChart data={data.futureCosts} />
          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sand/50 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  <th className="px-3 py-2 font-normal">Year</th>
                  <th className="px-3 py-2 text-right font-normal">Tax</th>
                  <th className="px-3 py-2 text-right font-normal">Maint.</th>
                  <th className="px-3 py-2 text-right font-normal">Insurance</th>
                  <th className="px-3 py-2 text-right font-normal">Financing</th>
                  <th className="px-3 py-2 text-right font-normal">Proj. value</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-ink">
                {data.futureCosts.map((c) => (
                  <tr key={c.year} className="border-t border-line">
                    <td className="px-3 py-2">Year {c.year}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.propertyTax)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.maintenance)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.insurance)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.financing)}</td>
                    <td className="px-3 py-2 text-right text-accent">{formatMoney(c.projectedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            Projected 5-year carrying cost: {formatMoney(totalCarry)}
          </p>

          {/* thesis */}
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <SectionTitle kicker="Agent 5 · Thesis">Investment recommendation</SectionTitle>
            </div>
            <div className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-4 py-1.5 font-mono text-xs font-medium uppercase tracking-[0.16em] text-cream",
                  data.thesis.recommendation === "BUY" ? "bg-accent" : "bg-ink",
                )}
              >
                {data.thesis.recommendation}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {data.thesis.confidence} confidence
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">{data.thesis.basis}</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ThesisList title="Corroborations" items={data.thesis.corroborations} icon="check" />
              <ThesisList title="Conflicts" items={data.thesis.conflicts} icon="conflict" />
              <ThesisList title="Risks" items={data.thesis.risks} icon="risk" />
            </div>
          </div>

          {/* signatures */}
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <Signature role="Buyer" name={data.buyerName} />
            <Signature role="Seller" name={data.sellerName} />
          </div>

          <p className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-faint">
            {data.narrative.closing} This is a non-binding letter of intent and does not constitute a
            contract. Figures are model estimates generated by Beacon · Agent 6 for discussion
            purposes.
          </p>
        </section>
      </motion.article>
    </div>
  );
}

function ThesisList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: "check" | "conflict" | "risk";
}) {
  const Icon = icon === "check" ? Check : icon === "conflict" ? TriangleAlert : AlertTriangle;
  const tone = icon === "check" ? "text-accent" : icon === "conflict" ? "text-ink-muted" : "text-red-700";
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.length ? (
          items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
              <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", tone)} />
              {it}
            </li>
          ))
        ) : (
          <li className="text-xs italic text-ink-faint">None noted.</li>
        )}
      </ul>
    </div>
  );
}

function Signature({ role, name }: { role: string; name: string }) {
  return (
    <div>
      <div className="h-10 border-b border-line-strong" />
      <p className="mt-2 text-sm text-ink">{name}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {role} · date __________
      </p>
    </div>
  );
}
