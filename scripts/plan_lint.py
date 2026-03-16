#!/usr/bin/env python3
"""Hard-fail linter for plan artifacts.

The contract enforces an executable planning triad:
- ASCII diagram section
- Business logic section
- Technical implementation section
"""

from __future__ import annotations

import argparse
import re
import subprocess  # nosec B404 - trusted local git invocation for repo discovery
import sys
from dataclasses import dataclass
from pathlib import Path


REQUIRED_HEADINGS = [
    "Context and Objective",
    "Success Criteria",
    "ASCII Diagram",
    "Business Logic Specification",
    "Technical Implementation Plan",
    "Executable Steps",
    "Risks and Rollback",
    "Handoff Snapshot",
]

LEGACY_REQUIRED_HEADINGS = [
    "Context and Objective",
    "Success Criteria",
    "Executable Steps",
    "Linear Issue Mapping",
    "Evidence Log",
]

REQUIRED_STEP_COLUMNS = [
    "Step ID",
    "Description",
    "Business Outcome",
    "Technical Deliverable",
    "Linear Issue",
    "State",
    "Evidence",
    "Last Updated",
]

LEGACY_STEP_COLUMNS = [
    "Step ID",
    "Description",
    "Linear Issue",
    "State",
    "Evidence",
    "Last Updated",
]

ALLOWED_STATES = {
    "Planned",
    "In Progress",
    "Completed",
    "Blocked",
    "Todo",
    "Done",
    "In Review",
}

PLAN_FILENAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}\.md$")
LINEAR_ISSUE_PATTERN = re.compile(r"[A-Z]+-\d+")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
ASCII_BLOCK_PATTERN = re.compile(r"```(?:text)?\n([\s\S]*?)\n```")
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
    if posix == "docs/plans/README.md":
        return True
    return False


def _split_sections(content: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current_heading: str | None = None
    buffer: list[str] = []

    for line in content.splitlines():
        match = re.match(r"^##\s+(.+?)\s*$", line)
        if match:
            if current_heading is not None:
                sections[current_heading] = "\n".join(buffer).strip()
            current_heading = match.group(1).strip()
            buffer = []
            continue
        if current_heading is not None:
            buffer.append(line)

    if current_heading is not None:
        sections[current_heading] = "\n".join(buffer).strip()
    return sections


def _section(sections: dict[str, str], heading: str) -> str | None:
    for key, value in sections.items():
        if key.lower() == heading.lower():
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


def _is_legacy_completed_plan(text: str, sections: dict[str, str], template_mode: bool) -> bool:
    if template_mode:
        return False
    if _extract_status(text) != "Completed":
        return False
    return all(_section(sections, heading) is not None for heading in LEGACY_REQUIRED_HEADINGS)


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
    return files


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
    legacy_mode = _is_legacy_completed_plan(text, sections, template_mode)

    if (
        not template_mode
        and path.parent.name == "plans"
        and not PLAN_FILENAME_PATTERN.match(path.name)
    ):
        errors.append("plan filename must match <slug>-YYYY-MM-DD.md (lowercase kebab case)")

    required_headings = LEGACY_REQUIRED_HEADINGS if legacy_mode else REQUIRED_HEADINGS
    for heading in required_headings:
        if _section(sections, heading) is None:
            errors.append(f"missing required heading: '## {heading}'")

    if not legacy_mode:
        ascii_section = _section(sections, "ASCII Diagram")
        if ascii_section is not None:
            blocks = ASCII_BLOCK_PATTERN.findall(ascii_section)
            if not blocks:
                errors.append("ASCII Diagram section must contain a fenced ```text block")
            else:
                ascii_block = blocks[0]
                if not ascii_block.strip():
                    errors.append("ASCII Diagram block cannot be empty")
                if any(ord(ch) > 127 for ch in ascii_block):
                    errors.append("ASCII Diagram block contains non-ASCII characters")
                if not re.search(r"[+\-|>]", ascii_block):
                    errors.append("ASCII Diagram block must contain visible diagram characters")
                for line in ascii_block.splitlines():
                    if len(line) > 140:
                        errors.append("ASCII Diagram line exceeds 140 characters")
                        break

        business_section = _section(sections, "Business Logic Specification")
        if business_section is not None:
            words = re.findall(r"\b\w+\b", business_section)
            if len(words) < 30:
                errors.append("Business Logic Specification is too short (minimum 30 words)")
            if "acceptance" not in business_section.lower():
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
        expected_columns = LEGACY_STEP_COLUMNS if legacy_mode else REQUIRED_STEP_COLUMNS
        if header is None:
            errors.append("Executable Steps section must include a markdown table")
        else:
            if header != expected_columns:
                errors.append(
                    "Executable Steps table header mismatch. "
                    f"Expected: {', '.join(expected_columns)}"
                )
            if not rows:
                errors.append("Executable Steps table must include at least one data row")
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

                linear_issue = row_map["Linear Issue"].strip("` ").strip()
                if not LINEAR_ISSUE_PATTERN.search(linear_issue):
                    errors.append(
                        "Executable Steps row must include Linear issue identifier (e.g. ROM-123)"
                    )
                state = row_map["State"].strip()
                if state not in ALLOWED_STATES:
                    errors.append(
                        f"Executable Steps row has invalid State '{state}' "
                        f"(allowed: {', '.join(sorted(ALLOWED_STATES))})"
                    )
                last_updated = row_map["Last Updated"]
                if not DATE_PATTERN.search(last_updated):
                    errors.append(
                        "Executable Steps row must include date in Last Updated (YYYY-MM-DD)"
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
