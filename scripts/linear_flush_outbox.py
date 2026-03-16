#!/usr/bin/env python3
"""Flush queued Linear mutation operations from repo-local outbox.

Backends:
- auto: use `linear-api` if `LINEAR_API_KEY` is present, otherwise noop
- linear-api: execute against Linear GraphQL API
- noop: keep queued entries and record an event
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_OUTBOX = Path("evidence/linear/outbox.jsonl")
DEFAULT_APPLIED = Path("evidence/linear/applied.jsonl")
DEFAULT_FAILURES = Path("evidence/linear/failures.jsonl")
DEFAULT_EVENTS = Path("evidence/linear/events.jsonl")
DEFAULT_LINEAR_URL = "https://api.linear.app/graphql"

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
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


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True))
            handle.write("\n")


class LinearClient:
    def __init__(self, api_key: str, api_url: str) -> None:
        self.api_key = api_key
        self.api_url = api_url

    def _graphql(self, query: str, variables: dict) -> dict:
        payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")
        request = urllib.request.Request(
            self.api_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": self.api_key,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:  # nosec B310
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"network error: {exc}") from exc

        errors = body.get("errors")
        if errors:
            raise RuntimeError(f"graphql error: {errors[0].get('message', errors[0])}")
        return body.get("data", {})

    def resolve_issue_id(self, issue: str) -> str:
        if UUID_RE.match(issue):
            return issue

        query_variants = [
            (
                """
                query($identifier: String!) {
                  issue(identifier: $identifier) { id }
                }
                """,
                {"identifier": issue},
                ("issue", "id"),
            ),
            (
                """
                query($teamKey: String!, $number: Float!) {
                  issue(identifier: { teamKey: $teamKey, number: $number }) { id }
                }
                """,
                self._identifier_to_object(issue),
                ("issue", "id"),
            ),
        ]

        last_error = "no query attempted"
        for query, variables, path in query_variants:
            if variables is None:
                continue
            try:
                data = self._graphql(query, variables)
                issue_node = data.get(path[0]) if isinstance(data, dict) else None
                if issue_node and issue_node.get(path[1]):
                    return issue_node[path[1]]
            except RuntimeError as exc:
                last_error = str(exc)
                continue

        raise RuntimeError(f"unable to resolve issue '{issue}': {last_error}")

    @staticmethod
    def _identifier_to_object(identifier: str) -> dict | None:
        match = re.match(r"^([A-Z]+)-(\d+)$", identifier)
        if not match:
            return None
        team_key = match.group(1)
        number = float(match.group(2))
        return {"teamKey": team_key, "number": number}

    def create_comment(self, issue: str, body: str) -> dict:
        issue_id = self.resolve_issue_id(issue)
        mutation = """
        mutation($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment { id }
          }
        }
        """
        data = self._graphql(
            mutation,
            {"input": {"issueId": issue_id, "body": body}},
        )
        result = data.get("commentCreate") or {}
        if not result.get("success"):
            raise RuntimeError("commentCreate returned success=false")
        comment = result.get("comment") or {}
        return {"comment_id": comment.get("id"), "issue_id": issue_id}

    def update_issue(self, issue: str, payload: dict) -> dict:
        issue_id = self.resolve_issue_id(issue)
        mutation = """
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id identifier }
          }
        }
        """
        data = self._graphql(mutation, {"id": issue_id, "input": payload})
        result = data.get("issueUpdate") or {}
        if not result.get("success"):
            raise RuntimeError("issueUpdate returned success=false")
        issue_data = result.get("issue") or {}
        return {"issue_id": issue_data.get("id"), "identifier": issue_data.get("identifier")}


def _resolve_backend(requested: str, token: str | None) -> str:
    if requested == "auto":
        return "linear-api" if token else "noop"
    return requested


def _apply_entry(entry: dict, backend: str, client: LinearClient | None) -> dict:
    op = entry.get("op")
    payload = entry.get("payload") or {}
    issue = entry.get("issue")

    if backend == "noop":
        raise RuntimeError("noop backend does not execute queued operations")

    if client is None:
        raise RuntimeError("linear client is unavailable")

    if op == "create_comment":
        body = payload.get("body")
        if not isinstance(body, str) or not body.strip():
            raise RuntimeError("create_comment requires payload.body (non-empty string)")
        return client.create_comment(issue=issue, body=body)

    if op == "update_issue":
        if not isinstance(payload, dict) or not payload:
            raise RuntimeError("update_issue requires payload object")
        return client.update_issue(issue=issue, payload=payload)

    raise RuntimeError(f"unsupported op: {op}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="auto", choices=["auto", "linear-api", "noop"])
    parser.add_argument("--outbox", default=str(DEFAULT_OUTBOX))
    parser.add_argument("--applied", default=str(DEFAULT_APPLIED))
    parser.add_argument("--failures", default=str(DEFAULT_FAILURES))
    parser.add_argument("--events", default=str(DEFAULT_EVENTS))
    parser.add_argument("--api-url", default=DEFAULT_LINEAR_URL)
    parser.add_argument("--token-env", default="LINEAR_API_KEY")
    args = parser.parse_args()

    outbox_path = Path(args.outbox)
    applied_path = Path(args.applied)
    failures_path = Path(args.failures)
    events_path = Path(args.events)

    queued = _read_jsonl(outbox_path)
    if not queued:
        _append_jsonl(events_path, {"event": "flush_noop_empty_queue", "at": _now()})
        print(json.dumps({"status": "empty", "processed": 0, "applied": 0, "failed": 0}))
        return 0

    token = os.getenv(args.token_env)
    backend = _resolve_backend(args.backend, token)
    client = LinearClient(api_key=token, api_url=args.api_url) if backend == "linear-api" and token else None

    if backend == "linear-api" and client is None:
        print(
            f"missing API key in env var {args.token_env} for backend linear-api",
            file=sys.stderr,
        )
        return 2

    if backend == "noop":
        _append_jsonl(
            events_path,
            {
                "event": "flush_skipped_noop_backend",
                "at": _now(),
                "queued_count": len(queued),
            },
        )
        print(
            json.dumps(
                {
                    "status": "noop",
                    "processed": len(queued),
                    "applied": 0,
                    "failed": 0,
                    "remaining": len(queued),
                }
            )
        )
        return 0

    applied_entries = _read_jsonl(applied_path)
    applied_keys = {row.get("idempotency_key") for row in applied_entries if row.get("idempotency_key")}

    next_queue: list[dict] = []
    seen_keys: set[str] = set()
    applied_count = 0
    failed_count = 0
    skipped_count = 0

    for entry in queued:
        key = entry.get("idempotency_key")
        if not key:
            failed_count += 1
            failure = {
                "event": "flush_failed_missing_idempotency_key",
                "at": _now(),
                "entry": entry,
                "error": "missing idempotency_key",
            }
            _append_jsonl(failures_path, failure)
            continue

        if key in seen_keys or key in applied_keys:
            skipped_count += 1
            _append_jsonl(
                events_path,
                {"event": "flush_skipped_duplicate", "at": _now(), "idempotency_key": key},
            )
            continue
        seen_keys.add(key)

        try:
            result = _apply_entry(entry=entry, backend=backend, client=client)
            applied_record = {
                **entry,
                "flushed_at": _now(),
                "backend": backend,
                "result": result,
            }
            _append_jsonl(applied_path, applied_record)
            _append_jsonl(
                events_path,
                {
                    "event": "flush_applied",
                    "at": _now(),
                    "idempotency_key": key,
                    "op": entry.get("op"),
                    "issue": entry.get("issue"),
                },
            )
            applied_count += 1
        except Exception as exc:  # noqa: BLE001
            failed_count += 1
            attempts = int(entry.get("attempts", 0)) + 1
            retry_entry = {
                **entry,
                "attempts": attempts,
                "last_error": str(exc),
                "last_attempt_at": _now(),
            }
            next_queue.append(retry_entry)
            _append_jsonl(
                failures_path,
                {
                    "event": "flush_failed",
                    "at": _now(),
                    "idempotency_key": key,
                    "error": str(exc),
                    "entry": entry,
                },
            )

    _write_jsonl(outbox_path, next_queue)
    summary = {
        "status": "ok",
        "backend": backend,
        "processed": len(queued),
        "applied": applied_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "remaining": len(next_queue),
    }
    print(json.dumps(summary))
    return 0 if failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
