"""Smoke-test Agent 3's production InspectionAgent path with local defect images.

Run from backend:
    DEALSENSE_INFERENCE_BACKEND=mlx ./.venv-mlx/bin/python scripts/test_inspection_agent.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2

BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DEALSENSE_INFERENCE_BACKEND", "mlx")

from app.agents.inspection import InspectionAgent, InspectionInput
from app.core.config import get_settings
from app.models.property import CanonicalProperty
from app.services.image_prep import _encode_jpeg, _resize

CASES = {
    "crack": Path("scripts/crack.jpg"),
    "water": Path("scripts/water-leak.jpg"),
}

@dataclass
class LocalPreparedImage:
    jpeg_base64: str
    url: str


async def preparer(_urls: list[str]) -> list[LocalPreparedImage]:
    settings = get_settings()
    prepared: list[LocalPreparedImage] = []

    for path in CASES.values():
        image = cv2.imread(str(path))
        if image is None:
            raise RuntimeError(f"Could not read {path}")

        resized = _resize(image, settings.vision_image_max_side)
        encoded = _encode_jpeg(resized)
        if not encoded:
            raise RuntimeError(f"Could not encode {path}")

        prepared.append(LocalPreparedImage(jpeg_base64=encoded, url=str(path)))

    return prepared


def has_issue(result, image_name: str, keywords: list[str]) -> bool:
    for item in result.per_image:
        if image_name not in (item.image_url or ""):
            continue

        risk_match = False
        if {"foundation", "structural", "crack"} & set(keywords):
            risk_match = item.foundation_risk >= 0.5
        if {"water", "leak", "stain", "damage"} & set(keywords):
            risk_match = risk_match or item.water_risk >= 0.5

        flag_text = " ".join(
            f"{flag.issue} {flag.location or ''} {flag.reason or ''}".lower()
            for flag in item.flags
        )

        flag_match = any(keyword in flag_text for keyword in keywords)
        return risk_match or flag_match

    return False


async def main() -> int:
    prop = CanonicalProperty(price=820000, images=[str(path) for path in CASES.values()])
    result = await InspectionAgent(image_preparer=preparer).run(
        InspectionInput(property=prop)
    )

    data = result.model_dump(by_alias=True)
    print(json.dumps(data, indent=2), flush=True)

    water_ok = has_issue(result, "water-leak.jpg", ["water", "leak", "stain", "damage"])
    crack_ok = has_issue(result, "crack.jpg", ["foundation", "structural", "crack"])

    print("\nChecks:", flush=True)
    print(f"  water damage detected: {water_ok}", flush=True)
    print(f"  foundation/crack detected: {crack_ok}", flush=True)

    if not water_ok:
        print("\nFAIL: water damage sample was not detected", flush=True)
        return 1

    if not crack_ok:
        print("\nFAIL: crack/foundation sample was not detected. This reproduces the Agent 3 risk.", flush=True)
        return 1

    print("\nPASS: Agent 3 detected both defect samples.", flush=True)
    return 0

exit_code = asyncio.run(main())
sys.stdout.flush()
sys.stderr.flush()
os._exit(exit_code)