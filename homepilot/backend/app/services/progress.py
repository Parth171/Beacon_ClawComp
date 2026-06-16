"""Subtask progress streaming.

Lets deeply-nested services (skills like fetch-comps, image prep, the vision
model) report fine-grained "what am I doing right now" updates without threading
a callback through every function signature. A ContextVar holds the active
emitter; ``stream_with_subtasks`` runs a coroutine while draining those updates
so the CEO/API streams can forward them to the browser as ``sub_task`` events.
"""

from __future__ import annotations

import asyncio
import contextvars
from dataclasses import dataclass
from typing import Any, AsyncIterator, Coroutine, TypeVar

T = TypeVar("T")


@dataclass
class _Emitter:
    queue: asyncio.Queue[dict[str, Any]]
    agent: str
    property_id: str | None

    def emit(self, payload: dict[str, Any]) -> None:
        event = {
            "type": "sub_task",
            "agent": self.agent,
            "property_id": self.property_id,
            **payload,
        }
        self.queue.put_nowait(event)


_current: contextvars.ContextVar[_Emitter | None] = contextvars.ContextVar(
    "homepilot_subtask_emitter", default=None
)


async def report_subtask(
    task_id: str,
    message: str,
    *,
    skill: str | None = None,
    status: str = "running",
    detail: str | None = None,
) -> None:
    """Report a subtask update from anywhere inside an active agent run.

    No-op when called outside a ``stream_with_subtasks`` context (e.g. tests,
    the non-streaming endpoint), so services can call it unconditionally.
    """

    emitter = _current.get()
    if emitter is None:
        return
    emitter.emit(
        {
            "task_id": task_id,
            "message": message,
            "skill": skill,
            "status": status,
            "detail": detail,
        }
    )


async def stream_with_subtasks(
    coro: Coroutine[Any, Any, T],
    *,
    agent: str,
    property_id: str | None = None,
    poll_interval: float = 0.08,
) -> AsyncIterator[tuple[str, Any]]:
    """Run ``coro`` while yielding its subtask events as they happen.

    Yields ``("sub_task", event)`` tuples until the coroutine completes, then a
    final ``("result", value)`` tuple carrying the return value.
    """

    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    emitter = _Emitter(queue=queue, agent=agent, property_id=property_id)
    token = _current.set(emitter)
    task: asyncio.Task[T] = asyncio.create_task(coro)
    try:
        while True:
            done, _ = await asyncio.wait({task}, timeout=poll_interval)
            while not queue.empty():
                yield "sub_task", queue.get_nowait()
            if task in done:
                break
    finally:
        _current.reset(token)

    while not queue.empty():
        yield "sub_task", queue.get_nowait()

    yield "result", task.result()
