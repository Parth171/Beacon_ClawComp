from __future__ import annotations

from pydantic import BaseModel, Field


class BuyerProfile(BaseModel):
    """User preferences and household context used by the buyer's agent."""

    id: str | None = None
    budget: int = Field(gt=0)
    children: int = Field(default=0, ge=0)
    dog: bool = False
    work_location: str | None = None
    preferred_city: str | None = None
    max_commute_minutes: int | None = Field(default=None, gt=0)

    # Autonomy fields: where Scout watches and how it reaches the user.
    telegram_chat_id: str | None = None
    watched_area: str | None = None
    min_bedrooms: int | None = Field(default=None, ge=0)
    alert_threshold: float = Field(default=80.0, ge=0, le=100)
