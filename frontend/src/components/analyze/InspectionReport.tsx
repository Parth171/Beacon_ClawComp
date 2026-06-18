"use client";

import { motion } from "framer-motion";
import { ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";

import { MunicipalCard } from "@/components/analyze/MunicipalCard";
import { ProvenanceBreakdown } from "@/components/analyze/ProvenanceBreakdown";
import { Eyebrow } from "@/components/ui/eyebrow";
import { formatMoney, pct } from "@/lib/analyze/format";
import type { AnalyzeReport, PerImageAssessment } from "@/lib/analyze/types";
import { cn } from "@/lib/utils";

function riskTone(value: number): string {
  if (value >= 60) return "text-red-700";
  if (value >= 30) return "text-accent";
  return "text-ink";
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-5 text-center">
      <p className={cn("font-serif text-4xl font-normal tabular-nums", tone ?? "text-ink")}>
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </p>
    </div>
  );
}

function maxRisk(p: PerImageAssessment): number {
  return Math.max(p.roofRisk, p.waterRisk, p.foundationRisk, p.electricalRisk);
}

export function InspectionReport({
  report,
  onReset,
  onGenerateLoi,
  generatingLoi,
}: {
  report: AnalyzeReport;
  onReset: () => void;
  onGenerateLoi: () => void;
  generatingLoi: boolean;
}) {
  const { property, inspection } = report;
  const hero = property.images?.[0];

  const defectPhotos = inspection.perImage.filter(
    (p) => p.flags.length > 0 || maxRisk(p) >= 0.5,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl"
    >
      <div className="flex items-center justify-between">
        <Eyebrow>Inspection report</Eyebrow>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Analyze another
        </button>
      </div>

      {/* property header */}
      <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-line bg-canvas p-5 sm:flex-row">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            className="h-44 w-full rounded-xl object-cover sm:h-40 sm:w-56"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center rounded-xl bg-sand text-xs text-ink-faint sm:h-40 sm:w-56">
            No photo
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-normal leading-tight tracking-[-0.01em] text-ink">
            {property.address ?? "Listing"}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {formatMoney(property.price)}
            {property.bedrooms != null ? ` · ${property.bedrooms} bed` : ""}
            {property.bathrooms != null ? ` · ${property.bathrooms} bath` : ""}
            {property.sqft != null ? ` · ${property.sqft.toLocaleString()} sqft` : ""}
            {property.yearBuilt != null ? ` · built ${property.yearBuilt}` : ""}
          </p>
          {property.propertyType ? (
            <p className="mt-1 text-xs text-ink-faint">{property.propertyType}</p>
          ) : null}
          {property.listingUrl ? (
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-accent transition-colors hover:text-ink"
            >
              View listing <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      {/* headline metrics */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="Repair risk"
          value={`${inspection.repairRisk}/100`}
          tone={riskTone(inspection.repairRisk)}
        />
        <Metric label="Renovation score" value={`${inspection.renovationScore}/100`} />
        <Metric
          label="Est. repair cost"
          value={formatMoney(inspection.estimatedRepairCost)}
        />
      </div>

      {/* photos with issues */}
      <section className="mt-8">
        <h3 className="font-serif text-xl font-normal text-ink">What the photos show</h3>
        {defectPhotos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No significant visible defects were flagged across {inspection.imageCount} photos.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {defectPhotos.map((p) => (
              <div
                key={p.imageIndex}
                className="flex gap-4 rounded-xl border border-line bg-canvas p-3"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-24 w-32 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    Photo {p.imageIndex + 1}
                  </p>
                  {p.flags.length ? (
                    <ul className="mt-1.5 space-y-1">
                      {p.flags.map((f, i) => (
                        <li key={i} className="text-sm text-ink">
                          <span className="font-medium">{f.issue}</span>
                          {f.location ? (
                            <span className="text-ink-muted"> · {f.location}</span>
                          ) : null}
                          <span className="ml-1 font-mono text-[11px] text-ink-faint">
                            {pct(f.confidence)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink-muted">
                      Elevated risk signal with no specific flag — worth a closer look.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* municipal */}
      <section className="mt-8">
        <h3 className="font-serif text-xl font-normal text-ink">Municipal risk</h3>
        <div className="mt-4">
          <MunicipalCard municipal={inspection.municipal} />
        </div>
      </section>

      {/* provenance */}
      <section className="mt-8">
        <h3 className="font-serif text-xl font-normal text-ink">
          Where the numbers came from
        </h3>
        <p className="mt-1.5 text-sm text-ink-muted">
          Every score is built from transparent, inspectable inputs.
        </p>
        <div className="mt-4">
          <ProvenanceBreakdown items={inspection.breakdown} />
        </div>
      </section>

      {/* Agent 6 — letter of intent */}
      <section className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-line bg-sand/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Agent 6 · PandaDoc
          </p>
          <h3 className="mt-1.5 font-serif text-xl font-normal text-ink">
            Draft the Letter of Intent
          </h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
            Turn this analysis into a presentable, signable LOI — valuation, neighbourhood
            trajectory, five-year cost projections, and offer terms in a 2–3 page document.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerateLoi}
          disabled={generatingLoi}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-accent px-6 text-sm font-medium text-cream transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generatingLoi ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generatingLoi ? "Drafting…" : "Generate Letter of Intent"}
        </button>
      </section>

      {inspection.notes.length ? (
        <section className="mt-8">
          <ul className="space-y-1">
            {inspection.notes.map((note, i) => (
              <li key={i} className="text-xs italic text-ink-faint">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
        Vision model: {inspection.model} · {inspection.imageCount} photos analyzed
      </p>
    </motion.div>
  );
}
