"""End-to-end smoke test: Agent 1 (listing fetch) → Agent 3 (VLM + LoRA + NYC municipal).

Runs the production agent path — not the older custom VLM script.

Usage:
    cd backend

    # NYC listing (municipal + visual):
    BEACON_INFERENCE_BACKEND=mlx \\
    BEACON_VISION_ADAPTER_PATH=../trained_lora \\
    .venv-mlx/bin/python scripts/test_agent1_agent3_pipeline.py \\
        "https://www.realtor.com/realestateandhomes-detail/<your-nyc-listing>"

    # Canadian listing (visual only; municipal skipped for non-NYC):
    .venv-mlx/bin/python scripts/test_agent1_agent3_pipeline.py \\
        "https://www.realtor.ca/real-estate/29867678/18-535-windflower-crescent-kitchener"

    # Full JSON output:
    .venv-mlx/bin/python scripts/test_agent1_agent3_pipeline.py "<url>" --json
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

os.environ.setdefault("BEACON_INFERENCE_BACKEND", "mlx")
# LoRA disabled by default — the wall-damage adapter narrows the VLM to wall/foundation
# defects and suppresses water/roof/electrical reads, so we run the well-rounded base
# Qwen2.5-VL. To re-enable the adapter, set the env var before running, e.g.:
#   BEACON_VISION_ADAPTER_PATH=../trained_lora .venv-mlx/bin/python scripts/test_agent1_agent3_pipeline.py "<url>"

DEFAULT_URL = (
    "https://www.realtor.ca/real-estate/29867678/"
    "18-535-windflower-crescent-kitchener"
)


def _confidence_pct(value: float) -> str:
    return f"{round(value * 100)}%"


def print_report(listing_url: str, prop, result) -> None:
    """Human-readable unified report (visual + municipal)."""
    print("=" * 72)
    print("BEACON — Agent 1 → Agent 3 Pipeline Report")
    print("=" * 72)
    print(f"\nListing URL:  {listing_url}")
    print(f"Address:      {prop.address or '(unknown)'}")
    print(f"Price:        ${prop.price:,}" if prop.price else "Price:        (unknown)")
    print(f"Photos:       {len(prop.images)} fetched, {result.image_count} analyzed")
    print(f"Vision model: {result.model}")

    print("\n--- Visual Findings ---")
    print(f"Repair risk:           {result.repair_risk}/100")
    print(f"Renovation score:      {result.renovation_score}/100")
    print(f"Est. repair cost:      ${result.estimated_repair_cost:,}")

    defect_photos = [
        img
        for img in result.per_image
        if img.flags
        or max(img.roof_risk, img.water_risk, img.foundation_risk, img.electrical_risk)
        >= 0.5
    ]

    if not defect_photos:
        print("No significant visible defects flagged.")
    else:
        print(f"\nPhotos with issues ({len(defect_photos)}):")
        for img in defect_photos:
            print(f"\n  Photo {img.image_index + 1}:")
            if img.image_url:
                print(f"    URL: {img.image_url}")
            print(
                f"    Risks: roof={img.roof_risk:.2f}, water={img.water_risk:.2f}, "
                f"foundation={img.foundation_risk:.2f}, electrical={img.electrical_risk:.2f}"
            )
            for flag in img.flags:
                loc = f" @ {flag.location}" if flag.location else ""
                reason = f" — {flag.reason}" if flag.reason else ""
                print(
                    f"    • {flag.issue}{loc} "
                    f"(confidence {_confidence_pct(flag.confidence)}){reason}"
                )

    visual_evidence = [e for e in result.evidence if e.type == "visual_flag"]
    if visual_evidence:
        print("\nTop visual evidence:")
        for e in visual_evidence[:8]:
            idx = f" [photo {e.imageIndex + 1}]" if e.imageIndex is not None else ""
            print(f"  • {e.issue}{idx} — {e.detail} ({e.weight}, {e.confidence})")

    print("\n--- Municipal Findings (NYC) ---")
    if result.municipal is None:
        municipal_notes = [n for n in result.notes if "Municipal" in n]
        if municipal_notes:
            print(municipal_notes[0])
        elif not prop.address:
            print("Skipped — listing has no address.")
        else:
            print("Not available (non-NYC address or lookup returned no parcel).")
    else:
        m = result.municipal
        print(f"Risk level:            {m.risk_level}")
        print(f"Municipal risk score:  {m.municipal_risk_score}/100")
        print(f"Summary:               {m.summary}")

        if m.signals:
            print("\nSignals:")
            for s in m.signals:
                detail = f" — {s.detail}" if s.detail else ""
                print(f"  • [{s.level.upper()}] {s.label} (x{s.count}, +{s.points} pts){detail}")

        open_violations = [e for e in result.evidence if e.type == "municipal_violation"]
        if open_violations:
            print("\nOpen violations on record:")
            for e in open_violations[:10]:
                print(f"  • {e.detail} ({e.weight})")

    print("\n--- Unified Assessment ---")
    parts = []
    if visual_evidence:
        issues = sorted({e.issue for e in visual_evidence[:5]})
        parts.append("Visual: " + ", ".join(issues))
    if result.municipal:
        parts.append(f"Municipal: {result.municipal.summary}")
    print("\n".join(parts) if parts else "No major cross-signal concerns surfaced.")

    if result.repair_risk >= 60 or (
        result.municipal and result.municipal.risk_level == "High"
    ):
        print("Recommended action:      Professional inspection strongly recommended.")
    elif result.repair_risk >= 30 or (
        result.municipal and result.municipal.risk_level == "Medium"
    ):
        print("Recommended action:      Targeted inspection / permit review recommended.")
    else:
        print("Recommended action:      No urgent red flags from visual + municipal signals.")

    if result.notes:
        print("\nNotes:")
        for note in result.notes:
            print(f"  • {note}")

    print("\n" + "=" * 72)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Agent 1 → Agent 3 on a real listing URL."
    )
    parser.add_argument("url", nargs="?", default=DEFAULT_URL, help="Listing URL")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Also print the full InspectionResult JSON at the end.",
    )
    parser.add_argument(
        "--no-municipal",
        action="store_true",
        help="Disable NYC municipal lookup (visual-only run).",
    )
    args = parser.parse_args()

    if "zillow.com" in args.url.lower():
        print(
            "WARNING: Zillow is detected in the URL, but fetch-listings only has "
            "realtor.ca / realtor.com adapters today. This will likely fail unless "
            "you add a Zillow source adapter.\n",
            file=sys.stderr,
        )

    from app.agents.data_collection import DataCollectionAgent, DataCollectionInput
    from app.agents.inspection import InspectionAgent, InspectionInput
    from app.core.config import get_settings

    settings = get_settings()
    print(f"Fetching listing (Agent 1): {args.url}", flush=True)
    prop = await DataCollectionAgent().run(DataCollectionInput(listing_url=args.url))
    print(
        f"Loaded: {prop.address or '(unknown)'} | ${prop.price:,} | "
        f"{len(prop.images)} photos",
        flush=True,
    )

    adapter = settings.vision_adapter_path
    if adapter:
        adapter_path = Path(adapter).expanduser()
        has_adapter = (adapter_path / "adapter_config.json").exists() and (
            adapter_path / "adapters.safetensors"
        ).exists()
        print(
            f"LoRA adapter: {adapter_path} "
            f"({'ready' if has_adapter else 'MISSING adapters.safetensors — using base model'})",
            flush=True,
        )

    print("Running inspection (Agent 3): VLM + municipal lookup...", flush=True)
    result = await InspectionAgent(enable_municipal=not args.no_municipal).run(
        InspectionInput(property=prop)
    )

    print_report(args.url, prop, result)

    if args.json:
        print("\nFull InspectionResult JSON:")
        print(result.model_dump_json(by_alias=True, indent=2))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        raise SystemExit(130)
