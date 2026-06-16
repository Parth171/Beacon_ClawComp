"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { BackgroundBeams } from "@/components/ui/background-beams";
import { Spotlight } from "@/components/ui/spotlight";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-1/2" fill="white" />
      <BackgroundBeams />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Autonomous buyer&apos;s agent · not a listing site
        </motion.div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          <span className="gradient-text">Bridge today&apos;s you</span>
          <br />
          <span className="text-white">with tomorrow&apos;s home.</span>
        </h1>

        <div className="mx-auto mt-6 max-w-2xl">
          <TextGenerateEffect
            words="HomePilot runs specialist agents that inspect photos, uncover hidden costs, compare fair value, and surface what the listing won't tell you — unbiased."
            className="text-base font-normal text-slate-400 sm:text-lg"
            duration={0.35}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-widest text-slate-500"
        >
          <span>5 specialist agents</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>Live skill traces</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>Full math transparency</span>
        </motion.div>
      </div>
    </section>
  );
}
