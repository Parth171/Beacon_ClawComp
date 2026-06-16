"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, Loader2, Terminal, X } from "lucide-react";

import {
  AGENT_META,
  AGENT_STEPS,
  subTasksForAgent,
  type AnalysisProgressState,
  type AgentStepId,
  type SubTask,
} from "@/lib/agents";
import { cn } from "@/lib/utils";

interface AgentPipelineProps {
  progress: AnalysisProgressState;
}

function progressPercent(progress: AnalysisProgressState): number {
  const completed = AGENT_STEPS.filter(
    (step) => progress.agentStatuses[step.id] === "completed",
  ).length;

  if (progress.isRanking) return 100;
  if (progress.propertyTotal === 0) return 5;

  const base = ((progress.propertyIndex - 1) / progress.propertyTotal) * 100;
  const agentSlice = (1 / progress.propertyTotal) * (100 / AGENT_STEPS.length);
  return Math.min(98, Math.round(base + completed * agentSlice + 2));
}

function SkillBadge({ skill }: { skill: string }) {
  const isOpenClaw = skill.endsWith(".js");
  const isModel = skill.includes("VL") || skill.includes("Qwen");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
        isOpenClaw && "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30",
        isModel && "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30",
        !isOpenClaw && !isModel && "bg-slate-700/80 text-slate-300 ring-1 ring-slate-600",
      )}
    >
      {isOpenClaw ? "skill" : isModel ? "model" : "tool"} · {skill}
    </span>
  );
}

function SubTaskRow({ task }: { task: SubTask }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 rounded-lg bg-slate-900/60 px-3 py-2"
    >
      {task.status === "running" ? (
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-indigo-400" />
      ) : task.status === "error" ? (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
      ) : (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-300">{task.message}</p>
        {task.skill ? (
          <div className="mt-1.5">
            <SkillBadge skill={task.skill} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function AgentNode({
  agentId,
  status,
  isActive,
  subTasks,
}: {
  agentId: AgentStepId;
  status: "pending" | "running" | "completed";
  isActive: boolean;
  subTasks: SubTask[];
}) {
  const step = AGENT_STEPS.find((s) => s.id === agentId)!;
  const meta = AGENT_META[agentId];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-300",
        status === "pending" && "border-slate-800 bg-slate-950/40 opacity-50",
        status === "completed" && "border-slate-700/80 bg-slate-900/50",
        status === "running" && cn("border-indigo-500/40 bg-indigo-500/5", isActive && "animate-[pulse-ring_2s_ease-in-out_infinite]"),
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            meta.bg,
            meta.text,
          )}
        >
          {status === "running" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status === "completed" ? (
            <Check className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{step.shortLabel}</p>
          <p className="truncate text-xs text-slate-500">{step.description}</p>
        </div>
      </div>

      <AnimatePresence>
        {isActive && subTasks.length > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-1.5 overflow-hidden border-t border-slate-800 pt-3"
          >
            {subTasks.map((task) => (
              <SubTaskRow key={task.key} task={task} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentPipeline({ progress }: AgentPipelineProps) {
  const percent = progressPercent(progress);
  const activeId = progress.activeAgentId;
  const activeStep = activeId ? AGENT_STEPS.find((s) => s.id === activeId) : null;
  const intakeTasks = subTasksForAgent(progress.subTasks, "intake");
  const activeSubTasks = activeId
    ? subTasksForAgent(progress.subTasks, activeId)
    : progress.isFetching
      ? intakeTasks
      : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030712]/95 backdrop-blur-xl">
      <div className="h-1 w-full bg-slate-900">
        <div
          className="shimmer-bar h-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <Brain className="h-3.5 w-3.5" />
              CEO orchestrator active
            </div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {progress.isRanking
                ? "Ranking properties…"
                : progress.isFetching
                  ? "Fetching listing from realtor.ca"
                  : activeStep
                    ? activeStep.label
                    : "Preparing analysis"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {progress.stageMessage}
              {progress.propertyLabel ? ` · ${progress.propertyLabel}` : ""}
            </p>
            <p className="mt-1 text-xs tabular-nums text-slate-600">{percent}% complete</p>
          </div>

          {/* Active agent spotlight + live skill trace */}
          <AnimatePresence mode="wait">
            {(activeId || progress.isFetching) && !progress.isRanking ? (
              <motion.div
                key={activeId ?? "intake"}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 to-transparent p-6"
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">
                  <Terminal className="h-4 w-4" />
                  Live skill trace
                </div>
                {activeSubTasks.length > 0 ? (
                  <div className="space-y-2">
                    {activeSubTasks.map((task) => (
                      <SubTaskRow key={task.key} task={task} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Agent started — waiting for skill callbacks…
                  </p>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Pipeline grid */}
          <div className="grid flex-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_STEPS.map((step) => (
              <AgentNode
                key={step.id}
                agentId={step.id}
                status={progress.agentStatuses[step.id]}
                isActive={progress.activeAgentId === step.id}
                subTasks={subTasksForAgent(progress.subTasks, step.id)}
              />
            ))}
          </div>

          {progress.isRanking ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-400"
            >
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              Synthesizing overall scores…
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
