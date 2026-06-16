from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HomePilot"
    api_prefix: str = "/api/v1"

    # CEO aggregation weights (must cover the five specialists; normalized at use).
    weight_family_fit: float = 0.25
    weight_property_value: float = 0.25
    weight_future_outlook: float = 0.20
    weight_property_quality: float = 0.15
    weight_hidden_cost: float = 0.15

    # Property Intelligence vision (Qwen2.5-VL via Ollama).
    vision_enabled: bool = True
    ollama_base_url: str = "http://127.0.0.1:11434"
    vision_model: str = "qwen2.5vl:7b"
    vision_max_images: int = 8
    vision_image_max_side: int = 1024
    vision_timeout_seconds: float = 180.0

    model_config = SettingsConfigDict(env_file=".env", env_prefix="HOMEPILOT_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
