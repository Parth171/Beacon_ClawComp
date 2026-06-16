"use client";

import {
  Baby,
  BedDouble,
  BriefcaseBusiness,
  Dog,
  DollarSign,
  Home,
  Link2,
  MapPin,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SearchBrief } from "@/lib/search";

interface SearchBriefFormProps {
  values: SearchBrief;
  onChange: (values: SearchBrief) => void;
  onSubmit: () => void;
  onUseDemo: () => void;
  loading: boolean;
}

function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 8,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.04] p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/10 hover:text-white"
      >
        -
      </button>
      <span className="w-10 text-center text-sm font-semibold tabular-nums text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/10 hover:text-white"
      >
        +
      </button>
    </div>
  );
}

function FieldLabel({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
      {icon}
      {children}
    </label>
  );
}

export default function SearchBriefForm({
  values,
  onChange,
  onSubmit,
  onUseDemo,
  loading,
}: SearchBriefFormProps) {
  const set = <K extends keyof SearchBrief>(key: K, value: SearchBrief[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-300">
            Search brief
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Tell HomePilot what to find.
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            Use the same details you would send the Telegram bot. The web app turns them into a
            live ranked workspace.
          </p>
        </div>
        <span className="hidden rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200 sm:block">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-8 space-y-5">
        <div>
          <FieldLabel icon={<DollarSign className="h-4 w-4 text-emerald-300" />}>
            Budget
          </FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            value={values.budget}
            onChange={(event) => set("budget", event.target.value.replace(/[^\d]/g, ""))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            placeholder="950000"
          />
        </div>

        <div>
          <FieldLabel icon={<MapPin className="h-4 w-4 text-sky-300" />}>
            Target locations
          </FieldLabel>
          <input
            type="text"
            value={values.locations}
            onChange={(event) => set("locations", event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            placeholder="Toronto, Burlington, Mississauga"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel icon={<Baby className="h-4 w-4 text-violet-300" />}>Kids</FieldLabel>
            <NumberStepper value={values.children} onChange={(value) => set("children", value)} />
          </div>
          <div>
            <FieldLabel icon={<BedDouble className="h-4 w-4 text-amber-300" />}>
              Min bedrooms
            </FieldLabel>
            <NumberStepper
              value={values.minBedrooms}
              min={1}
              onChange={(value) => set("minBedrooms", value)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => set("hasPets", !values.hasPets)}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07]"
        >
          <span className="flex items-center gap-3 text-sm text-neutral-300">
            <Dog className="h-4 w-4 text-orange-300" />
            Pets matter for this search
          </span>
          <span
            className={`h-6 w-11 rounded-full p-1 transition ${
              values.hasPets ? "bg-orange-400" : "bg-neutral-700"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition ${
                values.hasPets ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel icon={<BriefcaseBusiness className="h-4 w-4 text-cyan-300" />}>
              Commute to
            </FieldLabel>
            <input
              type="text"
              value={values.workLocation}
              onChange={(event) => set("workLocation", event.target.value)}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
              placeholder="Toronto"
            />
          </div>
          <div>
            <FieldLabel icon={<Timer className="h-4 w-4 text-cyan-300" />}>
              Max commute
            </FieldLabel>
            <input
              type="text"
              inputMode="numeric"
              value={values.maxCommuteMinutes}
              onChange={(event) =>
                set("maxCommuteMinutes", event.target.value.replace(/[^\d]/g, ""))
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
              placeholder="45"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <FieldLabel icon={<Home className="h-4 w-4 text-emerald-300" />}>
              Must-haves
            </FieldLabel>
            <textarea
              value={values.mustHaves}
              onChange={(event) => set("mustHaves", event.target.value)}
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            />
          </div>
          <div>
            <FieldLabel icon={<Sparkles className="h-4 w-4 text-violet-300" />}>
              Nice-to-haves
            </FieldLabel>
            <textarea
              value={values.niceToHaves}
              onChange={(event) => set("niceToHaves", event.target.value)}
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            />
          </div>
          <div>
            <FieldLabel icon={<XCircle className="h-4 w-4 text-rose-300" />}>Avoid</FieldLabel>
            <textarea
              value={values.exclusions}
              onChange={(event) => set("exclusions", event.target.value)}
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            />
          </div>
        </div>

        <div>
          <FieldLabel icon={<Link2 className="h-4 w-4 text-fuchsia-300" />}>
            Real listing URLs
          </FieldLabel>
          <textarea
            value={values.listingUrls}
            onChange={(event) => set("listingUrls", event.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            placeholder="Paste realtor.ca links to analyze real homes instead of the demo search."
          />
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Criteria-only search asks OpenClaw to discover homes. Pasted realtor.ca URLs use the
            existing backend listing fetch directly.
          </p>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-2xl bg-white px-6 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "HomePilot is working..." : "Find and rank homes"}
        </button>
        <button
          type="button"
          onClick={onUseDemo}
          disabled={loading}
          className="h-12 rounded-2xl border border-white/10 px-6 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
        >
          Use demo search
        </button>
      </div>
    </form>
  );
}
