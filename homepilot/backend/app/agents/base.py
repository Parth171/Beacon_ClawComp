from abc import ABC, abstractmethod
from typing import Generic, TypeVar

InputT = TypeVar("InputT")
OutputT = TypeVar("OutputT")


class Agent(ABC, Generic[InputT, OutputT]):
    """Base protocol for all HomePilot agents."""

    name: str

    @abstractmethod
    async def run(self, payload: InputT) -> OutputT:
        """Execute the agent and return a structured result."""
