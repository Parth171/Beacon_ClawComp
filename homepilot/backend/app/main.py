from fastapi import FastAPI

from app.api.recommendations import router as recommendations_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.include_router(recommendations_router, prefix=settings.api_prefix)
    return app


app = create_app()
