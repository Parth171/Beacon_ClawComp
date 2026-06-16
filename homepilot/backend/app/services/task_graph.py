from dataclasses import dataclass, field


@dataclass(frozen=True)
class TaskNode:
    """A unit of work the CEO agent can dispatch to a specialist agent."""

    id: str
    agent_name: str
    depends_on: tuple[str, ...] = ()


@dataclass(frozen=True)
class TaskGraph:
    """Minimal task graph representation for future OpenClaw integration."""

    nodes: tuple[TaskNode, ...] = field(default_factory=tuple)
