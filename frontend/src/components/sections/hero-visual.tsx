"use client";

import { motion, useReducedMotion } from "framer-motion";

const ACCENT = "#c0573b";
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/** Abstract terracotta radar line-art — the DealSense "sense" motif. */
export function HeroVisual() {
  const reduce = useReducedMotion();

  const ring = (r: number, opacity: number, dashed = false, delay = 0) => (
    <motion.circle
      cx="230"
      cy="230"
      r={r}
      fill="none"
      stroke={ACCENT}
      strokeWidth="1.3"
      strokeDasharray={dashed ? "2 8" : undefined}
      initial={reduce || dashed ? false : { pathLength: 0, opacity: 0 }}
      animate={dashed ? { opacity } : { pathLength: 1, opacity }}
      transition={{ duration: 1.5, delay, ease: EASE }}
    />
  );

  const pill = (
    label: string,
    style: React.CSSProperties,
    delay: number,
    verdict = false,
  ) => (
    <motion.span
      className={
        verdict
          ? "absolute inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cream shadow-sm"
          : "absolute inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink shadow-sm"
      }
      style={style}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <span
        className="h-1.5 w-1.5 rounded-[1px]"
        style={{ backgroundColor: verdict ? ACCENT : "var(--ink)" }}
      />
      {label}
    </motion.span>
  );

  return (
    <div className="relative aspect-square w-full max-w-[440px]">
      <svg
        viewBox="0 0 460 460"
        fill="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* crosshair */}
        <line x1="20" y1="230" x2="440" y2="230" stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 8" opacity="0.12" />
        <line x1="230" y1="20" x2="230" y2="440" stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 8" opacity="0.12" />

        {/* rings */}
        {ring(210, 0.45, true)}
        {ring(158, 0.85, false, 0.05)}
        {ring(104, 0.6, false, 0.2)}
        {ring(52, 0.45, true)}

        {/* rotating scan diameter */}
        <g className="origin-center animate-spin-slow [transform-box:fill-box]">
          <rect x="22" y="22" width="416" height="416" fill="none" />
          <line x1="230" y1="230" x2="230" y2="24" stroke={ACCENT} strokeWidth="1.4" opacity="0.75" />
          <circle cx="230" cy="24" r="3" fill={ACCENT} />
        </g>

        {/* center + node squares */}
        <circle cx="230" cy="230" r="4" fill={ACCENT} />
        <rect x="226" y="68" width="8" height="8" fill="var(--ink)" />
        <rect x="372" y="298" width="8" height="8" fill="var(--ink)" />
        <rect x="84" y="300" width="8" height="8" fill="var(--ink)" />
      </svg>

      {/* floating mono pills */}
      {pill("Inspection", { top: "9%", left: "2%" }, 0.5)}
      {pill("Valuation", { top: "60%", right: "-2%" }, 0.62)}
      {pill("Trajectory", { bottom: "16%", left: "0%" }, 0.74)}
      {pill("Verdict — Buy", { bottom: "4%", right: "16%" }, 0.9, true)}
    </div>
  );
}
