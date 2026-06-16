from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DealSense"
    api_prefix: str = "/api/v1"

    # --- Inference (local, Apple Silicon / MLX) -------------------------------
    # "auto"  -> use MLX if importable + model present, else fall back to stub.
    # "mlx"   -> require MLX (raises if unavailable).
    # "stub"  -> deterministic fake client (dev/test, no models needed).
    inference_backend: Literal["auto", "mlx", "stub"] = "auto"

    text_model: str = "mlx-community/Meta-Llama-3-8B-Instruct-4bit"
    text_max_tokens: int = 1024
    text_temperature: float = 0.0

    vision_model: str = "mlx-community/Qwen2.5-VL-7B-Instruct-4bit"
    vision_max_images: int = 8
    # 1024 is needed for Qwen2.5-VL-7B-4bit to resolve thin defects (e.g. hairline
    # foundation cracks) that vanish when downscaled to 768. This was previously
    # capped at 768 because 1024 segfaulted MLX, but the per-image _clear_cache() in
    # MLXVisionClient now releases Metal buffers between photos; verified stable over
    # 8 sequential full-resolution generations.
    vision_image_max_side: int = 1024
    vision_max_tokens: int = 640
    vision_temperature: float = 0.0

    # --- Agent 4 RAG ----------------------------------------------------------
    embeddings_model: str = "BAAI/bge-small-en-v1.5"
    qdrant_path: str = "./.qdrant"  # local on-disk Qdrant

    # --- Agent 1 data collection (OpenClaw Node skills) ----------------------
    openclaw_fetch_listings_path: str = (
        "~/.openclaw/workspace/skills/fetch-listings.js"
    )
    openclaw_node_bin: str = "node"
    openclaw_timeout_seconds: float = 90.0

    # --- Ledger ---------------------------------------------------------------
    ledger_db_path: str = "./dealsense.db"

    # --- Agent 6 (only external call) ----------------------------------------
    pandadoc_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_prefix="DEALSENSE_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
