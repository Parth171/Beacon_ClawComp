"use client";

import { ArrowRight, CheckCircle2, Home, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { BackgroundBeams } from "@/components/ui/background-beams";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { Spotlight } from "@/components/ui/spotlight";

const highlights = ["Hidden costs", "School fit", "Fair value"];

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden bg-[#07080d] px-4 pt-28 pb-20 text-white sm:px-6 lg:pt-36"
    >
      <Spotlight className="-top-44 left-0 md:-top-28 md:left-72" fill="white" />
      <BackgroundBeams />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.04fr_0.96fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-neutral-300 shadow-2xl shadow-sky-500/10 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            AI-native home buying, built for real decisions
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl lg:leading-[0.94]">
            The work behind the offer.{" "}
            <span className="bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text font-serif italic text-transparent">
              Handled.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300 sm:text-lg">
            HomePilot turns messy listing research into a ranked shortlist. Five specialist agents
            inspect every home for cost, fit, value, condition, and future upside before you fall in
            love with the photos.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <MovingBorderButton href="/search" className="h-12 bg-white px-7 text-neutral-950">
              Start your search
              <ArrowRight className="h-4 w-4" />
            </MovingBorderButton>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-7 text-sm font-medium text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              See how it works
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {highlights.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div id="demo" className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-sky-500/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0b0d14] p-5">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
                    Product workflow
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    Search brief accepted
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
                    <MapPin className="h-4 w-4" />
                    Toronto, Burlington, Mississauga
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
                  <p className="text-xs text-emerald-200">Found</p>
                  <p className="text-3xl font-semibold text-white">18</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Budget", "$950k max"],
                  ["Family", "2 kids + dog"],
                  ["Commute", "45 min max"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="mt-2 text-sm font-medium text-neutral-100">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">Agent review</p>
                  <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs text-sky-200">
                    Ranking live
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    ["Discovery", "Candidate homes matched from your search brief."],
                    ["Specialists", "Cost, fit, value, condition, and future are scored."],
                    ["Dashboard", "Tradeoffs and formulas are attached to each ranked home."],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-neutral-100">{label}</p>
                        <p className="text-sm leading-6 text-neutral-400">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-neutral-950">
                    <Home className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-neutral-300">Built to replace the Telegram handoff.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
