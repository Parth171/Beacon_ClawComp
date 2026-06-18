"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/analyze/format";
import type { LoiFutureCost, LoiRepairItem, LoiTrajectorySignal } from "@/lib/loi/types";

// Beacon palette as literals (Recharts SVG fills want concrete colors, and they
// must survive print where CSS-var resolution is unreliable).
const INK = "#1a1714";
const INK_MUTED = "#5f5a52";
const INK_FAINT = "#938d83";
const ACCENT = "#c0573b";
const LINE = "rgba(26,23,20,0.12)";

const COST_COLORS = {
  propertyTax: ACCENT,
  maintenance: "#d98b6f",
  insurance: "#b5a892",
  financing: INK_MUTED,
};

const AXIS_TICK = { fontSize: 11, fill: INK_FAINT } as const;

const tooltipStyle = {
  borderRadius: 10,
  border: `1px solid ${LINE}`,
  fontSize: 12,
  fontFamily: "var(--font-geist-sans)",
  boxShadow: "0 6px 24px rgba(26,23,20,0.10)",
} as const;

function moneyShort(v: number): string {
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

/** Headline "future costs" visual: stacked annual carrying costs + value line. */
export function FutureCostChart({ data }: { data: LoiFutureCost[] }) {
  const rows = data.map((d) => ({ ...d, label: `Yr ${d.year}` }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: LINE }} tickLine={false} />
        <YAxis
          yAxisId="cost"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={moneyShort}
          width={48}
        />
        <YAxis
          yAxisId="value"
          orientation="right"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={moneyShort}
          width={52}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [formatMoney(Number(value)), name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-geist-mono)" }} iconType="circle" />
        <Area
          yAxisId="cost"
          type="monotone"
          dataKey="propertyTax"
          name="Property tax"
          stackId="costs"
          stroke={COST_COLORS.propertyTax}
          fill={COST_COLORS.propertyTax}
          fillOpacity={0.85}
        />
        <Area
          yAxisId="cost"
          type="monotone"
          dataKey="maintenance"
          name="Maintenance"
          stackId="costs"
          stroke={COST_COLORS.maintenance}
          fill={COST_COLORS.maintenance}
          fillOpacity={0.85}
        />
        <Area
          yAxisId="cost"
          type="monotone"
          dataKey="insurance"
          name="Insurance"
          stackId="costs"
          stroke={COST_COLORS.insurance}
          fill={COST_COLORS.insurance}
          fillOpacity={0.85}
        />
        <Area
          yAxisId="cost"
          type="monotone"
          dataKey="financing"
          name="Financing"
          stackId="costs"
          stroke={COST_COLORS.financing}
          fill={COST_COLORS.financing}
          fillOpacity={0.85}
        />
        <Line
          yAxisId="value"
          type="monotone"
          dataKey="projectedValue"
          name="Projected value"
          stroke={INK}
          strokeWidth={2}
          dot={{ r: 3, fill: INK }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Asking vs. modelled fair value vs. our offer. */
export function ValuationChart({
  asking,
  estimated,
  offer,
}: {
  asking: number;
  estimated: number;
  offer: number;
}) {
  const data = [
    { name: "Asking", value: asking, fill: INK_MUTED },
    { name: "Fair value", value: estimated, fill: ACCENT },
    { name: "Our offer", value: offer, fill: INK },
  ];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={LINE} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: LINE }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={moneyShort} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} cursor={{ fill: "rgba(26,23,20,0.04)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={68}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Estimated repair cost split by category (horizontal bars). */
export function RepairCostChart({ data }: { data: LoiRepairItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={LINE} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={moneyShort} />
        <YAxis
          type="category"
          dataKey="category"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} cursor={{ fill: "rgba(26,23,20,0.04)" }} />
        <Bar dataKey="cost" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Neighbourhood trajectory signal scores (0–100, horizontal bars). */
export function TrajectoryChart({ signals }: { signals: LoiTrajectorySignal[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, signals.length * 34)}>
      <BarChart
        layout="vertical"
        data={signals}
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke={LINE} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={150}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value)}/100`} cursor={{ fill: "rgba(26,23,20,0.04)" }} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {signals.map((s) => (
            <Cell key={s.name} fill={s.score >= 70 ? ACCENT : s.score >= 50 ? "#d98b6f" : INK_FAINT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
