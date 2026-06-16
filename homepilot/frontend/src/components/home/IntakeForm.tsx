"use client";

import { Baby, Cat, Dog, DollarSign, Link2, MapPin } from "lucide-react";

import type { BuyerProfile } from "@/types/api";

export interface IntakeValues {
  budget: string;
  children: number;
  hasPets: boolean;
  preferredCity: string;
  listingUrls: string;
}

export const defaultIntakeValues: IntakeValues = {
  budget: "900000",
  children: 0,
  hasPets: false,
  preferredCity: "",
  listingUrls: "",
};

export function intakeToBuyerProfile(values: IntakeValues): BuyerProfile {
  return {
    budget: Number(values.budget.replace(/,/g, "")),
    children: values.children,
    dog: values.hasPets,
    preferred_city: values.preferredCity.trim() || null,
  };
}

interface IntakeFormProps {
  values: IntakeValues;
  onChange: (values: IntakeValues) => void;
  onSubmit: () => void;
  onLoadDemo: () => void;
  loading: boolean;
  error: string | null;
  demoReady: boolean;
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 6,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
      >
        −
      </button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums text-white">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
      >
        +
      </button>
    </div>
  );
}

export default function IntakeForm({
  values,
  onChange,
  onSubmit,
  onLoadDemo,
  loading,
  error,
  demoReady,
}: IntakeFormProps) {
  const set = <K extends keyof IntakeValues>(key: K, val: IntakeValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <section id="start" className="relative z-10 mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <div className="glass rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">Tell us about your household</h2>
        <p className="mt-1 text-sm text-slate-400">
          We use this to score lifestyle fit — not to resell you the listing pitch.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <DollarSign className="h-4 w-4 text-indigo-400" />
              Budget (CAD)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={values.budget}
              onChange={(e) => set("budget", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="900000"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Baby className="h-4 w-4 text-emerald-400" />
                Kids
              </label>
              <Stepper value={values.children} onChange={(n) => set("children", n)} />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Dog className="h-4 w-4 text-amber-400" />
                Pets
              </label>
              <button
                type="button"
                onClick={() => set("hasPets", !values.hasPets)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                  values.hasPets
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                    : "border-slate-700 bg-slate-950/80 text-slate-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  {values.hasPets ? (
                    <>
                      <Dog className="h-4 w-4" /> Yes — we have pets
                    </>
                  ) : (
                    <>
                      <Cat className="h-4 w-4 opacity-50" /> No pets
                    </>
                  )}
                </span>
                <span
                  className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                    values.hasPets ? "bg-amber-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      values.hasPets ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <MapPin className="h-4 w-4 text-cyan-400" />
              Preferred area <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={values.preferredCity}
              onChange={(e) => set("preferredCity", e.target.value)}
              placeholder="Kitchener, Toronto, …"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Link2 className="h-4 w-4 text-violet-400" />
              Listing URL
            </label>
            <textarea
              value={values.listingUrls}
              onChange={(e) => set("listingUrls", e.target.value)}
              rows={2}
              placeholder="https://www.realtor.ca/real-estate/…"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {demoReady ? (
              <p className="mt-2 text-xs text-emerald-400/90">
                Demo properties loaded — analyze without a URL.
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onSubmit}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Agents running…" : "Run analysis"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onLoadDemo}
            className="rounded-xl border border-slate-600 bg-slate-900/80 px-6 py-3 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
          >
            Load demo
          </button>
        </div>
      </div>
    </section>
  );
}
