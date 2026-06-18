"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatCompactUSD,
  productOf,
  type MarketTier,
} from "@/lib/deck-content";

// Beacon palette as literals — Recharts SVG fills need concrete colors, and they
// must survive print where CSS-var resolution is unreliable.
const INK = "#1a1714";
const INK_FAINT = "#938d83";
const ACCENT = "#c0573b";
const MID = "#d98b6f";
const LINE = "rgba(26,23,20,0.12)";

const TIER_FILL: Record<MarketTier["key"], string> = {
  TAM: INK_FAINT,
  SAM: MID,
  SOM: ACCENT,
};

const AXIS_TICK = { fontSize: 11, fill: INK_FAINT } as const;

/**
 * Measure a container's width with a fallback. Critical for print: the off-screen
 * print tree never measures > 0, so it falls back to a fixed width and the chart
 * still renders in the exported PDF (unlike ResponsiveContainer, which goes blank).
 */
function useMeasuredWidth(fallback = 680) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Horizontal TAM → SAM → SOM funnel. Uses a log scale so the obtainable market
 * (orders of magnitude smaller than TAM) stays visible, with the real dollar
 * value labelled on each bar.
 */
export function MarketFunnel({
  tiers,
  height = 230,
}: {
  tiers: MarketTier[];
  height?: number;
}) {
  const { ref, width } = useMeasuredWidth();

  const data = tiers.map((t) => ({
    name: t.key,
    label: t.label,
    value: Math.max(1, productOf(t.variables)),
  }));

  const max = Math.max(...data.map((d) => d.value), 10);
  const min = Math.min(...data.map((d) => d.value), max);

  return (
    <div ref={ref} className="w-full">
      <BarChart
        layout="vertical"
        width={width}
        height={height}
        data={data}
        margin={{ top: 4, right: 84, bottom: 4, left: 8 }}
      >
        <XAxis
          type="number"
          scale="log"
          domain={[Math.max(1, min * 0.6), max * 1.25]}
          allowDataOverflow
          tick={AXIS_TICK}
          tickFormatter={(v: number) => formatCompactUSD(v)}
          axisLine={{ stroke: LINE }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 13, fill: INK, fontFamily: "var(--font-geist-mono)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: "rgba(26,23,20,0.04)" }}
          contentStyle={{
            borderRadius: 10,
            border: `1px solid ${LINE}`,
            fontSize: 12,
            fontFamily: "var(--font-geist-sans)",
            boxShadow: "0 6px 24px rgba(26,23,20,0.10)",
          }}
          formatter={(value, _name, item) => [
            formatCompactUSD(Number(value)),
            (item?.payload as { label?: string } | undefined)?.label ?? "",
          ]}
        />
        <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={48} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={TIER_FILL[d.name as MarketTier["key"]]} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => formatCompactUSD(Number(v))}
            style={{ fontSize: 12, fill: INK, fontFamily: "var(--font-geist-mono)" }}
          />
        </Bar>
      </BarChart>
    </div>
  );
}
