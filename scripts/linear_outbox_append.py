#!/usr/bin/env python3
"""Append a Linear mutation operation to repo-local outbox.

Example:
  python3 scripts/linear_outbox_append.py \
    --issue ROM-123 \
    --op create_comment \
    --payload '{"body":"status update"}'
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_OUTBOX = Path("evidence/linear/outbox.jsonl")
DEFAULT_APPLIED = Path("evidence/linear/applied.jsonl")
DEFAULT_EVENTS = Path("evidence/linear/events.jsonl")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _append_jsonl(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True))
        handle.write("\n")


def _idempotency_key(issue: str, op: str, payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    basis = f"{issue}|{op}|{canonical}"
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue", required=True, help="Issue identifier (e.g. ROM-123)")
    parser.add_argument("--op", required=True, help="Operation name (e.g. create_comment)")
    parser.add_argument(
        "--payload",
        required=True,
        help="JSON payload for operation, passed as a string",
    )
    parser.add_argument("--outbox", default=str(DEFAULT_OUTBOX))
    parser.add_argument("--applied", default=str(DEFAULT_APPLIED))
    parser.add_argument("--events", default=str(DEFAULT_EVENTS))
    args = parser.parse_args()

    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError as exc:
        print(f"invalid payload JSON: {exc}", file=sys.stderr)
        return 2

    if not isinstance(payload, dict):
        print("payload must be a JSON object", file=sys.stderr)
        return 2

    outbox_path = Path(args.outbox)
    applied_path = Path(args.applied)
    events_path = Path(args.events)
    key = _idempotency_key(args.issue, args.op, payload)

    for row in _read_jsonl(applied_path):
        if row.get("idempotency_key") == key:
            event = {
                "event": "append_skipped_already_applied",
                "at": _now(),
                "issue": args.issue,
                "op": args.op,
                "idempotency_key": key,
            }
            _append_jsonl(events_path, event)
            print(json.dumps({"status": "already_applied", "idempotency_key": key}))
            return 0

    for row in _read_jsonl(outbox_path):
        if row.get("idempotency_key") == key:
            event = {
                "event": "append_skipped_already_queued",
                "at": _now(),
                "issue": args.issue,
                "op": args.op,
                "idempotency_key": key,
            }
            _append_jsonl(events_path, event)
            print(json.dumps({"status": "already_queued", "idempotency_key": key}))
            return 0

    entry = {
        "id": str(uuid.uuid4()),
        "issue": args.issue,
        "op": args.op,
        "payload": payload,
        "created_at": _now(),
        "attempts": 0,
        "idempotency_key": key,
    }

    _append_jsonl(outbox_path, entry)
    _append_jsonl(
        events_path,
        {
            "event": "append_queued",
            "at": _now(),
            "id": entry["id"],
            "issue": args.issue,
            "op": args.op,
            "idempotency_key": key,
        },
    )

    print(json.dumps({"status": "queued", "id": entry["id"], "idempotency_key": key}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
