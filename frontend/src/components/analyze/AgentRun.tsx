"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";

import { PhotoGrid } from "@/components/analyze/PhotoGrid";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  AGENT_STEPS,
  subTasksForAgent,
  type AgentId,
  type AnalyzeState,
  type SubTask,
} from "@/lib/analyze/events";
import { formatMoney, hostOf } from "@/lib/analyze/format";
import { cn } from "@/lib/utils";

function progressPercent(state: AnalyzeState): number {
  if (state.phase === "complete") return 100;
  const dc = state.agentStatuses.data_collection;
  const insp = state.agentStatuses.inspection;
  if (dc === "pending") return 6;
  if (dc === "running") return 18;
  if (insp === "pending") return 42;
  if (insp === "running") {
    const done = state.photos.filter((p) => p.status !== "running").length;
    const seen = state.photos.length;
    const ratio = seen ? done / Math.max(seen, 1) : 0;
    return Math.min(92, 48 + Math.round(ratio * 44));
  }
  return 96;
}

function headlineFor(state: AnalyzeState): string {
  if (state.activeAgent === "data_collection") return "Reading the listing";
  if (state.activeAgent === "inspection") return "Inspecting the photos";
  if (state.agentStatuses.inspection === "completed") return "Compiling the findings";
  return "Starting the pipeline";
}

function skillKind(skill: string): "skill" | "model" | "tool" {
  if (skill.endsWith(".js")) return "skill";
  if (/mlx|qwen|llama|vl\b/i.test(skill)) return "model";
  return "tool";
}

function SkillBadge({ skill }: { skill: string }) {
  const kind = skillKind(skill);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        kind === "model"
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-line bg-sand text-ink-muted",
      )}
    >
      {kind} · {skill}
    </span>
  );
}

function SubTaskRow({ task }: { task: SubTask }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2.5 py-1.5"
    >
      <span className="mt-0.5 shrink-0">
        {task.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : task.status === "error" ? (
          <X className="h-3.5 w-3.5 text-red-700" />
        ) : (
          <Check className="h-3.5 w-3.5 text-ink-faint" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{task.message}</p>
        {task.skill ? (
          <div className="mt-1">
            <SkillBadge skill={task.skill} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function AgentCard({
  agentId,
  state,
}: {
  agentId: AgentId;
  state: AnalyzeState;
}) {
  const step = AGENT_STEPS.find((s) => s.id === agentId)!;
  const status = state.agentStatuses[agentId];
  const isActive = state.activeAgent === agentId;
  const tasks = subTasksForAgent(state.subTasks, agentId);
  const Icon = step.icon;

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border p-5 transition-colors",
        status === "pending" && "border-line bg-canvas opacity-55",
        status === "running" && "border-accent/40 bg-accent/[0.03]",
        status === "completed" && "border-line bg-sand/50",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border",
            status === "running"
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-line bg-canvas text-ink-muted",
          )}
        >
          {status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "completed" ? (
            <Check className="h-4 w-4 text-ink" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{step.label}</p>
          <p className="truncate text-xs text-ink-muted">{step.description}</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {status}
        </span>
      </div>

      <AnimatePresence>
        {tasks.length > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 overflow-hidden border-t border-line pt-2"
          >
            <div className="divide-y divide-line/60">
              {tasks.map((task) => (
                <SubTaskRow key={task.key} task={task} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {agentId === "inspection" && (isActive || state.photos.length > 0) ? (
        <div className="mt-4">
          <PhotoGrid photos={state.photos} />
        </div>
      ) : null}
    </motion.div>
  );
}

export function AgentRun({ state }: { state: AnalyzeState }) {
  const percent = progressPercent(state);
  const prop = state.property;
  const host = hostOf(state.listingUrl);

  return (
    <div className="mx-auto max-w-3xl">
      {/* progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mt-7 text-center">
        <Eyebrow className="justify-center">
          {host ? `Underwriting · ${host}` : "Underwriting"}
        </Eyebrow>
        <h2 className="mt-4 font-serif text-3xl font-normal leading-tight tracking-[-0.01em] text-ink sm:text-4xl">
          {headlineFor(state)}
        </h2>
        {prop ? (
          <p className="mt-3 text-sm text-ink-muted">
            {prop.address ?? prop.listingUrl}
            {prop.price ? ` · ${formatMoney(prop.price)}` : ""}
            {prop.images?.length ? ` · ${prop.images.length} photos` : ""}
          </p>
        ) : (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {percent}% complete
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-3">
        {AGENT_STEPS.map((step) => (
          <AgentCard key={step.id} agentId={step.id} state={state} />
        ))}
      </div>
    </div>
  );
}
