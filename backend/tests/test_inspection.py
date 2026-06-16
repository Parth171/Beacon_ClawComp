from app.agents.inspection import InspectionAgent, InspectionInput
from app.models.property import CanonicalProperty
from app.services.inference.base import VisionClient


class FakeImg:
    def __init__(self, b64: str, url: str) -> None:
        self.jpeg_base64 = b64
        self.url = url


def make_preparer(n: int):
    async def preparer(urls):
        return [FakeImg(f"b64-{i}", urls[i]) for i in range(min(n, len(urls)))]

    return preparer


class ScriptedVisionClient(VisionClient):
    """Returns canned per-image responses in call order."""

    name = "scripted"

    def __init__(self, responses: list[dict]) -> None:
        self._responses = responses
        self._i = 0

    def available(self) -> bool:
        return True

    async def analyze(self, images_base64, prompt, schema, *, temperature=None):
        resp = self._responses[self._i]
        self._i += 1
        return resp


def _property(n_images: int = 2) -> CanonicalProperty:
    return CanonicalProperty(price=820000, images=[f"http://x/{i}.jpg" for i in range(n_images)])


async def test_aggregation_worst_dimension_with_corroboration():
    vision = ScriptedVisionClient(
        [
            {
                "roofRisk": 0.0,
                "waterRisk": 0.8,
                "foundationRisk": 0.0,
                "electricalRisk": 0.0,
                "renovationScore": 80,
                "flags": [
                    {
                        "issue": "water damage",
                        "location": "kitchen ceiling",
                        "reason": "brown staining near skylight",
                        "confidence": 0.82,
                    }
                ],
            },
            {
                "roofRisk": 0.0,
                "waterRisk": 0.0,
                "foundationRisk": 0.65,
                "electricalRisk": 0.0,
                "renovationScore": 90,
                "flags": [],
            },
        ]
    )
    agent = InspectionAgent(vision_client=vision, image_preparer=make_preparer(2))
    result = await agent.run(InspectionInput(property=_property(2)))

    # water 0.8*0.85=0.68 (top); foundation 0.65*1.0=0.65 corroborates.
    # 100 * (0.68 + 0.4*0.65) = 94
    assert result.repair_risk == 94
    assert result.renovation_score == 85  # mean(80, 90)
    assert result.image_count == 2
    assert result.model == "scripted"


async def test_cost_from_flags_and_dimension_fallback():
    vision = ScriptedVisionClient(
        [
            {
                "roofRisk": 0.0,
                "waterRisk": 0.8,
                "foundationRisk": 0.65,
                "electricalRisk": 0.0,
                "renovationScore": 80,
                "flags": [
                    {"issue": "water stain", "reason": "ceiling staining", "confidence": 0.82}
                ],
            }
        ]
    )
    agent = InspectionAgent(vision_client=vision, image_preparer=make_preparer(1))
    result = await agent.run(InspectionInput(property=_property(1)))

    # water flag (0.82): 6000*(0.5+0.41)=5460 -> $5500
    # foundation fallback (0.65, no flag): 25000*0.825=20625 -> $20500
    assert result.estimated_repair_cost == 26000


async def test_evidence_threshold_and_weight():
    vision = ScriptedVisionClient(
        [
            {
                "roofRisk": 0.0,
                "waterRisk": 0.0,
                "foundationRisk": 0.0,
                "electricalRisk": 0.0,
                "renovationScore": 70,
                "flags": [
                    {"issue": "minor scuff", "reason": "wall mark", "confidence": 0.30},
                    {"issue": "aging roof", "reason": "curling shingles", "confidence": 0.45},
                    {"issue": "cracked foundation", "reason": "stair-step crack", "confidence": 0.88},
                ],
            }
        ]
    )
    agent = InspectionAgent(vision_client=vision, image_preparer=make_preparer(1))
    result = await agent.run(InspectionInput(property=_property(1)))

    issues = {e.issue for e in result.evidence}
    assert "minor scuff" not in issues  # below 0.40 threshold
    assert "aging roof" in issues  # 0.45 surfaces
    assert "cracked foundation" in issues
    by_issue = {e.issue: e for e in result.evidence}
    assert by_issue["cracked foundation"].weight == "high"  # >=0.75
    assert by_issue["aging roof"].weight == "low"  # <0.55
    assert by_issue["cracked foundation"].type == "visual_flag"
    # extra fields carried through
    assert by_issue["cracked foundation"].model_dump()["imageIndex"] == 0


async def test_clean_property_low_risk():
    vision = ScriptedVisionClient(
        [
            {
                "roofRisk": 0.05,
                "waterRisk": 0.0,
                "foundationRisk": 0.0,
                "electricalRisk": 0.0,
                "renovationScore": 95,
                "flags": [],
            }
        ]
    )
    agent = InspectionAgent(vision_client=vision, image_preparer=make_preparer(1))
    result = await agent.run(InspectionInput(property=_property(1)))
    assert result.repair_risk <= 5
    assert result.estimated_repair_cost == 0
    assert result.evidence == []
    assert result.renovation_score == 95


async def test_no_images_returns_neutral():
    agent = InspectionAgent(vision_client=ScriptedVisionClient([]), image_preparer=make_preparer(0))
    result = await agent.run(InspectionInput(property=_property(0)))
    assert result.image_count == 0
    assert result.repair_risk == 0
    assert result.renovation_score == 50
    assert result.notes


async def test_serializes_camelcase():
    vision = ScriptedVisionClient(
        [{"roofRisk": 0.0, "waterRisk": 0.0, "foundationRisk": 0.0, "electricalRisk": 0.0,
          "renovationScore": 70, "flags": []}]
    )
    agent = InspectionAgent(vision_client=vision, image_preparer=make_preparer(1))
    result = await agent.run(InspectionInput(property=_property(1)))
    data = result.model_dump(by_alias=True)
    assert "repairRisk" in data
    assert "renovationScore" in data
    assert "estimatedRepairCost" in data


async def test_with_stub_vision_client():
    # Integration with the real deterministic stub: zeros everywhere.
    from app.services.inference.stub import StubVisionClient

    agent = InspectionAgent(vision_client=StubVisionClient(), image_preparer=make_preparer(3))
    result = await agent.run(InspectionInput(property=_property(3)))
    assert result.image_count == 3
    assert result.repair_risk == 0
    assert result.estimated_repair_cost == 0
    assert result.renovation_score == 0
