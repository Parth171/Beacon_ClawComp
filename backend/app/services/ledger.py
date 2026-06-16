"""SQLite ledger.

Every property URL becomes one *run*; each agent persists exactly one record per
run. This is the source of truth the orchestrator uses for partial-signal fallback
and failure recovery — nothing is silently skipped. Agent outputs are stored as
JSON blobs so the evidence object can be reassembled verbatim for synthesis.

The connection is process-wide with a lock, which is sufficient for the local,
single-machine workload. Callers in async code should wrap writes in
``asyncio.to_thread`` if they need to avoid blocking the loop under load.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from app.core.config import get_settings
from app.models.run import AgentName, AgentRecord, RunRecord, RunStatus

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id          TEXT PRIMARY KEY,
    listing_url     TEXT,
    address         TEXT,
    status          TEXT NOT NULL,
    recommendation  TEXT,
    next_step       TEXT,
    error           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_outputs (
    run_id      TEXT NOT NULL,
    agent       TEXT NOT NULL,
    status      TEXT NOT NULL,
    output_json TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (run_id, agent),
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Ledger:
    def __init__(self, db_path: str) -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # --- runs ---------------------------------------------------------------

    def create_run(self, run_id: str, listing_url: str | None = None) -> RunRecord:
        now = _now()
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO runs "
                "(run_id, listing_url, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (run_id, listing_url, RunStatus.PENDING.value, now, now),
            )
            self._conn.commit()
        return self.get_run(run_id)  # type: ignore[return-value]

    def update_run(self, run_id: str, **fields: Any) -> None:
        allowed = {
            "listing_url",
            "address",
            "status",
            "recommendation",
            "next_step",
            "error",
        }
        sets = {k: _enum_value(v) for k, v in fields.items() if k in allowed}
        if not sets:
            return
        sets["updated_at"] = _now()
        assignments = ", ".join(f"{k} = ?" for k in sets)
        with self._lock:
            self._conn.execute(
                f"UPDATE runs SET {assignments} WHERE run_id = ?",
                (*sets.values(), run_id),
            )
            self._conn.commit()

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
        if row is None:
            return None
        record = RunRecord(
            run_id=row["run_id"],
            listing_url=row["listing_url"],
            address=row["address"],
            status=RunStatus(row["status"]),
            recommendation=row["recommendation"],
            next_step=row["next_step"],
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        record.agents = self.list_agent_outputs(run_id)
        return record

    # --- agent outputs ------------------------------------------------------

    def save_agent_output(
        self,
        run_id: str,
        agent: AgentName | str,
        status: RunStatus | str,
        output: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        agent_value = _enum_value(agent)
        status_value = _enum_value(status)
        output_json = json.dumps(output) if output is not None else None
        now = _now()
        with self._lock:
            existing = self._conn.execute(
                "SELECT created_at FROM agent_outputs WHERE run_id = ? AND agent = ?",
                (run_id, agent_value),
            ).fetchone()
            created_at = existing["created_at"] if existing else now
            self._conn.execute(
                "INSERT OR REPLACE INTO agent_outputs "
                "(run_id, agent, status, output_json, error, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (run_id, agent_value, status_value, output_json, error, created_at, now),
            )
            self._conn.commit()

    def get_agent_output(self, run_id: str, agent: AgentName | str) -> AgentRecord | None:
        agent_value = _enum_value(agent)
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM agent_outputs WHERE run_id = ? AND agent = ?",
                (run_id, agent_value),
            ).fetchone()
        return _row_to_agent_record(row)

    def list_agent_outputs(self, run_id: str) -> list[AgentRecord]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM agent_outputs WHERE run_id = ? ORDER BY created_at",
                (run_id,),
            ).fetchall()
        return [r for r in (_row_to_agent_record(row) for row in rows) if r is not None]

    def evidence_object(self, run_id: str) -> dict[str, Any]:
        """Reassemble the unified evidence object for Agent 5 (synthesis).

        Maps each completed agent's stored output under its agent key, verbatim.
        """

        result: dict[str, Any] = {"run_id": run_id}
        for record in self.list_agent_outputs(run_id):
            if record.output is not None:
                result[record.agent.value] = record.output
        return result

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def _enum_value(value: Any) -> Any:
    from enum import Enum

    return value.value if isinstance(value, Enum) else value


def _row_to_agent_record(row: sqlite3.Row | None) -> AgentRecord | None:
    if row is None:
        return None
    output = json.loads(row["output_json"]) if row["output_json"] else None
    return AgentRecord(
        run_id=row["run_id"],
        agent=AgentName(row["agent"]),
        status=RunStatus(row["status"]),
        output=output,
        error=row["error"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@lru_cache
def get_ledger() -> Ledger:
    return Ledger(get_settings().ledger_db_path)
