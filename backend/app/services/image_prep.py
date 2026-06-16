"""OpenCV image acquisition and preprocessing for Agent 3 (Inspection Intelligence).

Downloads listing photos, decodes/resizes them, drops blurry and near-duplicate
shots, and returns a representative, base64-encoded set ready for the VLM.
"""

from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass

import cv2
import httpx
import numpy as np

from app.services.progress import report_subtask


@dataclass
class PreparedImage:
    url: str
    jpeg_base64: str
    sharpness: float
    brightness: float
    width: int
    height: int


# Below this variance-of-Laplacian a photo is too blurry to be useful.
BLUR_THRESHOLD = 45.0
# Perceptual-hash Hamming distance under this counts as a near-duplicate.
DUPLICATE_HAMMING_THRESHOLD = 6


async def prepare_listing_images(
    photo_urls: list[str],
    *,
    max_images: int = 8,
    max_side: int = 1024,
    download_limit: int = 30,
) -> list[PreparedImage]:
    """Fetch and preprocess listing photos into a representative VLM-ready set."""

    urls = [str(u) for u in photo_urls][:download_limit]
    if not urls:
        return []

    await report_subtask(
        "image_download",
        f"Downloading {len(urls)} listing photos",
        skill="OpenCV",
    )
    raw = await _download_all(urls)
    downloaded = sum(1 for _, data in raw if data)
    await report_subtask(
        "image_download",
        f"Downloaded {downloaded} photos",
        skill="OpenCV",
        status="done",
    )
    await report_subtask(
        "image_filter",
        "Filtering blurry and duplicate photos (Laplacian + pHash)",
        skill="OpenCV",
    )

    prepared: list[PreparedImage] = []
    seen_hashes: list[int] = []
    for url, data in raw:
        if not data:
            continue
        image = _decode(data)
        if image is None:
            continue

        sharpness = _sharpness(image)
        if sharpness < BLUR_THRESHOLD:
            continue

        phash = _phash(image)
        if any(_hamming(phash, h) <= DUPLICATE_HAMMING_THRESHOLD for h in seen_hashes):
            continue
        seen_hashes.append(phash)

        resized = _resize(image, max_side)
        encoded = _encode_jpeg(resized)
        if encoded is None:
            continue

        height, width = resized.shape[:2]
        prepared.append(
            PreparedImage(
                url=url,
                jpeg_base64=encoded,
                sharpness=round(float(sharpness), 2),
                brightness=round(float(image.mean()), 2),
                width=int(width),
                height=int(height),
            )
        )

    # Keep the sharpest, most informative shots.
    prepared.sort(key=lambda image: image.sharpness, reverse=True)
    selected = prepared[:max_images]
    await report_subtask(
        "image_filter",
        f"Selected {len(selected)} clear, unique photos for analysis",
        skill="OpenCV",
        status="done",
    )
    return selected


# Some photo CDNs (e.g. Wikimedia) reject requests without a browser User-Agent.
_DOWNLOAD_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/jpeg,image/png,*/*",
}


async def _download_all(urls: list[str]) -> list[tuple[str, bytes | None]]:
    async with httpx.AsyncClient(
        timeout=20.0, follow_redirects=True, headers=_DOWNLOAD_HEADERS
    ) as client:
        tasks = [_download_one(client, url) for url in urls]
        return await asyncio.gather(*tasks)


async def _download_one(client: httpx.AsyncClient, url: str) -> tuple[str, bytes | None]:
    try:
        response = await client.get(url)
        response.raise_for_status()
        return url, response.content
    except Exception:
        return url, None


def _decode(data: bytes) -> np.ndarray | None:
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    return image


def _sharpness(image: np.ndarray) -> float:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def _phash(image: np.ndarray) -> int:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
    mean = small.mean()
    bits = 0
    for value in small.flatten():
        bits = (bits << 1) | (1 if value >= mean else 0)
    return bits


def _hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _resize(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image
    scale = max_side / longest
    new_size = (int(width * scale), int(height * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def _encode_jpeg(image: np.ndarray) -> str | None:
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        return None
    return base64.b64encode(buffer.tobytes()).decode("ascii")
