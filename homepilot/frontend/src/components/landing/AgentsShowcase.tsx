"use client";

import {
  Camera,
  DollarSign,
  Home,
  MapPin,
  TrendingUp,
} from "lucide-react";

import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { AGENT_STEPS } from "@/lib/agents";

const agentIcons: Record<string, React.ReactNode> = {
  property_intelligence: <Camera className="h-5 w-5 text-sky-500" />,
  hidden_cost: <DollarSign className="h-5 w-5 text-emerald-500" />,
  family_fit: <Home className="h-5 w-5 text-violet-500" />,
  property_value: <MapPin className="h-5 w-5 text-amber-500" />,
  future_outlook: <TrendingUp className="h-5 w-5 text-rose-500" />,
};

const agentGradients: Record<string, string> = {
  property_intelligence: "from-sky-500/20 to-sky-500/5",
  hidden_cost: "from-emerald-500/20 to-emerald-500/5",
  family_fit: "from-violet-500/20 to-violet-500/5",
  property_value: "from-amber-500/20 to-amber-500/5",
  future_outlook: "from-rose-500/20 to-rose-500/5",
};

export default function AgentsShowcase() {
  return (
    <section id="agents" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-sky-600">
            Specialist agents
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-5xl">
            Five experts.{" "}
            <span className="font-serif italic text-neutral-500">One recommendation.</span>
          </h2>
          <p className="mt-5 text-base leading-7 text-neutral-600">
            Each agent focuses on a dimension listings hide or gloss over. A CEO orchestrator
            weighs the tradeoffs and ranks your shortlist.
          </p>
        </div>

        <div className="mt-14">
          <BentoGrid>
            {AGENT_STEPS.map((agent, index) => (
              <BentoGridItem
                key={agent.id}
                title={agent.label}
                description={agent.description}
                className={index === 0 || index === 3 ? "md:col-span-2" : ""}
                icon={agentIcons[agent.id]}
                header={
                  <div
                    className={`flex h-28 w-full flex-1 items-center justify-center rounded-2xl bg-gradient-to-br ${agentGradients[agent.id]}`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 transition group-hover/bento:scale-105">
                      {agentIcons[agent.id]}
                    </div>
                  </div>
                }
              />
            ))}
            <BentoGridItem
              className="md:col-span-3"
              title="CEO Orchestrator"
              description="Synthesizes all agent outputs into a single ranked recommendation with transparent tradeoffs and confidence scores."
              icon={<span className="text-xs font-mono text-neutral-400">CEO</span>}
              header={
                <div className="flex h-20 w-full flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800">
                  <p className="text-sm font-medium text-neutral-300">
                    Ranked shortlist · Deal scores · Tradeoff analysis
                  </p>
                </div>
              }
            />
          </BentoGrid>
        </div>
      </div>
    </section>
  );
}
