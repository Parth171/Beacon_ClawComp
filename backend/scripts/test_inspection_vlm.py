"""Run Agent 3's Qwen2.5-VL inspection path on listing or defect photos.

Fetches listing details with Agent 1, prepares listing photos with OpenCV, then
runs the local Qwen2.5-VL 7B 4-bit model through mlx-vlm. You can also bypass
the listing fetch and pass direct defect photos with ``--image-file`` or
``--image-url``.

Usage:
    cd backend
    .venv-mlx/bin/python scripts/test_inspection_vlm.py "<realtor.ca listing url>"
    .venv-mlx/bin/python scripts/test_inspection_vlm.py --image-file ./crack.jpg
    .venv-mlx/bin/python scripts/test_inspection_vlm.py --image-url "https://..."

Example:
    .venv-mlx/bin/python scripts/test_inspection_vlm.py \
        "https://www.realtor.ca/real-estate/29867678/18-535-windflower-crescent-kitchener"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

DEFAULT_URL = (
    "https://www.realtor.ca/real-estate/29867678/"
    "18-535-windflower-crescent-kitchener"
)

INSPECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "repairRisk": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Overall visible repair risk from 0 to 100.",
        },
        "renovationScore": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Visible renovation/readiness score from 0 to 100.",
        },
        "estimatedRepairCost": {
            "type": "integer",
            "minimum": 0,
            "description": "Rough CAD estimate for visible repair concerns only.",
        },
        "evidence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["visual_flag"]},
                    "issue": {"type": "string"},
                    "imageIndex": {"type": "integer"},
                    "reason": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "weight": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": [
                    "type",
                    "issue",
                    "imageIndex",
                    "reason",
                    "confidence",
                    "weight",
                ],
            },
        },
    },
    "required": ["repairRisk", "renovationScore", "estimatedRepairCost", "evidence"],
}


def build_prompt(address: str | None, price: int | None, image_count: int) -> str:
    return f"""
You are Agent 3, the Inspection Intelligence Engine for DealSense.

Analyze the provided real estate listing photos for visible condition issues.
Focus on observable signs only: water damage, roof or exterior deterioration,
foundation cracks, electrical hazards, outdated systems, neglected finishes,
or renovation opportunities.

Listing:
- Address: {address or "unknown"}
- Price CAD: {price if price is not None else "unknown"}
- Photos provided: {image_count}

Return conservative JSON only. Use imageIndex values starting at 0 for the images
in this request. If a concern is uncertain, include it only when useful for human
review and set a lower confidence. The evidence array must contain actual visible
concerns only; do not add evidence entries that say no issue was found.
""".strip()


def remove_non_flags(result: dict[str, Any]) -> dict[str, Any]:
    """Keep the raw VLM test usable when it reports absences as evidence."""

    negative_phrases = (
        "no visible",
        "no signs",
        "no issue",
        "appear intact",
        "appears well-maintained",
        "appears in good condition",
    )
    cleaned = dict(result)
    cleaned["evidence"] = [
        item
        for item in result.get("evidence", [])
        if not any(
            phrase in f"{item.get('issue', '')} {item.get('reason', '')}".lower()
            for phrase in negative_phrases
        )
    ]
    return cleaned


async def load_image_urls(urls: list[str], *, max_side: int) -> list[dict[str, Any]]:
    import cv2
    import httpx
    import numpy as np

    from app.services.image_prep import _encode_jpeg, _resize

    loaded = []
    headers = {"User-Agent": "DealSense-Agent3-Test/0.1"}
    async with httpx.AsyncClient(
        timeout=30.0, follow_redirects=True, headers=headers
    ) as client:
        for url in urls:
            response = await client.get(url)
            response.raise_for_status()
            image = cv2.imdecode(np.frombuffer(response.content, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError(f"Could not decode image URL: {url}")
            resized = _resize(image, max_side)
            encoded = _encode_jpeg(resized)
            if encoded is None:
                raise ValueError(f"Could not encode image URL: {url}")
            height, width = resized.shape[:2]
            loaded.append({"source": url, "base64": encoded, "width": width, "height": height})
    return loaded


def load_image_files(paths: list[str], *, max_side: int) -> list[dict[str, Any]]:
    import cv2

    from app.services.image_prep import _encode_jpeg, _resize

    loaded = []
    for raw_path in paths:
        path = Path(raw_path).expanduser()
        image = cv2.imread(str(path))
        if image is None:
            raise ValueError(f"Could not decode image file: {path}")
        resized = _resize(image, max_side)
        encoded = _encode_jpeg(resized)
        if encoded is None:
            raise ValueError(f"Could not encode image file: {path}")
        height, width = resized.shape[:2]
        loaded.append({"source": str(path), "base64": encoded, "width": width, "height": height})
    return loaded


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test Agent 3 Qwen2.5-VL/mlx-vlm inspection on listing or defect photos."
    )
    parser.add_argument("url", nargs="?", default=DEFAULT_URL, help="Listing URL to inspect")
    parser.add_argument(
        "--image-file",
        action="append",
        default=[],
        help="Local image file to inspect. Repeat for multiple images.",
    )
    parser.add_argument(
        "--image-url",
        action="append",
        default=[],
        help="Direct image URL to inspect. Repeat for multiple images.",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=4,
        help="Maximum prepared listing photos to send to the VLM.",
    )
    args = parser.parse_args()

    from app.agents.data_collection import DataCollectionAgent, DataCollectionInput
    from app.core.config import get_settings
    from app.services.image_prep import prepare_listing_images
    from app.services.inference.mlx_vision import MLXVisionClient

    settings = get_settings()

    if args.image_file or args.image_url:
        direct_images = []
        if args.image_file:
            direct_images.extend(load_image_files(args.image_file, max_side=settings.vision_image_max_side))
        if args.image_url:
            direct_images.extend(
                await load_image_urls(args.image_url, max_side=settings.vision_image_max_side)
            )
        prepared_base64 = [image["base64"] for image in direct_images]
        prompt = build_prompt("direct defect-photo test", None, len(prepared_base64))

        print(f"Loaded {len(direct_images)} direct test image(s):")
        for index, image in enumerate(direct_images):
            print(f"  image {index}: {image['width']}x{image['height']}, source={image['source']}")
    else:
        print(f"Fetching listing: {args.url}")
        listing = await DataCollectionAgent().run(DataCollectionInput(listing_url=args.url))
        print(
            f"Loaded: {listing.address or '(unknown address)'} | "
            f"${listing.price:,} | {len(listing.images)} photos"
        )

        print(f"Preparing up to {args.max_images} photos with OpenCV...")
        prepared = await prepare_listing_images(
            listing.images,
            max_images=args.max_images,
            max_side=settings.vision_image_max_side,
        )
        if not prepared:
            raise SystemExit("No usable listing photos were downloaded/prepared.")

        for index, image in enumerate(prepared):
            print(
                f"  image {index}: {image.width}x{image.height}, "
                f"sharpness={image.sharpness}, source={image.url}"
            )
        prepared_base64 = [image.jpeg_base64 for image in prepared]
        prompt = build_prompt(listing.address, listing.price, len(prepared))

    if not prepared_base64:
        raise SystemExit("No images were provided for inspection.")

    client = MLXVisionClient(model_id=settings.vision_model)
    if not client.available():
        raise SystemExit(
            "mlx_vlm is not installed in this Python environment. "
            "Run with backend/.venv-mlx/bin/python."
        )

    print(f"Running {settings.vision_model} via mlx-vlm...")
    result = await client.analyze(
        prepared_base64,
        prompt,
        INSPECTION_SCHEMA,
        temperature=settings.vision_temperature,
    )

    print("\nRaw inspection result:")
    print(json.dumps(result, indent=2))

    cleaned = remove_non_flags(result)
    if cleaned != result:
        print("\nCleaned visible-flag result:")
        print(json.dumps(cleaned, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
