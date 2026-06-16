from datetime import date

from app.agents.inspection import InspectionAgent, InspectionInput
from app.models.municipal import (
    Complaint,
    MunicipalQuery,
    MunicipalRecords,
    Permit,
    Violation,
)
from app.models.property import CanonicalProperty
from app.services.inference.base import VisionClient
from app.services.municipal_risk import score_municipal

TODAY = date(2026, 6, 16)


def _records(**kw) -> MunicipalRecords:
    return MunicipalRecords(
        query=MunicipalQuery(address="x", resolved="x", bbl="1", bin="1"),
        permits=kw.get("permits", []),
        violations=kw.get("violations", []),
        complaints=kw.get("complaints", []),
        counts=kw.get("counts", {}),
    )


def test_clean_property_scores_low():
    res = score_municipal(_records(), today=TODAY)
    assert res.municipal_risk_score == 0
    assert res.risk_level == "Low"


def test_open_violations_and_stopwork_score_high():
    records = _records(
        violations=[
            Violation(source="DOB", type="STOP WORK ORDER", status="ACTIVE", is_open=True,
                      date_issued="2025-01-02"),
            Violation(source="ECB/OATH", type="Elevators", severity="CLASS - 1",
                      status="ACTIVE", is_open=True, date_issued="2024-05-01"),
            Violation(source="HPD", type="housing", severity="Class C", status="Open",
                      is_open=True, date_issued="2025-03-03"),
        ],
    )
    res = score_municipal(records, today=TODAY)
    # A stop-work order + open violations floors the level at High regardless of count.
    assert res.risk_level == "High"
    assert res.municipal_risk_score >= 40
    labels = {s.label for s in res.signals}
    assert "Open violations" in labels
    assert "Stop-work / unsafe-structure notices" in labels
    # municipal evidence is emitted for the chain
    assert any(e.type == "municipal_violation" for e in res.evidence)


def test_expired_permits_score_medium():
    records = _records(
        permits=[
            Permit(source="DOB BIS", type="EW", status="EXPIRED", expiration_date="2019-01-01"),
            Permit(source="DOB BIS", type="PL", status="ISSUED", expiration_date="2018-06-01"),
        ],
    )
    res = score_municipal(records, today=TODAY)
    assert res.risk_level == "Medium"
    assert any(s.label == "Expired / unresolved permits" for s in res.signals)


def test_resolved_violations_and_recent_permit_are_mitigants():
    records = _records(
        violations=[Violation(source="DOB", type="old", status="RESOLVED", is_open=False)],
        permits=[Permit(source="DOB BIS", type="A2", status="ISSUED", issue_date="2025-02-01")],
    )
    res = score_municipal(records, today=TODAY)
    assert res.risk_level == "Low"
    low_labels = {s.label for s in res.signals if s.level == "low"}
    assert "Violations resolved" in low_labels
    assert "Recent approved permits" in low_labels


# --- agent integration -------------------------------------------------------

class _StubVision(VisionClient):
    name = "stub"

    def available(self) -> bool:
        return True

    async def analyze(self, images_base64, prompt, schema, *, temperature=None):
        return {"roofRisk": 0, "waterRisk": 0, "foundationRisk": 0, "electricalRisk": 0,
                "renovationScore": 80, "flags": []}


def _preparer(n):
    class _Img:
        def __init__(self, b64, url):
            self.jpeg_base64 = b64
            self.url = url

    async def prep(urls):
        return [_Img(f"b64-{i}", urls[i]) for i in range(min(n, len(urls)))]

    return prep


async def test_agent_attaches_municipal_when_address_present():
    async def fake_fetch(address):
        return _records(
            violations=[Violation(source="DOB", type="UNSAFE", status="ACTIVE",
                                  is_open=True, date_issued="2025-01-01")],
        )

    agent = InspectionAgent(
        vision_client=_StubVision(),
        image_preparer=_preparer(1),
        municipal_fetcher=fake_fetch,
    )
    prop = CanonicalProperty(price=500000, address="350 5th Ave Manhattan NY",
                             images=["http://x/0.jpg"])
    result = await agent.run(InspectionInput(property=prop))

    assert result.municipal is not None
    assert result.municipal.risk_level == "High"
    # municipal evidence merged into the unified evidence list
    assert any(e.type in ("municipal_violation", "municipal_flag") for e in result.evidence)


async def test_agent_skips_municipal_gracefully_on_failure():
    async def failing_fetch(address):
        raise RuntimeError("Address could not be geocoded to a NYC parcel")

    agent = InspectionAgent(
        vision_client=_StubVision(),
        image_preparer=_preparer(1),
        municipal_fetcher=failing_fetch,
    )
    prop = CanonicalProperty(price=500000, address="18 Windflower Cres, Kitchener ON",
                             images=["http://x/0.jpg"])
    result = await agent.run(InspectionInput(property=prop))

    assert result.municipal is None
    assert any("Municipal lookup unavailable" in n for n in result.notes)
    # visual result still intact
    assert result.renovation_score == 80


async def test_agent_no_address_does_not_call_municipal():
    called = False

    async def fetch(address):
        nonlocal called
        called = True
        return _records()

    agent = InspectionAgent(
        vision_client=_StubVision(),
        image_preparer=_preparer(1),
        municipal_fetcher=fetch,
    )
    prop = CanonicalProperty(price=500000, images=["http://x/0.jpg"])
    result = await agent.run(InspectionInput(property=prop))

    assert called is False
    assert result.municipal is None
