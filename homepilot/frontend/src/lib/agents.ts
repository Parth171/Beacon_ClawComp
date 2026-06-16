import {
  Calculator,
  Eye,
  MapPin,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export const AGENT_STEPS = [
  {
    id: "property_intelligence",
    label: "Property Intelligence",
    shortLabel: "Condition",
    description: "Photos, wear patterns, repair risk",
    icon: Eye,
    color: "violet",
  },
  {
    id: "hidden_cost",
    label: "Hidden Cost",
    shortLabel: "True cost",
    description: "Tax, insurance, utilities, upkeep",
    icon: Calculator,
    color: "amber",
  },
  {
    id: "family_fit",
    label: "Family Fit",
    shortLabel: "Lifestyle",
    description: "Schools, safety, space for your household",
    icon: Users,
    color: "emerald",
  },
  {
    id: "property_value",
    label: "Property Value",
    shortLabel: "Fair value",
    description: "Live comps vs asking price",
    icon: TrendingUp,
    color: "sky",
  },
  {
    id: "future_outlook",
    label: "Future Outlook",
    shortLabel: "Area future",
    description: "Transit, growth, planning signals",
    icon: MapPin,
    color: "cyan",
  },
] as const;

export type AgentStepId = (typeof AGENT_STEPS)[number]["id"];

export type StreamAgentId = AgentStepId | "intake";

export type AgentStepStatus = "pending" | "running" | "completed";

export type SubTaskStatus = "running" | "done" | "error";

export interface SubTask {
  key: string;
  taskId: string;
  agent: StreamAgentId;
  message: string;
  skill: string | null;
  status: SubTaskStatus;
  detail: string | null;
  updatedAt: number;
}

export interface AnalysisProgressState {
  stageMessage: string | null;
  stage: string | null;
  propertyLabel: string | null;
  propertyIndex: number;
  propertyTotal: number;
  agentStatuses: Record<AgentStepId, AgentStepStatus>;
  activeAgentId: AgentStepId | null;
  activeAgentMessage: string | null;
  isRanking: boolean;
  isFetching: boolean;
  subTasks: SubTask[];
}

export const AGENT_META: Record<
  AgentStepId,
  { icon: LucideIcon; color: string; ring: string; bg: string; text: string }
> = {
  property_intelligence: {
    icon: Eye,
    color: "violet",
    ring: "ring-violet-500/50",
    bg: "bg-violet-500/15",
    text: "text-violet-300",
  },
  hidden_cost: {
    icon: Calculator,
    color: "amber",
    ring: "ring-amber-500/50",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
  family_fit: {
    icon: Users,
    color: "emerald",
    ring: "ring-emerald-500/50",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  property_value: {
    icon: TrendingUp,
    color: "sky",
    ring: "ring-sky-500/50",
    bg: "bg-sky-500/15",
    text: "text-sky-300",
  },
  future_outlook: {
    icon: MapPin,
    color: "cyan",
    ring: "ring-cyan-500/50",
    bg: "bg-cyan-500/15",
    text: "text-cyan-300",
  },
};

export const initialAnalysisProgressState = (): AnalysisProgressState => ({
  stageMessage: "Initializing agents…",
  stage: null,
  propertyLabel: null,
  propertyIndex: 0,
  propertyTotal: 0,
  agentStatuses: Object.fromEntries(
    AGENT_STEPS.map((step) => [step.id, "pending"]),
  ) as Record<AgentStepId, AgentStepStatus>,
  activeAgentId: null,
  activeAgentMessage: null,
  isRanking: false,
  isFetching: false,
  subTasks: [],
});

export function subTasksForAgent(
  subTasks: SubTask[],
  agentId: StreamAgentId,
): SubTask[] {
  return subTasks.filter((task) => task.agent === agentId);
}

export function applyProgressEvent(
  state: AnalysisProgressState,
  event: ProgressEvent,
): AnalysisProgressState {
  switch (event.type) {
    case "stage":
      return {
        ...state,
        stage: event.stage,
        stageMessage: event.message,
        isRanking: event.stage === "ranking",
        isFetching: event.stage === "fetching_listings",
        activeAgentId: event.stage === "ranking" ? null : state.activeAgentId,
        activeAgentMessage:
          event.stage === "ranking" ? event.message : state.activeAgentMessage,
        propertyTotal: event.property_total ?? state.propertyTotal,
      };
    case "property_started":
      return {
        ...state,
        stageMessage: event.message,
        propertyLabel: event.label,
        propertyIndex: event.property_index,
        propertyTotal: event.property_total,
        isRanking: false,
        activeAgentId: null,
        activeAgentMessage: null,
        subTasks: [],
        agentStatuses: Object.fromEntries(
          AGENT_STEPS.map((step) => [step.id, "pending"]),
        ) as Record<AgentStepId, AgentStepStatus>,
      };
    case "agent_started":
      return {
        ...state,
        stageMessage: event.message,
        activeAgentId: event.agent,
        activeAgentMessage: event.message,
        agentStatuses: {
          ...state.agentStatuses,
          [event.agent]: "running",
        },
      };
    case "agent_completed":
      return {
        ...state,
        agentStatuses: {
          ...state.agentStatuses,
          [event.agent]: "completed",
        },
        activeAgentId:
          state.activeAgentId === event.agent ? null : state.activeAgentId,
        activeAgentMessage:
          state.activeAgentId === event.agent ? null : state.activeAgentMessage,
      };
    case "sub_task": {
      const key = `${event.agent}:${event.task_id}`;
      const next: SubTask = {
        key,
        taskId: event.task_id,
        agent: event.agent,
        message: event.message,
        skill: event.skill ?? null,
        status: event.status,
        detail: event.detail ?? null,
        updatedAt: Date.now(),
      };
      const exists = state.subTasks.some((task) => task.key === key);
      return {
        ...state,
        subTasks: exists
          ? state.subTasks.map((task) => (task.key === key ? next : task))
          : [...state.subTasks, next],
      };
    }
    case "property_completed":
      return {
        ...state,
        stageMessage: `Finished analyzing ${event.label}`,
      };
    default:
      return state;
  }
}

export type ProgressEvent =
  | {
      type: "stage";
      stage: string;
      message: string;
      listing_count?: number;
      property_total?: number;
    }
  | {
      type: "property_started";
      property_id: string;
      property_index: number;
      property_total: number;
      label: string;
      message: string;
    }
  | {
      type: "agent_started";
      agent: AgentStepId;
      property_id: string;
      message: string;
    }
  | {
      type: "agent_completed";
      agent: AgentStepId;
      property_id: string;
    }
  | {
      type: "sub_task";
      agent: StreamAgentId;
      property_id?: string;
      task_id: string;
      message: string;
      skill?: string | null;
      status: SubTaskStatus;
      detail?: string | null;
    }
  | {
      type: "property_completed";
      property_id: string;
      property_index: number;
      property_total: number;
      label: string;
    }
  | {
      type: "complete";
      result: unknown;
    }
  | {
      type: "error";
      message: string;
      status?: number;
    };
