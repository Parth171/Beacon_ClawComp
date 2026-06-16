from app.models.run import AgentName, RunStatus
from app.services.ledger import Ledger


def _ledger(tmp_path) -> Ledger:
    return Ledger(str(tmp_path / "test.db"))


def test_create_and_get_run(tmp_path):
    ledger = _ledger(tmp_path)
    ledger.create_run("run-1", listing_url="https://example.com/listing")
    run = ledger.get_run("run-1")
    assert run is not None
    assert run.run_id == "run-1"
    assert run.status == RunStatus.PENDING
    assert run.listing_url == "https://example.com/listing"
    assert run.created_at is not None


def test_update_run(tmp_path):
    ledger = _ledger(tmp_path)
    ledger.create_run("run-2")
    ledger.update_run("run-2", status=RunStatus.COMPLETE, recommendation="BUY", next_step="LOI")
    run = ledger.get_run("run-2")
    assert run.status == RunStatus.COMPLETE
    assert run.recommendation == "BUY"
    assert run.next_step == "LOI"


def test_save_and_read_agent_output(tmp_path):
    ledger = _ledger(tmp_path)
    ledger.create_run("run-3")
    ledger.save_agent_output(
        "run-3", AgentName.INSPECTION, RunStatus.COMPLETE, {"repairRisk": 22}
    )
    record = ledger.get_agent_output("run-3", AgentName.INSPECTION)
    assert record is not None
    assert record.agent == AgentName.INSPECTION
    assert record.output == {"repairRisk": 22}
    assert record.status == RunStatus.COMPLETE


def test_agent_output_upsert(tmp_path):
    ledger = _ledger(tmp_path)
    ledger.create_run("run-4")
    ledger.save_agent_output("run-4", AgentName.VALUATION, RunStatus.RUNNING, None)
    ledger.save_agent_output("run-4", AgentName.VALUATION, RunStatus.COMPLETE, {"mispricing": 70000})
    outputs = ledger.list_agent_outputs("run-4")
    assert len(outputs) == 1
    assert outputs[0].status == RunStatus.COMPLETE
    assert outputs[0].output == {"mispricing": 70000}


def test_evidence_object(tmp_path):
    ledger = _ledger(tmp_path)
    ledger.create_run("run-5")
    ledger.save_agent_output("run-5", AgentName.INSPECTION, RunStatus.COMPLETE, {"repairRisk": 22})
    ledger.save_agent_output("run-5", AgentName.VALUATION, RunStatus.COMPLETE, {"mispricing": 70000})
    evidence = ledger.evidence_object("run-5")
    assert evidence["inspection"] == {"repairRisk": 22}
    assert evidence["valuation"] == {"mispricing": 70000}
    assert evidence["run_id"] == "run-5"
