"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroVisual } from "@/components/sections/hero-visual";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function Hero() {
  const reduce = useReducedMotion();
  const up = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: EASE },
        };

  return (
    <section
      id="hero"
      className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8 lg:pb-28 lg:pt-40"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <motion.div {...up(0)}>
            <Eyebrow>Autonomous real-estate</Eyebrow>
          </motion.div>

          <motion.h1
            {...up(0.06)}
            className="mt-6 max-w-2xl font-serif text-[3.25rem] font-normal leading-[1.02] tracking-[-0.015em] text-ink sm:text-7xl lg:text-[5.25rem]"
          >
            Underwrite any deal in minutes.
          </motion.h1>

          <motion.p
            {...up(0.12)}
            className="mt-7 max-w-md text-lg leading-relaxed text-ink-muted"
          >
            <span className="font-medium text-accent">Beacon</span> turns a listing URL into an
            evidence-backed BUY or PASS. Six specialist agents inspect the photos, price the deal,
            and map the neighborhood — all running locally.
          </motion.p>

          <motion.div {...up(0.18)} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="#cta" variant="primary" className="px-6">
              Request a demo
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="#pipeline" variant="secondary" className="px-6">
              Watch the workflow
            </Button>
          </motion.div>
        </div>

        <motion.div
          {...(reduce
            ? {}
            : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 1, delay: 0.2 } })}
          className="flex justify-center lg:justify-end"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
