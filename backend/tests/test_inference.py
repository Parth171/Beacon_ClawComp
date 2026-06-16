from app.services.inference.base import schema_default
from app.services.inference.stub import StubTextClient, StubVisionClient

INSPECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "repairRisk": {"type": "integer"},
        "renovationScore": {"type": "integer"},
        "flags": {"type": "array", "items": {"type": "string"}},
        "waterRisk": {"type": "number"},
        "condition": {"type": "string", "enum": ["good", "fair", "poor"]},
    },
    "required": ["repairRisk", "renovationScore", "flags", "condition"],
}


def test_schema_default_shapes_object():
    value = schema_default(INSPECTION_SCHEMA)
    assert value == {
        "repairRisk": 0,
        "renovationScore": 0,
        "flags": [],
        "condition": "good",  # first enum value
    }


async def test_stub_text_client_returns_schema_shape():
    client = StubTextClient()
    assert client.available()
    result = await client.generate_json("anything", INSPECTION_SCHEMA)
    assert result["_stub"] is True
    assert set(INSPECTION_SCHEMA["required"]).issubset(result.keys())


async def test_stub_vision_client_counts_images():
    client = StubVisionClient()
    result = await client.analyze(["b64a", "b64b"], "prompt", INSPECTION_SCHEMA)
    assert result["_image_count"] == 2
    assert result["_stub"] is True


def test_registry_stub_backend(monkeypatch):
    monkeypatch.setenv("BEACON_INFERENCE_BACKEND", "stub")
    from app.core.config import get_settings
    from app.services.inference import registry

    get_settings.cache_clear()
    registry.get_text_client.cache_clear()
    registry.get_vision_client.cache_clear()

    assert registry.get_text_client().name == "stub-text"
    assert registry.get_vision_client().name == "stub-vision"

    get_settings.cache_clear()
    registry.get_text_client.cache_clear()
    registry.get_vision_client.cache_clear()
