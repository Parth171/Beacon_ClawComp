from fastapi import FastAPI

from app.api.analyze import router as analyze_router
from app.api.health import router as health_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(analyze_router, prefix=settings.api_prefix)
    return app


app = create_app()
