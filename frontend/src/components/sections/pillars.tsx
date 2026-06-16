"use client";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { type Pillar, PILLARS } from "@/lib/content";

const ACCENT = "#c0573b";

function PillarVisual({ kind }: { kind: Pillar["visual"] }) {
  const common = "h-full w-full";
  if (kind === "inspection") {
    return (
      <svg viewBox="0 0 280 130" fill="none" className={common} aria-hidden>
        <rect x="20" y="16" width="240" height="98" rx="4" stroke="var(--ink)" strokeOpacity="0.28" />
        <path d="M100 16V114M180 16V114M20 49H260M20 81H260" stroke="var(--ink)" strokeOpacity="0.1" />
        <rect x="184" y="53" width="60" height="40" stroke={ACCENT} strokeWidth="1.6" />
        <path d="M214 49V97M188 73H240" stroke={ACCENT} strokeOpacity="0.5" />
        <circle cx="214" cy="73" r="2.4" fill={ACCENT} />
      </svg>
    );
  }
  if (kind === "valuation") {
    return (
      <svg viewBox="0 0 280 130" fill="none" className={common} aria-hidden>
        <path d="M30 110H256" stroke="var(--ink)" strokeOpacity="0.25" />
        <path d="M30 58H256" stroke={ACCENT} strokeOpacity="0.55" strokeDasharray="3 6" />
        <rect x="56" y="74" width="30" height="36" fill="var(--ink)" fillOpacity="0.12" stroke="var(--ink)" strokeOpacity="0.3" />
        <rect x="104" y="60" width="30" height="50" fill="var(--ink)" fillOpacity="0.12" stroke="var(--ink)" strokeOpacity="0.3" />
        <rect x="152" y="40" width="30" height="70" fill={ACCENT} fillOpacity="0.12" stroke={ACCENT} strokeWidth="1.4" />
        <rect x="200" y="82" width="30" height="28" fill="var(--ink)" fillOpacity="0.12" stroke="var(--ink)" strokeOpacity="0.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 280 130" fill="none" className={common} aria-hidden>
      <path d="M30 16V110H256" stroke="var(--ink)" strokeOpacity="0.25" />
      <path d="M40 96L96 80L140 86L176 60" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1.4" />
      <path d="M176 60L214 44L250 22" stroke={ACCENT} strokeWidth="1.6" strokeDasharray="3 5" />
      <circle cx="176" cy="60" r="2.6" fill="var(--ink)" />
      <circle cx="250" cy="22" r="3.2" fill={ACCENT} />
    </svg>
  );
}

export default function Pillars() {
  return (
    <section id="pillars" className="px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>What it does</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-ink sm:text-5xl">
            Three reviews on every deal.
          </h2>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <StaggerItem key={p.tag} className="h-full">
              <div className="group flex h-full flex-col rounded-xl border border-line bg-canvas transition-colors duration-300 hover:border-line-strong">
                <div className="border-b border-line bg-sand/60 p-5">
                  <div className="h-28">
                    <PillarVisual kind={p.visual} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                    {p.tag}
                  </span>
                  <h3 className="mt-3 font-serif text-2xl font-normal leading-snug text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-ink-muted">{p.body}</p>
                  <ul className="mt-5 space-y-2 border-t border-line pt-5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5 text-sm text-ink-muted">
                        <span className="h-1 w-1 rounded-[1px] bg-accent" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
