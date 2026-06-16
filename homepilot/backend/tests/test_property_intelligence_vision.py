import asyncio

from app.agents import property_intelligence as pi_module
from app.agents.property_intelligence import PropertyIntelligenceAgent, PropertyIntelligenceInput
from app.models import PropertyListing
from app.services.image_prep import PreparedImage


def test_vision_path_maps_model_findings(monkeypatch) -> None:
    async def fake_available() -> bool:
        return True

    async def fake_prepare(urls, **kwargs):
        return [
            PreparedImage(
                url=urls[0],
                jpeg_base64="x",
                sharpness=120.0,
                brightness=128.0,
                width=1024,
                height=768,
            ),
            PreparedImage(
                url=urls[1],
                jpeg_base64="y",
                sharpness=110.0,
                brightness=118.0,
                width=1024,
                height=768,
            ),
        ]

    async def fake_analyze(images, description=None):
        return {
            "property_quality_score": 88,
            "repair_risk_score": 22,
            "renovation_quality": "high",
            "roof_condition": "good",
            "water_damage_risk": "low",
            "estimated_major_repairs": ["paint touch-up"],
            "observations": ["Updated kitchen with new cabinetry", "Old paint visible near trim"],
            "evidence": [
                {
                    "finding": "Old paint visible near trim",
                    "photo_indexes": [2],
                }
            ],
            "confidence": 0.8,
            "_image_count": 2,
        }

    monkeypatch.setattr(pi_module, "vision_available", fake_available)
    monkeypatch.setattr(pi_module, "prepare_listing_images", fake_prepare)
    monkeypatch.setattr(pi_module, "analyze_property_images", fake_analyze)

    agent = PropertyIntelligenceAgent(use_vision=True)
    listing = PropertyListing(
        id="vision-home",
        listing_price=900_000,
        photo_urls=["https://cdn.example.com/photo1.jpg", "https://cdn.example.com/photo2.jpg"],
    )

    result = asyncio.run(agent.run(PropertyIntelligenceInput(property=listing)))

    assert result.property_quality_score == 88
    assert result.repair_risk_score == 22
    assert result.roof_condition == "good"
    assert "Qwen2.5-VL" in result.explanation
    assert result.confidence == 0.8

    evidence_item = next(item for item in result.breakdown if item.label == "What the model saw")
    assert evidence_item.inputs[0].value == "Old paint visible near trim"
    assert evidence_item.inputs[0].evidence_urls == ["https://cdn.example.com/photo2.jpg"]

    repair_item = next(item for item in result.breakdown if item.label == "Flagged potential repairs")
    assert repair_item.inputs[0].evidence_urls == ["https://cdn.example.com/photo2.jpg"]


def test_vision_falls_back_to_heuristic_when_unavailable(monkeypatch) -> None:
    async def fake_unavailable() -> bool:
        return False

    monkeypatch.setattr(pi_module, "vision_available", fake_unavailable)

    agent = PropertyIntelligenceAgent(use_vision=True)
    listing = PropertyListing(
        id="fallback-home",
        listing_price=800_000,
        year_built=2019,
        description="Move-in ready home with new roof and updated kitchen.",
        photo_urls=["https://cdn.example.com/photo1.jpg"],
    )

    result = asyncio.run(agent.run(PropertyIntelligenceInput(property=listing)))

    # Heuristic path still produces a sane result.
    assert result.property_quality_score > 70
    assert result.roof_condition == "good"
