#!/usr/bin/env python3
"""Hard-fail linter for CLAUDE.md policy quality."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


REQUIRED_HEADINGS = [
    "Cross-Agent Compliance",
    "Project Goal",
    "Instruction Precedence",
    "Security Guardrails",
    "Mandatory Plan-to-Linear Protocol",
    "Policy Modules",
    "Development Workflow",
]
SCOPED_REQUIRED_HEADINGS = [
    "Scope",
    "Local Constraints",
    "Local Commands",
    "Safety Notes",
]

PLACEHOLDER_PATTERNS = [
    r"\[1-2 sentence description of repo purpose\]",
    r"\[Describe key directories and files\]",
    r"\[test commands\]",
    r"\[build commands\]",
    r"\[Document institutional knowledge here as it accumulates\]",
    r"\[REPO_NAME\]",
    r"\[DATE\]",
]

ROOT_LINE_LIMIT = 220
SCOPED_LINE_LIMIT = 100
DEFAULT_ISSUE_PATTERN = re.compile(
    r"(one\s+Linear\s+issue\s+per\s+executable\s+step)", flags=re.IGNORECASE
)
SINGLE_ISSUE_PATTERN = re.compile(r"(single[- ]issue)", flags=re.IGNORECASE)
EXCEPTION_MARKER = "Execution Mode: overnight-single-issue"
IMPORT_PATTERN = re.compile(r"@([A-Za-z0-9_./-]+\.md)")
POLICY_VERSION_PATTERN = re.compile(r"^POLICY_VERSION:\s+\d{4}-\d{2}-\d{2}$", re.MULTILINE)


@dataclass
class LintResult:
    path: Path
    errors: list[str]


def _discover_candidates(repo_root: Path, file_args: list[str]) -> list[Path]:
    if file_args:
        paths = []
        for item in file_args:
            candidate = Path(item)
            if not candidate.is_absolute():
                candidate = repo_root / candidate
            if candidate.exists():
                paths.append(candidate.resolve())
        return paths

    defaults = [
        repo_root / "CLAUDE.md",
        repo_root / "templates" / "CLAUDE.md.template",
        repo_root / "templates" / "CLAUDE.md.template.macos",
        repo_root / "templates" / "AGENTS.scoped.template.md",
    ]
    return [path.resolve() for path in defaults if path.exists()]


def _is_template(path: Path) -> bool:
    return "template" in path.name.lower()


def _missing_headings(text: str) -> list[str]:
    missing = []
    for heading in REQUIRED_HEADINGS:
        if f"## {heading}" not in text:
            missing.append(heading)
    return missing


def _missing_scoped_headings(text: str) -> list[str]:
    missing = []
    for heading in SCOPED_REQUIRED_HEADINGS:
        if f"## {heading}" not in text:
            missing.append(heading)
    return missing


def _extract_h2_section(text: str, heading: str) -> str | None:
    """Return content under an H2 heading until the next H2 heading."""
    heading_re = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE)
    match = heading_re.search(text)
    if not match:
        return None

    section_start = match.end()
    next_h2 = re.search(r"^##\s+", text[section_start:], re.MULTILINE)
    section_end = section_start + next_h2.start() if next_h2 else len(text)
    return text[section_start:section_end]


def _is_scoped_policy(path: Path, repo_root: Path) -> bool:
    if path.name == "AGENTS.scoped.template.md":
        return True
    if path.name == "AGENTS.md" and path.parent != repo_root:
        return True
    return False


def _lint_file(path: Path, repo_root: Path, strict: bool) -> LintResult:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    template_mode = _is_template(path)
    scoped_mode = _is_scoped_policy(path, repo_root)

    if scoped_mode:
        missing = _missing_scoped_headings(text)
        if missing:
            errors.append(f"missing scoped heading(s): {', '.join(missing)}")
    else:
        missing = _missing_headings(text)
        if missing:
            errors.append(f"missing required heading(s): {', '.join(missing)}")

    if strict and not scoped_mode:
        if not POLICY_VERSION_PATTERN.search(text):
            errors.append("missing or invalid POLICY_VERSION date (expected YYYY-MM-DD)")

        protocol_section = _extract_h2_section(text, "Mandatory Plan-to-Linear Protocol")
        if protocol_section is not None:
            has_default = bool(DEFAULT_ISSUE_PATTERN.search(protocol_section))
            has_single = bool(SINGLE_ISSUE_PATTERN.search(protocol_section))
            has_exception = EXCEPTION_MARKER in protocol_section

            if not has_default:
                errors.append(
                    "missing default issue strategy in Mandatory Plan-to-Linear Protocol: "
                    "one Linear issue per executable step"
                )
            if has_single and not has_exception:
                errors.append(
                    "single-issue mode referenced without explicit exception marker: "
                    "Execution Mode: overnight-single-issue"
                )

        imports = sorted(set(IMPORT_PATTERN.findall(text)))
        if not imports:
            errors.append("Policy Modules section must reference @... imports")
        for imp in imports:
            imp_path = (repo_root / imp).resolve()
            if not imp_path.exists():
                errors.append(f"missing imported policy module: {imp}")

    if (
        scoped_mode
        and strict
        and (
            "## Mandatory Plan-to-Linear Protocol" in text
            or "## MANDATORY PLAN-LINEAR EXECUTION PROTOCOL" in text
        )
    ):
        errors.append("scoped AGENTS.md must not redefine the root plan/Linear protocol")

    if not template_mode:
        for pattern in PLACEHOLDER_PATTERNS:
            if re.search(pattern, text):
                errors.append(f"contains unresolved placeholder matching pattern: {pattern}")

        if path.name == "CLAUDE.md" and strict and not scoped_mode:
            line_count = len(text.splitlines())
            if line_count > ROOT_LINE_LIMIT:
                errors.append(
                    f"root CLAUDE.md exceeds {ROOT_LINE_LIMIT} lines ({line_count})"
                )
        if scoped_mode and strict:
            line_count = len(text.splitlines())
            if line_count > SCOPED_LINE_LIMIT:
                errors.append(
                    f"scoped AGENTS.md exceeds {SCOPED_LINE_LIMIT} lines ({line_count})"
                )

    return LintResult(path=path, errors=errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Specific policy files to lint")
    parser.add_argument("--repo-root", default=".", help="Repository root path")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Enable strict checks: imports, contradiction checks, line limits",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    candidates = _discover_candidates(repo_root, args.files)
    if not candidates:
        print("claude_policy_lint: no candidate files found", file=sys.stderr)
        return 1

    has_error = False
    for candidate in candidates:
        result = _lint_file(candidate, repo_root=repo_root, strict=args.strict)
        if result.errors:
            has_error = True
            rel = (
                result.path.relative_to(repo_root)
                if result.path.is_relative_to(repo_root)
                else result.path
            )
            print(f"{rel}:")
            for err in result.errors:
                print(f"  - {err}")

    return 1 if has_error else 0


if __name__ == "__main__":
    sys.exit(main())
