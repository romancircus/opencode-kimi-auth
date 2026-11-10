#!/usr/bin/env python3
"""Hard-fail linter for plan artifacts.

The contract enforces an executable planning triad:
- ASCII diagram section
- Business logic section
- Technical implementation section

Contract v2 (2026-11-05) retires Linear: a plan declaring `Plan-Contract-Version: 2`
has no tracker column, and a `Linear Issue` column fails. Plans declaring version 1,
or no version, are grandfathered under the v1 rules (including the issue-id check).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess  # nosec B404 - trusted local git invocation for repo discovery
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


# The contract lives in policy/plan-contract.json and is READ here rather than
# duplicated. Three disagreeing contracts (this file, the prose in
# WORKFLOW_PROTOCOL.md, and the template) is what made agents look
# non-compliant while they were faithfully following the prose they were given.
CONTRACT_PATH = Path(__file__).resolve().parent.parent / "policy" / "plan-contract.json"


def _load_contract() -> dict:
    with CONTRACT_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


CONTRACT = _load_contract()
STRICT_LEGACY = False
CONTRACT_VERSION = CONTRACT["contract_version"]

REQUIRED_HEADINGS = [h["name"] for h in CONTRACT["required_headings"]]
HEADING_SINCE = {h["name"]: h.get("since_version", 0) for h in CONTRACT["required_headings"]}
HEADING_ALIASES = {h["name"]: h.get("aliases", []) for h in CONTRACT["required_headings"]}
HEADING_LEVELS = CONTRACT.get("heading_levels", [2])

LEGACY_REQUIRED_HEADINGS = [
    "Context and Objective",
    "Success Criteria",
    "Executable Steps",
    "Linear Issue Mapping",
    "Evidence Log",
]

# v2+ step table (no tracker column). v1 and undeclared plans keep the v1 table.
REQUIRED_STEP_COLUMNS = list(CONTRACT["step_columns"])
V1_LEGACY = CONTRACT.get("v1_legacy", {})
V1_STEP_COLUMNS = list(V1_LEGACY.get("step_columns", REQUIRED_STEP_COLUMNS))
V1_ISSUE_COLUMN = V1_LEGACY.get("issue_column", "Linear Issue")
# Columns a versioned contract removed. A plan that declares that version and still
# carries the column fails with the column's own message instead of a generic
# header mismatch, so the fix is obvious.
RETIRED_COLUMNS = list(CONTRACT.get("retired_columns", []))

LEGACY_STEP_COLUMNS = [
    "Step ID",
    "Description",
    "Linear Issue",
    "State",
    "Evidence",
    "Last Updated",
]

ALLOWED_STATES = set(CONTRACT["allowed_states"])

PLAN_FILENAME_PATTERN = re.compile(CONTRACT["filename_pattern"])
LINEAR_ISSUE_PATTERN = re.compile(V1_LEGACY.get("issue_id_pattern", r"[A-Z]+-\d+"))
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")

_FENCES = "|".join(
    re.escape(lang) for lang in CONTRACT["diagram"]["fence_languages"] if lang
)
ASCII_BLOCK_PATTERN = re.compile(r"```(?:" + _FENCES + r")?\n([\s\S]*?)\n```")
BASH_BLOCK_PATTERN = re.compile(r"```bash\n[\s\S]*?\n```")


@dataclass
class LintResult:
    path: Path
    errors: list[str]


def _is_ignored_plan_path(repo_root: Path, path: Path) -> bool:
    try:
        relative = path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return False

    posix = relative.as_posix()
    if posix.startswith("docs/plans/archive/"):
        return True
    # Evidence is captured output -- verification transcripts, validator dumps --
    # not a plan artifact, so the plan contract does not apply to it. Discovery
    # uses `git ls-files "docs/plans/*.md"`, and a git pathspec `*` matches across
    # directory separators (unlike a shell glob), so evidence files were being
    # linted as plans and failing all eight required headings.
    if posix.startswith("docs/plans/evidence/"):
        return True
    if posix == "docs/plans/README.md":
        return True
    return False


def _split_sections(content: str) -> dict[str, str]:
    # Accept the heading levels the contract allows. Matching only `## ` meant a
    # perfectly good `### ASCII Diagram` counted as a missing heading.
    levels = "|".join("#" * lvl for lvl in sorted(HEADING_LEVELS))
    heading_re = re.compile(r"^(" + levels + r")\s+(.+?)\s*$")
    lines = content.splitlines()
    headings: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        match = heading_re.match(line)
        if match:
            headings.append((index, len(match.group(1)), match.group(2).strip()))

    # A section runs to the next heading of the same or a higher level, so a
    # `## Technical Implementation Plan` keeps its `###` sub-sections. Ending it at
    # ANY accepted heading left a 60-line section empty whenever its body opened
    # with a `###`. Every heading is still its own key, so a required heading
    # resolves at either level; a repeated key keeps the last body, as before.
    sections: dict[str, str] = {}
    for position, (start, level, title) in enumerate(headings):
        end = len(lines)
        for next_start, next_level, _title in headings[position + 1 :]:
            if next_level <= level:
                end = next_start
                break
        sections[title] = "\n".join(lines[start + 1 : end]).strip()
    return sections


def _section(sections: dict[str, str], heading: str) -> str | None:
    """Resolve a required heading, accepting the aliases the contract declares.

    Agents write `## Flow` or `## Architecture` for the diagram. Demanding one
    exact string made compliant plans fail on wording rather than substance.
    """
    candidates = [heading] + HEADING_ALIASES.get(heading, [])
    for candidate in candidates:
        for key, value in sections.items():
            if key.lower() == candidate.lower():
                return value
    return None


def _is_template(path: Path) -> bool:
    name = path.name.lower()
    return "template" in name or path.as_posix().endswith("templates/plan.artifact.template.md")


def _extract_status(text: str) -> str | None:
    match = re.search(r"^Status:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip()


def _plan_version(text: str) -> int:
    match = re.search(r"^Plan-Contract-Version:\s*(\d+)", text, flags=re.MULTILINE)
    return int(match.group(1)) if match else 0


def _step_columns_for(plan_version: int) -> list[str]:
    """v2+ plans use the tracker-free table; v1 and undeclared plans keep the v1 table."""
    return REQUIRED_STEP_COLUMNS if plan_version >= 2 else V1_STEP_COLUMNS


def _retired_columns_for(plan_version: int) -> list[dict]:
    return [col for col in RETIRED_COLUMNS if col.get("since_version", 0) <= plan_version]


def _is_legacy_completed_plan(
    text: str, sections: dict[str, str], template_mode: bool, plan_version: int = 0
) -> bool:
    if template_mode:
        return False
    # A plan that declares v2 opted into the current contract; it cannot fall back to
    # the pre-contract ruleset (which carries a Linear column) by flipping Status.
    if plan_version >= 2:
        return False
    if _extract_status(text) != "Completed":
        return False
    step_section = _section(sections, "Executable Steps")
    if step_section is not None:
        header, _rows = _parse_table(step_section)
        if header == _step_columns_for(plan_version):
            return False
        if header == LEGACY_STEP_COLUMNS:
            return True
    if all(_section(sections, heading) is not None for heading in REQUIRED_HEADINGS):
        return False
    return all(_section(sections, heading) is not None for heading in LEGACY_REQUIRED_HEADINGS)


def _dedupe(paths: list[Path]) -> list[Path]:
    seen: set[Path] = set()
    out: list[Path] = []
    for path in paths:
        if path not in seen:
            seen.add(path)
            out.append(path)
    return out


def _discover_files(repo_root: Path, file_args: list[str], include_all: bool) -> list[Path]:
    files: list[Path] = []
    if file_args:
        for item in file_args:
            candidate = Path(item)
            if not candidate.is_absolute():
                candidate = repo_root / candidate
            files.append(candidate.resolve())
        return [
            f
            for f in files
            if f.exists() and f.suffix.lower() == ".md" and not _is_ignored_plan_path(repo_root, f)
        ]

    if include_all:
        try:
            proc = subprocess.run(  # nosec B603,B607 - trusted local git invocation
                [
                    "git",
                    "-C",
                    str(repo_root),
                    "ls-files",
                    "docs/plans/*.md",
                    "templates/plan.artifact.template.md",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            tracked = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        except Exception:
            tracked = []
        # Untracked plans were deliberately skipped, so a 180-line 28-step program
        # plan sitting untracked in solapsvs-infra was invisible to every hook,
        # lint and reviewer. Untracked is exactly when review matters most.
        if CONTRACT.get("lint_untracked_plans", False):
            plans_dir = repo_root / "docs" / "plans"
            if plans_dir.is_dir():
                for candidate in sorted(plans_dir.rglob("*.md")):
                    resolved = candidate.resolve()
                    if _is_ignored_plan_path(repo_root, resolved):
                        continue
                    if resolved not in files:
                        files.append(resolved)

        if tracked:
            files.extend(
                (repo_root / path).resolve()
                for path in tracked
                if (repo_root / path).exists()
                and not _is_ignored_plan_path(repo_root, (repo_root / path).resolve())
            )
        else:
            plans_dir = repo_root / "docs" / "plans"
            files.extend(
                path.resolve()
                for path in sorted(plans_dir.glob("*.md"))
                if not _is_ignored_plan_path(repo_root, path)
            )
            template_path = repo_root / "templates" / "plan.artifact.template.md"
            if template_path.exists():
                files.append(template_path)
    return _dedupe(files)


def _parse_table(section_text: str) -> tuple[list[str] | None, list[list[str]]]:
    lines = section_text.splitlines()
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if index + 1 >= len(lines):
            continue
        separator = lines[index + 1].strip()
        if not separator.startswith("|") or "-" not in separator:
            continue

        header = [cell.strip() for cell in stripped.strip("|").split("|")]
        rows: list[list[str]] = []
        cursor = index + 2
        while cursor < len(lines):
            row_line = lines[cursor].strip()
            if not row_line.startswith("|"):
                break
            rows.append([cell.strip() for cell in row_line.strip("|").split("|")])
            cursor += 1
        return header, rows
    return None, []


def _lint_file(path: Path) -> LintResult:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    sections = _split_sections(text)
    template_mode = _is_template(path)
    plan_version = _plan_version(text)
    legacy_mode = _is_legacy_completed_plan(text, sections, template_mode, plan_version)

    if (
        not template_mode
        and path.parent.name == "plans"
        and not PLAN_FILENAME_PATTERN.match(path.name)
    ):
        errors.append("plan filename must match <slug>-YYYY-MM-DD.md (lowercase kebab case)")

    required_headings = LEGACY_REQUIRED_HEADINGS if legacy_mode else REQUIRED_HEADINGS
    for heading in required_headings:
        # Headings added with the versioned contract are required only of plans that
        # declare it. The prose agents were given never mentioned Risks and Rollback
        # or Handoff Snapshot, so demanding them of existing plans punishes agents
        # for following the spec.
        if HEADING_SINCE.get(heading, 0) > plan_version:
            continue
        if _section(sections, heading) is None:
            errors.append(f"missing required heading: '## {heading}'")

    if not legacy_mode:
        ascii_section = _section(sections, "ASCII Diagram")
        if ascii_section is not None:
            blocks = ASCII_BLOCK_PATTERN.findall(ascii_section)
            if not blocks:
                errors.append("Diagram section must contain a fenced code block "
                               f"({', '.join(repr(f) for f in CONTRACT['diagram']['fence_languages'])})")
            else:
                ascii_block = blocks[0]
                if not ascii_block.strip():
                    errors.append("ASCII Diagram block cannot be empty")
                diagram_rules = CONTRACT["diagram"]
                if not diagram_rules.get("allow_box_drawing", False):
                    if any(ord(ch) > 127 for ch in ascii_block):
                        errors.append("Diagram block contains non-ASCII characters")
                if diagram_rules.get("require_diagram_characters", True):
                    # Box-drawing counts: agents write it unanimously and it is more
                    # readable than the +-| set the original rule demanded.
                    if not re.search(r"[+\-|>\u2500-\u257f\u2190-\u21ff]", ascii_block):
                        errors.append("Diagram block must contain visible diagram characters")
                max_len = diagram_rules.get("max_line_length", 140)
                for line in ascii_block.splitlines():
                    if len(line) > max_len:
                        errors.append(f"Diagram line exceeds {max_len} characters")
                        break

        business_section = _section(sections, "Business Logic Specification")
        if business_section is not None:
            words = re.findall(r"\b\w+\b", business_section)
            if len(words) < 30:
                errors.append("Business Logic Specification is too short (minimum 30 words)")
            acceptance_since = CONTRACT["sections"]["Business Logic Specification"].get(
                "require_substring_since_version", 0
            )
            if acceptance_since <= plan_version and "acceptance" not in business_section.lower():
                errors.append("Business Logic Specification must include acceptance checks")
            bullet_count = len(re.findall(r"^\s*[-*]\s+", business_section, flags=re.MULTILINE))
            if bullet_count < 2:
                errors.append("Business Logic Specification must include at least 2 bullets")

        technical_section = _section(sections, "Technical Implementation Plan")
        if technical_section is not None:
            words = re.findall(r"\b\w+\b", technical_section)
            if len(words) < 35:
                errors.append("Technical Implementation Plan is too short (minimum 35 words)")
            has_path = bool(
                re.search(r"`[^`\n]*/[^`\n]+`", technical_section)
                or re.search(r"`[^`\n]+\.(py|sh|md|yaml|yml|json|ts|js)`", technical_section)
            )
            if not has_path:
                errors.append("Technical Implementation Plan must reference concrete files/modules")
            if not re.search(
                r"(test|verify|validation|lint|build)", technical_section, flags=re.IGNORECASE
            ):
                errors.append("Technical Implementation Plan must define verification strategy")

    steps_section = _section(sections, "Executable Steps")
    if steps_section is not None:
        header, rows = _parse_table(steps_section)
        expected_columns = LEGACY_STEP_COLUMNS if legacy_mode else _step_columns_for(plan_version)
        if header is None:
            errors.append("Executable Steps section must include a markdown table")
        else:
            if not legacy_mode:
                # Report a retired column by name, then lint the rest of the table as if
                # it were gone, so one stale column yields one clear finding rather than
                # a header mismatch plus a column-count error on every row.
                for retired in _retired_columns_for(plan_version):
                    name = retired["name"]
                    if name in header and name not in expected_columns:
                        errors.append(retired.get("message", f"retired column present: {name}"))
                        drop = header.index(name)
                        width = len(header)
                        header = header[:drop] + header[drop + 1 :]
                        rows = [
                            row[:drop] + row[drop + 1 :] if len(row) == width else row
                            for row in rows
                        ]
            if header != expected_columns:
                errors.append(
                    "Executable Steps table header mismatch. "
                    f"Expected: {', '.join(expected_columns)}"
                )
            if not rows:
                errors.append("Executable Steps table must include at least one data row")
            seen_linear: list[str] = []
            # Rules introduced with the versioned contract apply only to plans that
            # declare it. Historical plans keep the legacy ruleset -- grandfathering
            # on an explicit version marker rather than a mutable "Status: Completed"
            # line, which a plan could escape the contract by editing.
            declares_version = bool(
                re.search(r"^Plan-Contract-Version:\s*(\d+)", text, flags=re.MULTILINE)
            )
            for row in rows:
                if len(row) != len(expected_columns):
                    errors.append("Executable Steps table row has incorrect column count")
                    continue
                row_map = dict(zip(expected_columns, row))
                for key, value in row_map.items():
                    if not value:
                        errors.append(f"Executable Steps row has empty '{key}' field")

                if template_mode:
                    continue

                # v1 / legacy only: v2 has no tracker column.
                linear_issue = row_map.get(V1_ISSUE_COLUMN, "").strip("` ").strip()
                if V1_ISSUE_COLUMN in expected_columns and not LINEAR_ISSUE_PATTERN.search(
                    linear_issue
                ):
                    errors.append(
                        "Executable Steps row must include Linear issue identifier (e.g. ROM-123)"
                    )
                state = row_map["State"].strip()
                if CONTRACT.get("allowed_states_case_insensitive", False):
                    known = {a.lower() for a in ALLOWED_STATES}
                    state_ok = state.lower() in known
                else:
                    state_ok = state in ALLOWED_STATES
                if not state_ok:
                    errors.append(
                        f"Executable Steps row has invalid State '{state}' "
                        f"(allowed: {', '.join(sorted(ALLOWED_STATES))})"
                    )
                last_updated = row_map["Last Updated"]
                date_match = DATE_PATTERN.search(last_updated)
                if not date_match:
                    errors.append(
                        "Executable Steps row must include date in Last Updated (YYYY-MM-DD)"
                    )
                elif CONTRACT.get("validate_real_dates", True):
                    # The pattern only checked digit SHAPE, so 2026-99-99 passed.
                    try:
                        datetime.strptime(date_match.group(0), "%Y-%m-%d")
                    except ValueError:
                        errors.append(
                            f"Executable Steps row has an impossible Last Updated date "
                            f"'{date_match.group(0)}'"
                        )

                # Non-empty was the only rule, so "TBD" passed as evidence. Reject
                # placeholders, not prose: command output and observed results are
                # legitimate evidence and must not be forced into a path shape.
                evidence = row_map["Evidence"].strip("` ").strip()
                placeholders = CONTRACT.get("evidence_placeholder_values", [])
                if (declares_version or STRICT_LEGACY) and evidence.lower().rstrip(".") in placeholders:
                    errors.append(
                        f"Executable Steps row Evidence is a placeholder ('{evidence}'); "
                        "record what was actually observed, run or produced"
                    )

                if V1_ISSUE_COLUMN in expected_columns:
                    seen_linear.append(linear_issue)

            if (
                not template_mode
                and declares_version
                and not V1_LEGACY.get("allow_issue_reuse_across_rows", True)
                and len(seen_linear) > 1
            ):
                # v1 only. Reuse across rows is the v1 default (one issue per program);
                # this branch only runs when allow_issue_reuse_across_rows is false.
                declared = any(
                    f"execution mode: {mode}" in text.lower()
                    for mode in V1_LEGACY.get("issue_reuse_allowed_modes", [])
                )
                duplicates = {i for i in seen_linear if seen_linear.count(i) > 1}
                if duplicates and not declared:
                    errors.append(
                        "Executable Steps reuses Linear issue(s) "
                        f"{sorted(duplicates)} across rows without a declared reuse mode. "
                        "Declare one of: "
                        + ", ".join(
                            f"Execution Mode: {m}"
                            for m in V1_LEGACY.get("issue_reuse_allowed_modes", [])
                        )
                    )

    if not legacy_mode:
        handoff_section = _section(sections, "Handoff Snapshot")
        if handoff_section is not None:
            if "next command" not in handoff_section.lower():
                errors.append("Handoff Snapshot must include 'Next command(s)'")
            if not BASH_BLOCK_PATTERN.search(handoff_section):
                errors.append("Handoff Snapshot must include a fenced ```bash block")

    return LintResult(path=path, errors=errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Specific plan markdown files to lint")
    parser.add_argument(
        "--strict-legacy",
        action="store_true",
        help="apply versioned-contract rules to plans that predate the contract",
    )
    parser.add_argument("--all", action="store_true", help="Lint all plan files in docs/plans/")
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repository root for resolving default plan/template paths",
    )
    parser.add_argument(
        "--require-files",
        action="store_true",
        help="Fail if no candidate files are found",
    )
    args = parser.parse_args()

    global STRICT_LEGACY
    STRICT_LEGACY = args.strict_legacy

    repo_root = Path(args.repo_root).resolve()
    candidates = _discover_files(repo_root, args.files, include_all=(args.all or not args.files))

    if not candidates:
        if args.require_files:
            print("plan_lint: no plan files found", file=sys.stderr)
            return 1
        return 0

    has_error = False
    for candidate in candidates:
        result = _lint_file(candidate)
        if result.errors:
            has_error = True
            rel = candidate.relative_to(repo_root) if candidate.is_relative_to(repo_root) else candidate
            print(f"{rel}:")
            for issue in result.errors:
                print(f"  - {issue}")

    return 1 if has_error else 0


if __name__ == "__main__":
    sys.exit(main())
