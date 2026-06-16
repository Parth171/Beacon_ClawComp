"""Single-thread executor for MLX/Metal inference.

MLX's Metal backend is not safe to drive from arbitrary threads: initializing model
buffers on one thread and then running generation on another (as ``asyncio.to_thread``
does, since it uses a multi-thread pool) intermittently segfaults the process. Pinning
*all* MLX work to one dedicated thread gives Metal consistent thread affinity.

Text and vision share this single worker on purpose — they share the GPU, so
serializing them is correct, and it guarantees every MLX call runs on the same thread.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_executor: ThreadPoolExecutor | None = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")
    return _executor


async def run_on_mlx_thread(fn: Callable[..., T], *args: Any) -> T:
    """Run a blocking MLX call on the dedicated MLX thread, awaitably."""

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_get_executor(), fn, *args)
