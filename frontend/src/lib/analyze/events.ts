import { Link2, ScanEye, type LucideIcon } from "lucide-react";

import type { AnalyzeReport, CanonicalProperty } from "./types";

/** The two agents wired in this pass: scrape, then inspect. */
export const AGENT_STEPS: ReadonlyArray<{
  id: AgentId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "data_collection",
    label: "Data collection",
    description: "Scraping the listing — price, address, photos",
    icon: Link2,
  },
  {
    id: "inspection",
    label: "Inspection",
    description: "Vision model scores each photo, then checks municipal records",
    icon: ScanEye,
  },
];

export type AgentId = "data_collection" | "inspection";
export type AgentStatus = "pending" | "running" | "completed";
export type SubTaskStatus = "running" | "done" | "error";

export interface PhotoFlag {
  issue: string;
  location?: string | null;
  confidence: number;
}

export interface SubTask {
  key: string;
  agent: AgentId;
  taskId: string;
  message: string;
  skill: string | null;
  status: SubTaskStatus;
}

/** One listing photo as the vision model works through it, for the live grid. */
export interface InspectedPhoto {
  imageIndex: number;
  imageUrl: string | null;
  status: SubTaskStatus;
  hasIssues?: boolean;
  flags?: PhotoFlag[];
}

export interface AnalyzeState {
  phase: "running" | "complete" | "error";
  runId: string | null;
  listingUrl: string | null;
  agentStatuses: Record<AgentId, AgentStatus>;
  activeAgent: AgentId | null;
  property: CanonicalProperty | null;
  subTasks: SubTask[];
  photos: InspectedPhoto[];
  errorMessage: string | null;
}

interface SubTaskData {
  imageIndex?: number;
  imageUrl?: string | null;
  hasIssues?: boolean;
  flags?: PhotoFlag[];
  counts?: Record<string, number>;
  resolved?: string;
  bbl?: string;
}

/**
 * The SSE event contract. Note the dual casing: the high-level lifecycle events
 * use camelCase (`runId`), while forwarded `sub_task` events keep the backend
 * emitter's snake_case (`task_id`/`run_id`).
 */
export type ProgressEvent =
  | { type: "run_started"; runId: string; listingUrl: string }
  | { type: "agent_started"; agent: AgentId; runId: string }
  | { type: "agent_completed"; agent: AgentId; runId: string; property?: CanonicalProperty }
  | {
      type: "sub_task";
      agent: AgentId;
      run_id?: string;
      task_id: string;
      message: string;
      skill?: string | null;
      status: SubTaskStatus;
      detail?: string | null;
      data?: SubTaskData | null;
    }
  | { type: "complete"; result: AnalyzeReport }
  | { type: "error"; message: string; status?: number };

export const initialAnalyzeState = (listingUrl: string): AnalyzeState => ({
  phase: "running",
  runId: null,
  listingUrl,
  agentStatuses: { data_collection: "pending", inspection: "pending" },
  activeAgent: null,
  property: null,
  subTasks: [],
  photos: [],
  errorMessage: null,
});

export function subTasksForAgent(subTasks: SubTask[], agent: AgentId): SubTask[] {
  return subTasks.filter((task) => task.agent === agent);
}

function upsertPhoto(
  photos: InspectedPhoto[],
  data: SubTaskData,
  status: SubTaskStatus,
): InspectedPhoto[] {
  if (typeof data.imageIndex !== "number") return photos;
  const idx = data.imageIndex;
  const prev = photos.find((p) => p.imageIndex === idx);
  const merged: InspectedPhoto = {
    imageIndex: idx,
    imageUrl: data.imageUrl ?? prev?.imageUrl ?? null,
    status,
    hasIssues: data.hasIssues ?? prev?.hasIssues,
    flags: data.flags ?? prev?.flags,
  };
  if (prev) {
    return photos.map((p) => (p.imageIndex === idx ? merged : p));
  }
  return [...photos, merged].sort((a, b) => a.imageIndex - b.imageIndex);
}

export function applyEvent(state: AnalyzeState, event: ProgressEvent): AnalyzeState {
  switch (event.type) {
    case "run_started":
      return { ...state, runId: event.runId, listingUrl: event.listingUrl };

    case "agent_started":
      return {
        ...state,
        activeAgent: event.agent,
        agentStatuses: { ...state.agentStatuses, [event.agent]: "running" },
      };

    case "agent_completed":
      return {
        ...state,
        property: event.property ?? state.property,
        activeAgent: state.activeAgent === event.agent ? null : state.activeAgent,
        agentStatuses: { ...state.agentStatuses, [event.agent]: "completed" },
      };

    case "sub_task": {
      // The per-generation `vision_llm` ticks are low-level noise — fold them away.
      if (event.task_id === "vision_llm") return state;

      const key = `${event.agent}:${event.task_id}`;
      const task: SubTask = {
        key,
        agent: event.agent,
        taskId: event.task_id,
        message: event.message,
        skill: event.skill ?? null,
        status: event.status,
      };
      const exists = state.subTasks.some((t) => t.key === key);
      const subTasks = exists
        ? state.subTasks.map((t) => (t.key === key ? task : t))
        : [...state.subTasks, task];

      const photos =
        event.task_id === "inspection_image" && event.data
          ? upsertPhoto(state.photos, event.data, event.status)
          : state.photos;

      return { ...state, subTasks, photos };
    }

    case "complete":
      return { ...state, phase: "complete", activeAgent: null };

    case "error":
      return { ...state, phase: "error", errorMessage: event.message };

    default:
      return state;
  }
}
