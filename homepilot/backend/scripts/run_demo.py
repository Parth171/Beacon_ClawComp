import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


async def main() -> None:
    from app.agents import CEOAgent
    from app.services.data_sources import load_demo_recommendation_request

    request = load_demo_recommendation_request()
    response = await CEOAgent().run(request)
    print(response.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())
