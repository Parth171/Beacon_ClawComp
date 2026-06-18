"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Image as ImageIcon, Lock, X } from "lucide-react";
import Image from "next/image";

import { Eyebrow } from "@/components/ui/eyebrow";
import { ConfidenceTag, MetricCard } from "@/components/deck/MetricCard";
import { MarketFunnel } from "@/components/deck/charts";
import { Tex } from "@/components/deck/Math";
import {
  CONFIDENCE_OPTIONS,
  formatCompactUSD,
  formatVariable,
  productOf,
  type MarketTier,
  type Slide as SlideData,
} from "@/lib/deck-content";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const PAD =
  "deck-slide-pad flex h-full w-full flex-col gap-5 overflow-y-auto px-7 py-7 sm:px-12 sm:py-10";

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[1.9rem] font-normal leading-[1.06] tracking-[-0.015em] text-ink sm:text-[2.6rem]">
      {children}
    </h2>
  );
}

function Header({ slide }: { slide: SlideData }) {
  return (
    <header className="shrink-0">
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <div className="mt-3.5">
        <Title>{slide.title}</Title>
      </div>
      {slide.lead ? (
        <p className="mt-3.5 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          {slide.lead}
        </p>
      ) : null}
    </header>
  );
}

/** Mono caption with the terracotta dot — used for sources / provenance lines. */
function Source({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
      <span className="h-1 w-1 rounded-full bg-accent" />
      {children}
    </span>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-sand/40 p-4", className)}>
      {children}
    </div>
  );
}

// ── 1 · Listing reveal (house → price → specs → punchline) ───────────────────

/** On-brand SVG stand-in shown until a real listing photo URL is supplied. */
function HousePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#e7ecef] to-[#f5f3ee]">
      <svg
        viewBox="0 0 240 150"
        className="h-[82%] w-auto"
        role="img"
        aria-label="House illustration"
      >
        <circle cx="42" cy="40" r="14" fill="#c0573b" opacity="0.85" />
        {/* tree */}
        <rect x="196" y="98" width="7" height="26" rx="2" fill="#8a6f5a" />
        <circle cx="199.5" cy="90" r="19" fill="#8a9a7b" />
        {/* ground */}
        <line x1="20" y1="124" x2="220" y2="124" stroke="rgba(26,23,20,0.25)" strokeWidth="2" />
        {/* chimney */}
        <rect x="138" y="40" width="13" height="26" fill="#b5a892" stroke="#1a1714" strokeWidth="2" />
        {/* roof */}
        <polygon
          points="56,66 110,28 164,66"
          fill="#c0573b"
          stroke="#1a1714"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* body */}
        <rect x="70" y="64" width="80" height="60" fill="#f3efe8" stroke="#1a1714" strokeWidth="2" />
        {/* door */}
        <rect x="98" y="90" width="22" height="34" fill="#c0573b" stroke="#1a1714" strokeWidth="2" />
        <circle cx="115" cy="108" r="1.6" fill="#1a1714" />
        {/* windows */}
        <rect x="78" y="76" width="18" height="16" fill="#dfe6ea" stroke="#1a1714" strokeWidth="2" />
        <rect x="124" y="76" width="18" height="16" fill="#dfe6ea" stroke="#1a1714" strokeWidth="2" />
        <line x1="87" y1="76" x2="87" y2="92" stroke="#1a1714" strokeWidth="1.5" />
        <line x1="78" y1="84" x2="96" y2="84" stroke="#1a1714" strokeWidth="1.5" />
        <line x1="133" y1="76" x2="133" y2="92" stroke="#1a1714" strokeWidth="1.5" />
        <line x1="124" y1="84" x2="142" y2="84" stroke="#1a1714" strokeWidth="1.5" />
      </svg>
      <span className="absolute bottom-2.5 right-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint/70">
        Listing photo
      </span>
    </div>
  );
}

function ListingSlide({ slide }: { slide: SlideData }) {
  const reduce = useReducedMotion();
  // Reveal cadence: image (0) → price (0.65) → each spec staggered → punchline last.
  const fade = (delay: number, y = 14) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };
  const specsBase = 1.25;
  const specCount = slide.specs?.length ?? 0;
  const punchDelay = specsBase + specCount * 0.12 + 0.35;

  return (
    <div className={cn(PAD, "items-center justify-center gap-6 text-center")}>
      {slide.eyebrow ? (
        <motion.div {...fade(0)} className="shrink-0">
          <Eyebrow>{slide.eyebrow}</Eyebrow>
        </motion.div>
      ) : null}

      {/* Listing card */}
      <div className="w-full max-w-[500px] shrink-0">
        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.96 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.7, ease: EASE },
              })}
          className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_24px_60px_-32px_rgba(26,23,20,0.4)]"
        >
          <div className="relative aspect-[16/10] w-full bg-sand">
            {slide.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.imageSrc}
                alt={slide.imageAlt ?? "Property listing"}
                className="h-full w-full object-cover"
              />
            ) : (
              <HousePlaceholder />
            )}
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 text-left">
            <motion.div {...fade(0.65)} className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-3xl text-ink sm:text-4xl">{slide.price}</span>
              <span className="rounded-md bg-sand px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                For sale
              </span>
            </motion.div>
            {slide.address ? (
              <motion.div {...fade(0.85)} className="-mt-1.5 text-[13px] text-ink-muted">
                {slide.address}
              </motion.div>
            ) : null}
            {specCount ? (
              <div className="flex flex-wrap gap-x-7 gap-y-2 border-t border-line pt-3">
                {slide.specs!.map((s, i) => (
                  <motion.div
                    key={i}
                    {...fade(specsBase + i * 0.12)}
                    className="flex items-baseline gap-1.5"
                  >
                    <span className="font-serif text-xl text-ink">{s.value}</span>
                    <span className="text-[12px] text-ink-muted">{s.label}</span>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* Punchline */}
      {slide.title || slide.subtitle ? (
        <motion.div {...fade(punchDelay)} className="max-w-2xl shrink-0">
          {slide.title ? (
            <p className="font-serif text-2xl leading-snug text-ink sm:text-3xl">{slide.title}</p>
          ) : null}
          {slide.subtitle ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{slide.subtitle}</p>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

// ── 2 · Intro (logo + one-line) ──────────────────────────────────────────────
function IntroSlide({ slide }: { slide: SlideData }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <div className={cn(PAD, "items-center justify-center gap-7 text-center")}>
      {slide.eyebrow ? (
        <motion.div {...fade(0)}>
          <Eyebrow>{slide.eyebrow}</Eyebrow>
        </motion.div>
      ) : null}

      <motion.div {...fade(0.15)}>
        <Image
          src="/beacon-logo.png"
          alt="Beacon"
          width={554}
          height={451}
          priority
          className="h-20 w-auto sm:h-24"
        />
      </motion.div>

      {slide.title ? (
        <motion.p
          {...fade(0.35)}
          className="max-w-2xl font-serif text-xl leading-snug text-ink sm:text-2xl"
        >
          {slide.title}
        </motion.p>
      ) : null}

      {slide.bullets?.length ? (
        <motion.div {...fade(0.55)} className="flex flex-wrap items-center justify-center gap-2">
          {slide.bullets.map((b, i) => (
            <span
              key={i}
              className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted"
            >
              {b.text}
            </span>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}

// ── 3 · Founders (Raj & Parth) ───────────────────────────────────────────────
function Avatar({ name, src }: { name: string; src?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-line bg-sand sm:h-36 sm:w-36">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-serif text-5xl text-ink-faint">
          {initials || "?"}
        </div>
      )}
    </div>
  );
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-sand sm:h-20 sm:w-20">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint/60">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}

function FoundersSlide({ slide }: { slide: SlideData }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 content-center gap-6 sm:grid-cols-2">
        {slide.founders?.map((f, fi) => (
          <motion.div key={fi} {...fade(0.1 + fi * 0.15)} className="flex flex-col gap-5">
            <div className="flex items-center gap-5">
              <Avatar name={f.name} src={f.photo} />
              <div>
                <div className="font-serif text-3xl text-ink sm:text-4xl">{f.name}</div>
                {f.role ? (
                  <div className="mt-1 font-mono text-[13px] uppercase tracking-[0.14em] text-accent">
                    {f.role}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {f.points.map((p, pi) => (
                <div key={pi} className="flex items-center gap-4">
                  <Thumb src={p.imageSrc} alt={p.text} />
                  <p className="text-base leading-snug text-ink-muted sm:text-lg">{p.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── 4 · Why this problem matters (hero stat + points) ────────────────────────
function MattersSlide({ slide }: { slide: SlideData }) {
  const hero = slide.metrics?.[0];
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 items-center gap-8 lg:grid-cols-[0.85fr_1fr]">
        {hero ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              {hero.label}
            </span>
            <span className="font-serif text-[4.5rem] leading-none text-ink sm:text-[6rem]">
              {hero.value}
            </span>
            {hero.sub ? <span className="text-[15px] text-ink-muted">{hero.sub}</span> : null}
            {hero.confidence ? (
              <div className="mt-1">
                <ConfidenceTag confidence={hero.confidence} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          {slide.bullets?.map((b, i) => (
            <div key={i} className="rounded-xl border border-line bg-sand/40 px-5 py-4">
              <p className="text-[16px] leading-snug text-ink sm:text-lg">{b.text}</p>
              {b.sub ? <p className="mt-1 text-[13.5px] text-ink-muted">{b.sub}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 5 · Where Beacon fits (journey pipeline) ─────────────────────────────────
function PipelineSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
          {slide.flow?.map((s, i, arr) => (
            <div key={i} className="contents">
              <div
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-5 py-6 text-center sm:w-40",
                  s.highlight
                    ? "border-accent bg-accent text-canvas shadow-[0_18px_44px_-20px_rgba(192,87,59,0.7)]"
                    : "border-line bg-sand/40",
                )}
              >
                <span
                  className={cn(
                    "font-serif text-xl sm:text-2xl",
                    s.highlight ? "text-canvas" : "text-ink",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "text-[13px] leading-snug",
                    s.highlight ? "text-canvas/85" : "text-ink-muted",
                  )}
                >
                  {s.detail}
                </span>
              </div>
              {i < arr.length - 1 ? (
                <div className="flex items-center justify-center py-1 sm:px-1.5">
                  <ArrowRight className="h-5 w-5 rotate-90 text-ink-faint sm:rotate-0" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {slide.bullets?.map((b, i) => (
            <div key={i} className="rounded-xl border-l-2 border-accent bg-accent/[0.05] px-4 py-3.5">
              <p className="text-[15px] leading-snug text-ink">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 6 · Technical pipeline (agents + tech + bullets) ─────────────────────────
function TechPipelineSlide({ slide }: { slide: SlideData }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        };

  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
        {slide.techAgents?.map((a, i, arr) => (
          <div key={i} className="contents">
            <motion.div
              {...fade(0.1 + i * 0.1)}
              className="flex w-full flex-col gap-2.5 rounded-2xl border border-line bg-sand/40 p-5 sm:w-60"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {a.tech ? (
                  <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    {a.tech}
                  </span>
                ) : null}
              </div>
              <div className="font-serif text-2xl leading-tight text-ink">{a.name}</div>
              <ul className="mt-1 flex flex-col gap-2.5">
                {a.points.map((p, pi) => (
                  <li
                    key={pi}
                    className="flex gap-2 text-[15px] leading-snug text-ink-muted"
                  >
                    <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
            {i < arr.length - 1 ? (
              <div className="flex items-center justify-center sm:px-1">
                <ArrowRight
                  className="h-8 w-8 rotate-90 text-accent sm:rotate-0"
                  strokeWidth={2.5}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 7 · Property Intelligence (vision model deep dive) ───────────────────────
const VISION_MARKER_SETS = [
  [
    { top: "24%", left: "50%", label: "Roof wear" },
    { top: "60%", left: "33%", label: "Water staining" },
  ],
  [
    { top: "70%", left: "42%", label: "Foundation" },
    { top: "38%", left: "66%", label: "Dated finishes" },
  ],
];

function VisionImageCard({
  image,
  markers,
  showPing,
}: {
  image: { src?: string; alt?: string };
  markers: { top: string; left: string; label: string }[];
  showPing: boolean;
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-sand shadow-[0_24px_60px_-32px_rgba(26,23,20,0.4)]">
      {image.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt ?? "Listing photo"} className="h-full w-full object-cover" />
      ) : (
        <HousePlaceholder />
      )}
      {markers.map((m, i) => (
        <div
          key={i}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
          style={{ top: m.top, left: m.left }}
        >
          <span className="relative flex h-3 w-3">
            {showPing ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            ) : null}
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent ring-2 ring-canvas" />
          </span>
          <span className="whitespace-nowrap rounded-md bg-night/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function VisionSlide({ slide }: { slide: SlideData }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 flex-col justify-center gap-6">
        {slide.subtitle ? (
          <motion.span
            {...fade(0.05)}
            className="self-start rounded-full border border-line px-3.5 py-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted"
          >
            {slide.subtitle}
          </motion.span>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {slide.images?.map((img, i) => (
            <motion.div key={i} {...fade(0.15 + i * 0.12)}>
              <VisionImageCard
                image={img}
                markers={VISION_MARKER_SETS[i % VISION_MARKER_SETS.length]}
                showPing={!reduce}
              />
            </motion.div>
          ))}
        </div>

        <motion.div {...fade(0.35)} className="grid gap-4 sm:grid-cols-3">
          {slide.bullets?.map((b, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-[16px] leading-snug text-ink sm:text-[17px]">{b.text}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ── 8 · Valuation Intelligence (XGBoost diagram + equations) ─────────────────
function ValuationSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Diagram: inputs → XGBoost → fair value */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-col gap-2">
            {slide.inputs?.map((inp, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-sand/50 px-3 py-2 text-center text-[12.5px] leading-tight text-ink"
              >
                {inp}
              </div>
            ))}
          </div>
          <ArrowRight className="h-6 w-6 shrink-0 text-accent" strokeWidth={2.5} />
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-accent bg-accent/[0.08] px-4 py-7 text-center">
            <span className="font-serif text-2xl text-ink">XGBoost</span>
            <span className="mt-0.5 text-[11px] leading-tight text-ink-muted">
              gradient-boosted trees
            </span>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0 text-accent" strokeWidth={2.5} />
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-canvas px-4 py-7 text-center">
            <span className="font-serif text-lg text-ink">Fair value</span>
            <span className="mt-0.5 font-mono text-[11px] text-ink-muted">predicted P̂</span>
          </div>
        </div>

        {/* Equations */}
        <div className="flex flex-col gap-3">
          {slide.equations?.map((eq, i) => (
            <div key={i} className="rounded-xl border border-line bg-sand/40 px-4 py-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
                {eq.label}
              </div>
              <Tex display className="block overflow-x-auto text-ink">
                {eq.tex}
              </Tex>
              {eq.caption ? (
                <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{eq.caption}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 9 · OpenClaw architecture (orchestration) ────────────────────────────────
function ArchitectureSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {/* feeding agents */}
          <div className="flex w-full flex-col gap-2.5 sm:w-auto">
            {slide.bullets?.map((b, i) => (
              <div
                key={i}
                className="rounded-xl border border-line bg-sand/40 px-4 py-3 sm:w-56"
              >
                <div className="text-[15px] font-medium text-ink">{b.text}</div>
                {b.sub ? <div className="text-[12.5px] text-ink-muted">{b.sub}</div> : null}
              </div>
            ))}
          </div>
          <ArrowRight className="h-8 w-8 rotate-90 text-accent sm:rotate-0" strokeWidth={2.5} />
          {/* orchestrator */}
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-accent bg-accent/[0.08] px-8 py-11 text-center">
            <span className="font-serif text-3xl text-ink sm:text-4xl">OpenClaw</span>
            <span className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              agent orchestrator
            </span>
          </div>
          <ArrowRight className="h-8 w-8 rotate-90 text-accent sm:rotate-0" strokeWidth={2.5} />
          {/* output */}
          {slide.verdict ? (
            <div className="flex w-full flex-col items-center justify-center rounded-2xl border border-line bg-sand/60 px-6 py-11 text-center sm:w-56">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                {slide.verdict.label}
              </span>
              <span className="mt-2 font-serif text-xl text-ink">{slide.verdict.sub}</span>
            </div>
          ) : null}
        </div>
        {slide.subtitle ? (
          <div className="self-center rounded-full border border-line bg-sand/50 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            {slide.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── 11 · Go-to-market (land / beachhead / scale) ─────────────────────────────
function GtmSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 content-center gap-4 lg:grid-cols-3">
        {slide.segments?.map((s, i) => {
          const featured = s.tag.toLowerCase() === "beachhead";
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-2.5 rounded-xl border p-5",
                featured ? "border-accent bg-accent/[0.05]" : "border-line bg-sand/40",
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                  featured ? "bg-accent text-canvas" : "border border-line text-ink-muted",
                )}
              >
                {s.tag}
              </span>
              <div className="font-serif text-xl text-ink">{s.name}</div>
              <p className="text-[13.5px] leading-snug text-ink-muted">{s.detail}</p>
              {s.uses.length ? (
                <ul className="mt-auto flex flex-col gap-1.5 pt-1">
                  {s.uses.map((u, j) => (
                    <li key={j} className="flex gap-2 text-[13px] text-ink">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {u}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 12 · Why we beat competitors (feature matrix) ────────────────────────────
function CompetitorsSlide({ slide }: { slide: SlideData }) {
  const c = slide.competitors;
  const cols = c?.columns ?? [];
  const gridCols = { gridTemplateColumns: `1.6fr repeat(${cols.length}, 0.7fr)` };
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 items-center">
        <div className="w-full overflow-hidden rounded-xl border border-line">
          <div className="grid items-stretch" style={gridCols}>
            <div className="px-4 py-3" />
            {cols.map((col, i) => (
              <div
                key={i}
                className={cn(
                  "px-2 py-3 text-center font-mono text-[12px] uppercase tracking-[0.1em]",
                  i === 0 ? "bg-accent/[0.08] font-medium text-accent" : "text-ink-muted",
                )}
              >
                {col}
              </div>
            ))}
          </div>
          {c?.rows.map((row, ri) => (
            <div key={ri} className="grid items-stretch border-t border-line" style={gridCols}>
              <div className="px-4 py-2.5 text-[13.5px] text-ink">{row.feature}</div>
              {cols.map((_, ci) => (
                <div
                  key={ci}
                  className={cn(
                    "flex items-center justify-center px-2 py-2.5",
                    ci === 0 ? "bg-accent/[0.06]" : "",
                  )}
                >
                  {row.values[ci] ? (
                    <Check className="h-5 w-5 text-accent" strokeWidth={2.5} />
                  ) : (
                    <X className="h-5 w-5 text-ink-faint/50" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Title ──────────────────────────────────────────────────────────────────
function TitleSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={cn(PAD, "justify-center")}>
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <h1 className="mt-2 max-w-4xl font-serif text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em] text-ink sm:text-[4rem]">
        {slide.title}
      </h1>
      {slide.subtitle ? (
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
          {slide.subtitle}
        </p>
      ) : null}
      {slide.metrics?.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slide.metrics.map((m, i) => (
            <MetricCard key={i} metric={m} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 2 · Story ──────────────────────────────────────────────────────────────
function StorySlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {slide.story?.beats.map((b, i) => (
          <Card key={i} className="flex flex-col gap-1.5">
            <div className="font-serif text-lg text-ink">{b.signal}</div>
            <p className="text-[13.5px] leading-snug text-ink-muted">{b.detail}</p>
            <div className="mt-auto pt-1.5">
              <Source>{b.source}</Source>
            </div>
          </Card>
        ))}
      </div>
      {slide.story?.outcome ? (
        <div className="shrink-0 rounded-xl border-l-2 border-accent bg-accent/[0.06] px-5 py-4">
          <p className="font-serif text-lg italic leading-snug text-ink sm:text-xl">
            {slide.story.outcome}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── 3 · Problem (comparison) ─────────────────────────────────────────────────
function ProblemSlide({ slide }: { slide: SlideData }) {
  const c = slide.comparison;
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        {c ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-sand/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              <span />
              <span>{c.leftTitle}</span>
              <span className="text-accent">{c.rightTitle}</span>
            </div>
            {c.rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 border-t border-line px-4 py-2.5 text-[13px]"
              >
                <span className="font-medium text-ink">{r.label}</span>
                <span className="text-ink-muted">{r.left}</span>
                <span className="font-medium text-ink">{r.right}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2.5">
          {slide.bullets?.map((b, i) => (
            <div key={i} className="rounded-lg border border-line bg-canvas px-3.5 py-2.5">
              <div className="text-sm font-medium text-ink">{b.text}</div>
              {b.sub ? (
                <div className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{b.sub}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 4 · Why now ──────────────────────────────────────────────────────────────
function WhyNowSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {slide.bullets?.map((b, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <span className="font-serif text-3xl text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="font-serif text-xl leading-tight text-ink">{b.text}</div>
            {b.sub ? (
              <p className="text-[13.5px] leading-snug text-ink-muted">{b.sub}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 5 · Demo flow ────────────────────────────────────────────────────────────
function DemoSlide({ slide }: { slide: SlideData }) {
  const buy = slide.verdict?.tone === "buy";
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:gap-0">
          {slide.flow?.map((s, i, arr) => (
            <div key={i} className="contents">
              <Card className="flex flex-col gap-1 bg-canvas">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Step {i + 1}
                </span>
                <div className="text-sm font-medium text-ink">{s.label}</div>
                <p className="text-[12.5px] leading-snug text-ink-muted">{s.detail}</p>
              </Card>
              {i < arr.length - 1 ? (
                <div className="flex items-center justify-center py-1 sm:px-2">
                  <ArrowRight className="h-4 w-4 rotate-90 text-ink-faint sm:rotate-0" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {slide.verdict ? (
          <div
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border p-5 sm:flex-row sm:items-center",
              buy ? "border-accent/40 bg-accent/[0.06]" : "border-line bg-sand/50",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 font-mono text-sm font-medium uppercase tracking-[0.2em]",
                buy ? "bg-accent text-canvas" : "bg-ink text-canvas",
              )}
            >
              {slide.verdict.label}
            </span>
            <p className="text-sm leading-snug text-ink">{slide.verdict.sub}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── 6 · Engine / agents ──────────────────────────────────────────────────────
function EngineSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {slide.agents?.map((a, i) => (
          <Card key={i} className="flex items-start gap-3 bg-canvas">
            <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-sm font-medium text-ink">{a.name}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{a.role}</p>
            </div>
          </Card>
        ))}
      </div>
      {slide.bullets?.length ? (
        <div className="grid shrink-0 gap-2.5 sm:grid-cols-3">
          {slide.bullets.map((b, i) => (
            <div key={i} className="border-t border-line pt-2.5">
              <div className="text-[13px] font-medium text-ink">{b.text}</div>
              {b.sub ? (
                <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{b.sub}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 7 · Market (TAM/SAM/SOM) ──────────────────────────────────────────────────
function TierCard({ tier }: { tier: MarketTier }) {
  const value = productOf(tier.variables);
  return (
    <Card className="flex flex-col gap-2 bg-canvas">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.12em] text-canvas">
            {tier.key}
          </span>
          <span className="text-[13px] font-medium text-ink">{tier.label}</span>
        </div>
        <span className="font-serif text-2xl text-ink">{formatCompactUSD(value)}</span>
      </div>
      <p className="font-mono text-[11px] leading-snug text-ink-faint">{tier.formula}</p>
      <div className="font-mono text-[12px] text-ink-muted">
        {tier.variables.map((v) => formatVariable(v)).join("  ×  ")}{"  =  "}
        <span className="font-medium text-ink">{formatCompactUSD(value)}</span>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line pt-2">
        {tier.variables.map((v, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
            <span className="text-ink-muted">{v.name}</span>
            <ConfidenceTag confidence={v.confidence} />
            <span className="w-full text-[11px] italic leading-snug text-ink-faint">
              {v.citation}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MarketSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-3">
          {slide.market?.map((t) => (
            <TierCard key={t.key} tier={t} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Card className="bg-canvas">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              TAM → SAM → SOM (log scale)
            </div>
            <MarketFunnel tiers={slide.market ?? []} />
          </Card>
          <div className="flex flex-wrap gap-2">
            {CONFIDENCE_OPTIONS.map((c) => (
              <ConfidenceTag key={c} confidence={c} />
            ))}
          </div>
          <p className="text-[12px] leading-snug text-ink-faint">
            Every figure is a product of the editable variables shown — change a
            multiplicand and the bar updates. Numbers are assumptions until each
            citation is filled and validated.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 8 · Methodology ──────────────────────────────────────────────────────────
function MethodologySlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 content-start gap-3 sm:grid-cols-2">
        {slide.principles?.map((p, i) => (
          <Card key={i} className="flex gap-3 bg-canvas">
            <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-sm font-medium text-ink">{p.title}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{p.detail}</p>
            </div>
          </Card>
        ))}
      </div>
      {slide.bullets?.length ? (
        <div className="shrink-0 rounded-xl border border-line bg-sand/40 px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {CONFIDENCE_OPTIONS.map((c) => (
              <ConfidenceTag key={c} confidence={c} />
            ))}
          </div>
          {slide.bullets.map((b, i) => (
            <p key={i} className="text-[12.5px] leading-snug text-ink-muted">
              {b.sub ?? b.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 9 · Customers ────────────────────────────────────────────────────────────
const TAG_STYLE: Record<string, string> = {
  Wedge: "bg-accent text-canvas",
  Expansion: "border border-line-strong text-ink",
  Enterprise: "bg-ink text-canvas",
};

function CustomersSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {slide.segments?.map((s, i) => (
          <Card key={i} className="flex flex-col gap-2 bg-canvas">
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-lg text-ink">{s.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                  TAG_STYLE[s.tag] ?? "border border-line text-ink-muted",
                )}
              >
                {s.tag}
              </span>
            </div>
            <p className="text-[13px] leading-snug text-ink-muted">{s.detail}</p>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {s.uses.map((u, j) => (
                <span
                  key={j}
                  className="rounded-md border border-line bg-sand/50 px-2 py-0.5 text-[11px] text-ink-muted"
                >
                  {u}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 10 · Business model ──────────────────────────────────────────────────────
function BusinessSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 gap-3 lg:grid-cols-3">
        {slide.tiers?.map((t, i) => (
          <Card
            key={i}
            className={cn(
              "flex flex-col gap-2",
              i === 2 ? "border-accent/40 bg-accent/[0.04]" : "bg-canvas",
            )}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {t.name}
            </div>
            <div className="font-serif text-2xl text-ink">{t.price}</div>
            <div className="text-[12.5px] text-ink-muted">{t.who}</div>
            <div className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2">
              {t.features.map((f, j) => (
                <div key={j} className="flex items-start gap-2 text-[12.5px] text-ink-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  {f}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {slide.bullets?.length ? (
        <div className="grid shrink-0 gap-2.5 sm:grid-cols-4">
          {slide.bullets.map((b, i) => (
            <div key={i} className="border-t border-line pt-2">
              <div className="text-[12.5px] font-medium text-ink">{b.text}</div>
              {b.sub ? (
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{b.sub}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── 11 · Moat / partnerships ─────────────────────────────────────────────────
function MoatSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {slide.bullets?.map((b, i) => (
              <div key={i} className="rounded-lg border border-line bg-canvas px-3.5 py-2.5">
                <div className="text-[13px] font-medium text-ink">{b.text}</div>
                {b.sub ? (
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{b.sub}</div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slide.partners?.map((p, i) => (
              <div key={i} className="rounded-lg border border-line bg-sand/40 px-3 py-2">
                <div className="text-[12px] font-medium text-ink">{p.name}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{p.role}</div>
              </div>
            ))}
          </div>
        </div>
        {slide.privacy?.length ? (
          <Card className="flex flex-col gap-2 bg-night">
            <div className="flex items-center gap-2 text-cream">
              <Lock className="h-4 w-4 text-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream-muted">
                Privacy & data rights
              </span>
            </div>
            {slide.privacy.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-cream-muted">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {p}
              </div>
            ))}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ── 12 · Team ────────────────────────────────────────────────────────────────
function TeamSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 content-start gap-3 lg:grid-cols-3">
        {slide.team?.map((m, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-xl border border-dashed border-line-strong bg-sand/30 p-4"
          >
            <div className="font-serif text-lg text-ink">{m.name}</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
              {m.role}
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{m.background}</p>
          </div>
        ))}
      </div>
      <div className="grid shrink-0 gap-4 sm:grid-cols-[1fr_1fr]">
        {slide.research?.length ? (
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Research & evidence
            </div>
            <div className="flex flex-wrap gap-1.5">
              {slide.research.map((r, i) => (
                <span
                  key={i}
                  className="rounded-md border border-line bg-canvas px-2 py-1 text-[11.5px] text-ink-muted"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {slide.bullets?.length ? (
          <div className="rounded-lg border-l-2 border-accent bg-accent/[0.05] px-3.5 py-2.5">
            {slide.bullets.map((b, i) => (
              <div key={i}>
                <div className="text-[12.5px] font-medium text-ink">{b.text}</div>
                {b.sub ? (
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{b.sub}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── 13 · Roadmap ─────────────────────────────────────────────────────────────
function RoadmapSlide({ slide }: { slide: SlideData }) {
  return (
    <div className={PAD}>
      <Header slide={slide} />
      <div className="grid flex-1 content-center gap-3 lg:grid-cols-4">
        {slide.milestones?.map((m, i) => (
          <div key={i} className="relative flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {m.period}
              </span>
            </div>
            <div className="h-px w-full bg-line" />
            <div className="font-serif text-lg leading-tight text-ink">{m.title}</div>
            <p className="text-[12.5px] leading-snug text-ink-muted">{m.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 14 · Ask ──────────────────────────────────────────────────────────────────
function AskSlide({ slide }: { slide: SlideData }) {
  const a = slide.ask;
  return (
    <div className={cn(PAD, "justify-center")}>
      {slide.eyebrow ? <Eyebrow>{slide.eyebrow}</Eyebrow> : null}
      <div className="mt-3">
        <Title>{slide.title}</Title>
      </div>
      {slide.lead ? (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{slide.lead}</p>
      ) : null}
      {a ? (
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-serif text-3xl text-accent sm:text-4xl">{a.raising}</span>
            <span className="text-sm text-ink-muted">{a.milestone}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {a.useOfFunds.map((u, i) => (
              <Card key={i} className="bg-canvas">
                <div className="text-sm font-medium text-ink">{u.label}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{u.detail}</p>
              </Card>
            ))}
          </div>
          {a.contact ? (
            <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-faint">
              {a.contact}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const RENDERERS: Record<SlideData["kind"], (p: { slide: SlideData }) => React.ReactNode> = {
  listing: ListingSlide,
  intro: IntroSlide,
  founders: FoundersSlide,
  matters: MattersSlide,
  pipeline: PipelineSlide,
  techpipeline: TechPipelineSlide,
  vision: VisionSlide,
  valuation: ValuationSlide,
  architecture: ArchitectureSlide,
  gtm: GtmSlide,
  competitors: CompetitorsSlide,
  title: TitleSlide,
  story: StorySlide,
  problem: ProblemSlide,
  whyNow: WhyNowSlide,
  demo: DemoSlide,
  engine: EngineSlide,
  market: MarketSlide,
  methodology: MethodologySlide,
  customers: CustomersSlide,
  business: BusinessSlide,
  moat: MoatSlide,
  team: TeamSlide,
  roadmap: RoadmapSlide,
  ask: AskSlide,
};

export function Slide({ slide }: { slide: SlideData }) {
  const Renderer = RENDERERS[slide.kind] ?? TitleSlide;
  return <Renderer slide={slide} />;
}
