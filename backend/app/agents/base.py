from abc import ABC, abstractmethod
from typing import Generic, TypeVar

InputT = TypeVar("InputT")
OutputT = TypeVar("OutputT")


class Agent(ABC, Generic[InputT, OutputT]):
    """Base protocol for all DealSense agents.

    Each agent reads a typed input (often including upstream agents' evidence) and
    returns a structured, schema-validated result. No free-text handoffs.
    """

    name: str

    @abstractmethod
    async def run(self, payload: InputT) -> OutputT:
        """Execute the agent and return a structured result."""
